import { useCallback, useMemo, useState } from "react";
import { CanvasViewport } from "../canvas/CanvasViewport";
import type { CanvasObject, CanvasViewportState } from "../canvas/types";
import { useI18n } from "../i18n/useI18n";
import { InspectorShell, type InspectorSection } from "../inspector/InspectorShell";
import { usePreferences } from "../preferences/usePreferences";
import { SettingsSurface } from "../settings/SettingsSurface";
import { WorkspaceCreateFlow } from "../workspace/WorkspaceCreateFlow";
import type { WorkspaceGateway, WorkspaceSummary } from "../workspace/gateway";
import { ContextBar } from "./ContextBar";
import { NavigationRail, type ShellDestination } from "./NavigationRail";
import { canOpenWorkspaceCreate } from "./rootState";
import { StartupErrorSurface } from "./StartupErrorSurface";
import { useWindowWidth } from "./useMediaQuery";
import { useRootLifecycle } from "./useRootLifecycle";

export type AppShellProps = {
  gateway: WorkspaceGateway;
  /** Optional typed projection injector for tests only. */
  projectionForWorkspace?: (workspace: WorkspaceSummary) => CanvasViewportState;
};

export function AppShell({ gateway, projectionForWorkspace }: AppShellProps) {
  const { t } = useI18n();
  const {
    preferences,
    diagnostics: preferenceDiagnostics,
    ready: preferencesReady,
    setPreferences,
  } = usePreferences();
  const [railExpanded, setRailExpanded] = useState(false);
  const [destination, setDestination] = useState<ShellDestination>("workspaces");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<CanvasObject | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorReturnTarget, setInspectorReturnTarget] = useState<HTMLElement | null>(null);
  const width = useWindowWidth();

  const persistLastWorkspaceId = useCallback(
    (workspaceId: string) => setPreferences({ lastWorkspaceId: workspaceId }),
    [setPreferences],
  );
  const { model, activeWorkspace, bootstrap, confirmCreatedWorkspace } = useRootLifecycle({
    gateway,
    preferencesReady,
    preferenceDiagnostics,
    lastWorkspaceId: preferences.lastWorkspaceId,
    persistLastWorkspaceId,
  });

  const canvasState: CanvasViewportState = useMemo(() => {
    if (model.lifecycle === "workspace_loading") {
      return { status: "loading" };
    }
    if (model.lifecycle === "no_workspace") {
      return { status: "empty" };
    }
    if (model.lifecycle === "ready" && activeWorkspace) {
      return projectionForWorkspace
        ? projectionForWorkspace(activeWorkspace)
        : {
            status: "ready",
            projection: { workspaceId: activeWorkspace.id, objects: [] },
          };
    }
    return { status: "empty" };
  }, [model.lifecycle, activeWorkspace, projectionForWorkspace]);

  function handleNavigate(next: ShellDestination) {
    setDestination(next);
    if (next === "settings") {
      setSettingsOpen(true);
    }
  }

  const handleCreated = useCallback(
    (workspaceId: string) => {
      setCreateOpen(false);
      setSelectedObject(null);
      setInspectorOpen(false);
      void confirmCreatedWorkspace(workspaceId);
    },
    [confirmCreatedWorkspace],
  );

  const handleSelectObject = useCallback((object: CanvasObject | null, trigger?: HTMLElement) => {
    if (object && trigger) {
      setInspectorReturnTarget(trigger);
    }
    setSelectedObject(object);
    setInspectorOpen(Boolean(object));
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectorOpen(false);
    setSelectedObject(null);
  }, []);

  const inspectorMode = width >= 1440 ? "docked" : "overlay";
  const showShell =
    model.lifecycle === "no_workspace" ||
    model.lifecycle === "workspace_loading" ||
    model.lifecycle === "ready" ||
    model.lifecycle === "startup_error";

  const inspectorSections: InspectorSection[] = selectedObject
    ? [
        {
          id: "overview",
          titleKey: "inspector.section.overview",
          body: selectedObject.summary ?? selectedObject.kind,
        },
      ]
    : [];

  if (
    model.lifecycle === "booting" ||
    model.lifecycle === "restoring_preferences" ||
    model.lifecycle === "checking_backend"
  ) {
    const label =
      model.lifecycle === "restoring_preferences"
        ? t("app.boot.restoringPreferences")
        : model.lifecycle === "checking_backend"
          ? t("app.boot.checkingBackend")
          : t("app.boot.loading");

    return (
      <div className="app-boot" role="status" aria-live="polite">
        <div className="app-boot__panel">
          <div className="app-boot__indicator" aria-hidden="true" />
          {preferencesReady ? <div>{label}</div> : null}
        </div>
      </div>
    );
  }

  if (!showShell) {
    return null;
  }

  return (
    <div className="shell">
      <NavigationRail
        expanded={railExpanded}
        onToggleExpanded={() => setRailExpanded((value) => !value)}
        active={destination}
        onNavigate={handleNavigate}
        attentionCount={0}
        workspaceLabel={activeWorkspace?.name ?? t("app.context.noWorkspace")}
      />
      <div className="shell__main">
        <ContextBar
          workspaceName={activeWorkspace?.name ?? null}
          projectPath={activeWorkspace?.projectPath ?? null}
          connection={model.connection}
          primaryActionLabel={
            canOpenWorkspaceCreate(model.lifecycle) ? t("app.context.createWorkspace") : undefined
          }
          onPrimaryAction={
            canOpenWorkspaceCreate(model.lifecycle) ? () => setCreateOpen(true) : undefined
          }
          primaryDisabled={model.connection.status !== "available"}
        />

        {model.lifecycle === "startup_error" ? (
          <StartupErrorSurface
            onRetry={bootstrap}
            onOpenDiagnostics={gateway.openDiagnostics}
            onQuit={gateway.quit}
          />
        ) : (
          <div
            className={
              inspectorOpen && inspectorMode === "docked"
                ? "shell__workspace is-inspector-docked"
                : "shell__workspace"
            }
          >
            <CanvasViewport
              state={canvasState}
              selectedObjectId={selectedObject?.id ?? null}
              onSelectObject={handleSelectObject}
              primaryAction={
                model.lifecycle === "no_workspace"
                  ? {
                      label: t("app.context.createWorkspace"),
                      onClick: () => setCreateOpen(true),
                    }
                  : undefined
              }
            />
            <InspectorShell
              open={inspectorOpen}
              mode={inspectorMode}
              object={selectedObject}
              sections={inspectorSections}
              onClose={handleCloseInspector}
              returnFocusTarget={inspectorReturnTarget}
            />
          </div>
        )}
      </div>

      <SettingsSurface
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setDestination("workspaces");
        }}
      />

      <WorkspaceCreateFlow
        open={createOpen}
        gateway={gateway}
        uiLocale={preferences.uiLocale}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
