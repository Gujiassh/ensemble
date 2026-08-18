import type { PreferenceDiagnostic } from "../preferences/schema";
import type { ConnectionState, WorkspaceSummary } from "../workspace/gateway";

export type RootLifecycleState =
  | "booting"
  | "restoring_preferences"
  | "checking_backend"
  | "startup_error"
  | "no_workspace"
  | "workspace_loading"
  | "ready";

export type RootModel = {
  lifecycle: RootLifecycleState;
  connection: ConnectionState;
  diagnostics: PreferenceDiagnostic[];
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  startupErrorCode: string | null;
  requestId: number;
};

const ALLOWED_TRANSITIONS: Record<RootLifecycleState, readonly RootLifecycleState[]> = {
  booting: ["booting", "restoring_preferences", "checking_backend"],
  restoring_preferences: [
    "restoring_preferences",
    "checking_backend",
    "startup_error",
    "no_workspace",
    "workspace_loading",
  ],
  checking_backend: [
    "checking_backend",
    "startup_error",
    "no_workspace",
    "workspace_loading",
  ],
  startup_error: ["startup_error", "checking_backend"],
  no_workspace: ["no_workspace", "workspace_loading"],
  workspace_loading: ["workspace_loading", "ready", "startup_error"],
  ready: ["ready", "workspace_loading"],
};

export function createInitialRootModel(): RootModel {
  return {
    lifecycle: "booting",
    connection: { status: "unknown" },
    diagnostics: [],
    workspaces: [],
    activeWorkspaceId: null,
    startupErrorCode: null,
    requestId: 0,
  };
}

export function canOpenWorkspaceCreate(lifecycle: RootLifecycleState): boolean {
  return lifecycle === "no_workspace" || lifecycle === "ready";
}

export function transition(
  model: RootModel,
  patch: Partial<RootModel> & { lifecycle: RootLifecycleState },
): RootModel {
  if (!ALLOWED_TRANSITIONS[model.lifecycle].includes(patch.lifecycle)) {
    throw new Error(
      `Invalid root lifecycle transition: ${model.lifecycle} -> ${patch.lifecycle}`,
    );
  }
  return {
    ...model,
    ...patch,
  };
}
