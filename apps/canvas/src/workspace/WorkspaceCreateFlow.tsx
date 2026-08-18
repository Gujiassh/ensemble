import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
} from "../design-system/primitives";
import { useI18n } from "../i18n/useI18n";
import type { MessageKey } from "../i18n/catalog";
import type { UiLocale } from "../preferences/schema";
import {
  createEmptyDraft,
  nextStep,
  previousStep,
  validateWorkspaceName,
  type WorkspaceCreateDraft,
} from "./draft";
import type {
  RunnerProbeResult,
  WorkspaceCreateInput,
  WorkspaceGateway,
} from "./gateway";
import { WorkspaceCreateStepContent } from "./WorkspaceCreateStepContent";

type WorkspaceCreateFlowProps = {
  open: boolean;
  gateway: WorkspaceGateway;
  uiLocale: UiLocale;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
};

export function WorkspaceCreateFlow({
  open,
  gateway,
  uiLocale,
  onClose,
  onCreated,
}: WorkspaceCreateFlowProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<WorkspaceCreateDraft>(() =>
    createEmptyDraft(uiLocale),
  );
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [submitErrorKey, setSubmitErrorKey] = useState<MessageKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickingDirectory, setPickingDirectory] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [runners, setRunners] = useState<RunnerProbeResult[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeErrorKey, setProbeErrorKey] = useState<MessageKey | null>(null);
  const probeRequestRef = useRef(0);
  const createRequestRef = useRef(0);
  const directoryRequestRef = useRef(0);
  const probeAbortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const directoryAbortRef = useRef<AbortController | null>(null);
  const runnerSelectionTouchedRef = useRef(false);
  const uiLocaleRef = useRef(uiLocale);
  uiLocaleRef.current = uiLocale;

  const invalidateCommands = useCallback(() => {
    createRequestRef.current += 1;
    directoryRequestRef.current += 1;
    createAbortRef.current?.abort();
    directoryAbortRef.current?.abort();
    createAbortRef.current = null;
    directoryAbortRef.current = null;
    setSubmitting(false);
    setPickingDirectory(false);
  }, []);

  const invalidateAll = useCallback(() => {
    invalidateCommands();
    probeRequestRef.current += 1;
    probeAbortRef.current?.abort();
    probeAbortRef.current = null;
    setProbing(false);
  }, [invalidateCommands]);

  const loadRunners = useCallback(async () => {
    const requestId = ++probeRequestRef.current;
    probeAbortRef.current?.abort();
    const controller = new AbortController();
    probeAbortRef.current = controller;
    runnerSelectionTouchedRef.current = false;
    setRunners([]);
    setProbeErrorKey(null);
    setProbing(true);
    setDraft((current) => ({ ...current, runnerProfileId: null }));

    try {
      await gateway.probeRunnerProfiles(
        (result) => {
          if (requestId !== probeRequestRef.current || controller.signal.aborted) {
            return;
          }
          setRunners((current) => {
            const index = current.findIndex((item) => item.id === result.id);
            if (index < 0) {
              return [...current, result];
            }
            const next = [...current];
            next[index] = result;
            return next;
          });
          if (result.status === "available" && !runnerSelectionTouchedRef.current) {
            setDraft((current) => {
              if (result.id !== "pi" && current.runnerProfileId) {
                return current;
              }
              return { ...current, runnerProfileId: result.id };
            });
          }
        },
        { signal: controller.signal },
      );
    } catch {
      if (requestId === probeRequestRef.current && !controller.signal.aborted) {
        setProbeErrorKey("runner.probe.failedDetail");
      }
    } finally {
      if (requestId === probeRequestRef.current) {
        setProbing(false);
      }
    }
  }, [gateway]);

  useEffect(() => {
    if (!open) {
      invalidateAll();
      return;
    }
    setDraft(createEmptyDraft(uiLocaleRef.current));
    setErrorKey(null);
    setSubmitErrorKey(null);
    setSubmitting(false);
    setPickingDirectory(false);
    setConfirmDiscard(false);
    setProbeErrorKey(null);
    void loadRunners();
    return invalidateAll;
  }, [open, invalidateAll, loadRunners]);

  function updateDraft(patch: Partial<WorkspaceCreateDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
      dirty: true,
    }));
  }

  function requestClose() {
    if (draft.dirty) {
      invalidateCommands();
      setConfirmDiscard(true);
      return;
    }
    invalidateAll();
    onClose();
  }

  function validateCurrentStep(): boolean {
    if (draft.step === "name") {
      const key = validateWorkspaceName(draft.name);
      setErrorKey(key);
      return key === null;
    }
    if (draft.step === "project") {
      if (!draft.projectPath) {
        setErrorKey("workspace.validation.projectRequired");
        return false;
      }
      setErrorKey(null);
      return true;
    }
    if (draft.step === "runner") {
      if (!draft.runnerProfileId) {
        setErrorKey("workspace.validation.runnerRequired");
        return false;
      }
      const selected = runners.find((item) => item.id === draft.runnerProfileId);
      if (!selected || selected.status !== "available") {
        setErrorKey("workspace.validation.runnerUnavailable");
        return false;
      }
      setErrorKey(null);
      return true;
    }
    if (draft.step === "output-locale") {
      if (!draft.outputLocale) {
        setErrorKey("workspace.validation.outputLocaleRequired");
        return false;
      }
      setErrorKey(null);
      return true;
    }
    setErrorKey(null);
    return true;
  }

  async function handlePickDirectory() {
    const requestId = ++directoryRequestRef.current;
    directoryAbortRef.current?.abort();
    const controller = new AbortController();
    directoryAbortRef.current = controller;
    setPickingDirectory(true);
    try {
      const result = await gateway.selectProjectDirectory({ signal: controller.signal });
      if (requestId !== directoryRequestRef.current || controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        if (result.code === "cancelled") {
          return;
        }
        setErrorKey(result.messageKey);
        return;
      }
      updateDraft({ projectPath: result.path });
      setErrorKey(null);
    } catch {
      if (requestId === directoryRequestRef.current && !controller.signal.aborted) {
        setErrorKey("app.context.directoryUnavailable");
      }
    } finally {
      if (requestId === directoryRequestRef.current) {
        setPickingDirectory(false);
      }
    }
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }
    if (!validateCurrentStep()) {
      return;
    }
    if (
      !draft.projectPath ||
      !draft.runnerProfileId ||
      !draft.name.trim()
    ) {
      return;
    }

    const input: WorkspaceCreateInput = {
      name: draft.name.trim(),
      projectPath: draft.projectPath,
      runnerProfileId: draft.runnerProfileId,
      defaultOutputLocale: draft.outputLocale,
    };

    const requestId = ++createRequestRef.current;
    createAbortRef.current?.abort();
    const controller = new AbortController();
    createAbortRef.current = controller;
    setSubmitting(true);
    setSubmitErrorKey(null);
    try {
      const result = await gateway.createWorkspace(input, { signal: controller.signal });
      if (requestId !== createRequestRef.current || controller.signal.aborted) {
        return;
      }
      setSubmitting(false);
      if (!result.ok) {
        setSubmitErrorKey(result.messageKey);
        return;
      }
      setDraft(createEmptyDraft(uiLocaleRef.current));
      onCreated(result.workspaceId);
    } catch {
      if (requestId === createRequestRef.current && !controller.signal.aborted) {
        setSubmitting(false);
        setSubmitErrorKey("workspace.create.failedDetail");
      }
    }
  }

  function handleContinue() {
    if (!validateCurrentStep()) {
      return;
    }
    const upcoming = nextStep(draft.step);
    if (!upcoming) {
      void handleSubmit();
      return;
    }
    updateDraft({ step: upcoming, dirty: draft.dirty });
  }

  function handleBack() {
    const prior = previousStep(draft.step);
    if (!prior) {
      return;
    }
    invalidateCommands();
    setErrorKey(null);
    setDraft((current) => ({ ...current, step: prior }));
  }

  return (
    <>
      <Dialog
        open={open && !confirmDiscard}
        title={t("workspace.create.title")}
        onClose={requestClose}
        closeLabel={t("common.action.close")}
        footer={
          <div className="workspace-create__actions">
            <div>
              {previousStep(draft.step) ? (
                <Button variant="quiet" onClick={handleBack}>
                  {t("workspace.create.back")}
                </Button>
              ) : (
                <Button variant="quiet" onClick={requestClose}>
                  {t("workspace.create.cancel")}
                </Button>
              )}
            </div>
            <div className="workspace-create__primary-actions">
              {draft.step === "review" ? (
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {t("workspace.create.submit")}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void handleContinue()}>
                  {t("workspace.create.next")}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <WorkspaceCreateStepContent
          draft={draft}
          errorKey={errorKey}
          submitErrorKey={submitErrorKey}
          probeErrorKey={probeErrorKey}
          runners={runners}
          probing={probing}
          pickingDirectory={pickingDirectory}
          submitting={submitting}
          onNameChange={(name) => updateDraft({ name })}
          onContinue={handleContinue}
          onPickDirectory={handlePickDirectory}
          onSelectRunner={(runnerProfileId) => {
            runnerSelectionTouchedRef.current = true;
            updateDraft({ runnerProfileId });
          }}
          onRetryProbe={loadRunners}
          onOutputLocaleChange={(outputLocale) => updateDraft({ outputLocale })}
          onRetryCreate={handleSubmit}
        />
      </Dialog>

      <Dialog
        open={confirmDiscard}
        title={t("workspace.create.discardTitle")}
        onClose={() => setConfirmDiscard(false)}
        closeLabel={t("common.action.close")}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setConfirmDiscard(false);
                if (draft.step === "runner" && runners.length === 0) {
                  void loadRunners();
                }
              }}
            >
              {t("workspace.create.continueEditing")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                invalidateAll();
                setConfirmDiscard(false);
                setDraft(createEmptyDraft(uiLocaleRef.current));
                onClose();
              }}
            >
              {t("workspace.create.discardConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("workspace.create.discardBody")}</p>
      </Dialog>
    </>
  );
}
