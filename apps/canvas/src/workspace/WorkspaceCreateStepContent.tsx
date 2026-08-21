import {
  Button,
  Notice,
  Select,
  StatusMark,
  TextField,
  type StatusTone,
} from "../design-system/primitives";
import type { MessageKey } from "../i18n/catalog";
import { useI18n } from "../i18n/useI18n";
import {
  isOutputLocale,
  outputLocaleMessageKey,
  summarizePath,
  WORKSPACE_CREATE_STEPS,
  WORKSPACE_STEP_MESSAGE_KEYS,
  type WorkspaceCreateDraft,
} from "./draft";
import type { RunnerProbeResult } from "./gateway";

type WorkspaceCreateStepContentProps = {
  draft: WorkspaceCreateDraft;
  errorKey: MessageKey | null;
  submitErrorKey: MessageKey | null;
  probeErrorKey: MessageKey | null;
  runners: RunnerProbeResult[];
  probing: boolean;
  pickingDirectory: boolean;
  submitting: boolean;
  onNameChange: (name: string) => void;
  onContinue: () => void;
  onPickDirectory: () => Promise<void>;
  onSelectRunner: (runnerId: string) => void;
  onRetryProbe: () => Promise<void>;
  onOutputLocaleChange: (locale: WorkspaceCreateDraft["outputLocale"]) => void;
  onRetryCreate: () => Promise<void>;
};

function probeTone(status: RunnerProbeResult["status"]): StatusTone {
  switch (status) {
    case "available":
      return "success";
    case "probing":
      return "active";
    case "needs_configuration":
    case "incompatible":
    case "unsupported_platform":
      return "waiting";
    case "missing":
    case "probe_failed":
      return "danger";
    default:
      return "neutral";
  }
}

function probeLabelKey(status: RunnerProbeResult["status"]): MessageKey {
  switch (status) {
    case "probing":
      return "runner.probe.probing";
    case "available":
      return "runner.probe.available";
    case "missing":
      return "runner.probe.missing";
    case "incompatible":
      return "runner.probe.incompatible";
    case "needs_configuration":
      return "runner.probe.needs_configuration";
    case "unsupported_platform":
      return "runner.probe.unsupported_platform";
    case "probe_failed":
      return "runner.probe.probe_failed";
  }
}

export function WorkspaceCreateStepContent({
  draft,
  errorKey,
  submitErrorKey,
  probeErrorKey,
  runners,
  probing,
  pickingDirectory,
  submitting,
  onNameChange,
  onContinue,
  onPickDirectory,
  onSelectRunner,
  onRetryProbe,
  onOutputLocaleChange,
  onRetryCreate,
}: WorkspaceCreateStepContentProps) {
  const { t } = useI18n();
  const selectedRunner = runners.find((item) => item.id === draft.runnerProfileId);

  return (
    <div className="workspace-create">
      <div className="workspace-create__steps" aria-label={t("workspace.create.title")}>
        {WORKSPACE_CREATE_STEPS.map((step) => (
          <span key={step} className={step === draft.step ? "is-current" : undefined}>
            {t(WORKSPACE_STEP_MESSAGE_KEYS[step])}
          </span>
        ))}
      </div>

      {draft.step === "name" ? (
        <TextField
          label={t("workspace.create.nameLabel")}
          hint={t("workspace.create.nameHint")}
          value={draft.name}
          error={errorKey ? t(errorKey) : null}
          onValueChange={onNameChange}
          onSubmitIntent={onContinue}
          autoFocus
        />
      ) : null}

      {draft.step === "project" ? (
        <div className="workspace-create">
          <div>
            <div className="ds-field__label">{t("workspace.create.projectLabel")}</div>
            <p className="ds-field__hint">{t("workspace.create.projectHint")}</p>
            <p title={draft.projectPath ?? undefined}>
              {draft.projectPath
                ? summarizePath(draft.projectPath, 64)
                : t("workspace.create.projectMissing")}
            </p>
            {errorKey ? (
              <p className="ds-field__error" role="alert">
                {t(errorKey)}
              </p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            loading={pickingDirectory}
            onClick={() => void onPickDirectory()}
          >
            {t("workspace.create.projectPick")}
          </Button>
        </div>
      ) : null}

      {draft.step === "runner" ? (
        <div className="workspace-create">
          <p className="ds-field__hint">{t("workspace.create.runnerHint")}</p>
          {runners.length === 0 && !probing && !probeErrorKey ? (
            <Notice tone="unavailable" title={t("runner.probe.capabilityUnavailable")} />
          ) : null}
          {probeErrorKey ? (
            <Notice tone="danger" title={t("runner.probe.probe_failed")}>
              {t(probeErrorKey)}
            </Notice>
          ) : null}
          <div className="runner-list" aria-label={t("workspace.create.runnerLabel")}>
            {runners.map((runner) => {
              const available = runner.status === "available";
              const selected = draft.runnerProfileId === runner.id;
              return (
                <button
                  key={runner.id}
                  type="button"
                  aria-pressed={selected}
                  className={selected ? "runner-item is-selected" : "runner-item"}
                  disabled={!available}
                  onClick={() => onSelectRunner(runner.id)}
                >
                  <span className="runner-item__name">
                    {runner.displayName}
                    {runner.id === "pi" && available ? ` · ${t("runner.probe.recommended")}` : ""}
                  </span>
                  <StatusMark
                    tone={probeTone(runner.status)}
                    label={t(probeLabelKey(runner.status))}
                    busy={runner.status === "probing"}
                  />
                  <span className="runner-item__meta">
                    {[runner.version, runner.capabilities.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
          {errorKey ? (
            <p className="ds-field__error" role="alert">
              {t(errorKey)}
            </p>
          ) : null}
          <Button variant="secondary" loading={probing} onClick={() => void onRetryProbe()}>
            {t("workspace.create.runnerRetry")}
          </Button>
        </div>
      ) : null}

      {draft.step === "output-locale" ? (
        <Select
          label={t("workspace.create.outputLocaleLabel")}
          hint={t("workspace.create.outputLocaleHint")}
          value={draft.outputLocale}
          error={errorKey ? t(errorKey) : null}
          onValueChange={(value) => {
            if (isOutputLocale(value)) {
              onOutputLocaleChange(value);
            }
          }}
          options={[
            { value: "zh-CN", label: t("locale.zh-CN") },
            { value: "en-US", label: t("locale.en-US") },
          ]}
        />
      ) : null}

      {draft.step === "review" ? (
        <div className="workspace-create">
          <dl className="review-list">
            <div>
              <dt>{t("workspace.create.reviewName")}</dt>
              <dd>{draft.name.trim()}</dd>
            </div>
            <div>
              <dt>{t("workspace.create.reviewProject")}</dt>
              <dd title={draft.projectPath ?? undefined}>
                {draft.projectPath
                  ? summarizePath(draft.projectPath, 72)
                  : t("workspace.create.projectMissing")}
              </dd>
            </div>
            <div>
              <dt>{t("workspace.create.reviewRunner")}</dt>
              <dd>{selectedRunner?.displayName ?? draft.runnerProfileId}</dd>
            </div>
            <div>
              <dt>{t("workspace.create.reviewOutputLocale")}</dt>
              <dd>{t(outputLocaleMessageKey(draft.outputLocale))}</dd>
            </div>
          </dl>
          {submitErrorKey ? (
            <Notice
              tone="danger"
              title={t("workspace.create.failed")}
              action={
                <Button
                  variant="secondary"
                  loading={submitting}
                  onClick={() => void onRetryCreate()}
                >
                  {t("workspace.create.retry")}
                </Button>
              }
            >
              {t(submitErrorKey)}
            </Notice>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
