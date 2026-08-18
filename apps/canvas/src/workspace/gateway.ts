export type ConnectionState =
  | { status: "unknown" }
  | { status: "checking" }
  | { status: "available"; capabilities: string[] }
  | { status: "unavailable"; code: string; messageKey: string }
  | { status: "error"; code: string; messageKey: string };

export type RunnerProbeStatus =
  | "probing"
  | "available"
  | "missing"
  | "incompatible"
  | "needs_configuration"
  | "unsupported_platform"
  | "probe_failed";

export type RunnerProbeResult = {
  id: string;
  displayName: string;
  status: RunnerProbeStatus;
  version?: string;
  capabilities: string[];
  messageKey?: string;
};

export type OutputLocale = "zh-CN" | "en-US";

export type GatewayOperationOptions = {
  signal?: AbortSignal;
};

export type WorkspaceCreateInput = {
  name: string;
  projectPath: string;
  runnerProfileId: string;
  defaultOutputLocale: OutputLocale;
};

export type WorkspaceCreateResult =
  | { ok: true; workspaceId: string }
  | {
      ok: false;
      code: string;
      messageKey:
        | "app.connection.unavailable"
        | "workspace.create.failed"
        | "workspace.create.failedDetail";
    };

export type DirectorySelectionResult =
  | { ok: true; path: string }
  | {
      ok: false;
      code: "denied" | "missing" | "unreadable" | "unwritable" | "unavailable" | "cancelled";
      messageKey:
        | "app.context.directoryUnavailable"
        | "workspace.validation.projectUnreadable"
        | "workspace.validation.projectUnwritable"
        | "workspace.validation.projectMissing"
        | "workspace.validation.pickerDenied";
    };

export type WorkspaceSummary = {
  id: string;
  name: string;
  projectPath: string;
  defaultOutputLocale: OutputLocale;
  runnerProfileId: string;
};

export type WorkspaceGateway = {
  getConnectionState(): Promise<ConnectionState>;
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  probeRunnerProfiles(
    onResult: (result: RunnerProbeResult) => void,
    options?: GatewayOperationOptions,
  ): Promise<void>;
  selectProjectDirectory(
    options?: GatewayOperationOptions,
  ): Promise<DirectorySelectionResult>;
  createWorkspace(
    input: WorkspaceCreateInput,
    options?: GatewayOperationOptions,
  ): Promise<WorkspaceCreateResult>;
  openDiagnostics?(): Promise<void>;
  quit?(): Promise<void>;
};

export const UNAVAILABLE_CONNECTION: ConnectionState = {
  status: "unavailable",
  code: "runtime_unavailable",
  messageKey: "app.connection.unavailable",
};

/**
 * Production gateway until F1-B injects a real Runtime adapter.
 * Must never invent Workspace persistence or Runner probe success.
 */
export function createUnavailableGateway(): WorkspaceGateway {
  return {
    async getConnectionState() {
      return UNAVAILABLE_CONNECTION;
    },
    async listWorkspaces() {
      return [];
    },
    async probeRunnerProfiles() {
      return;
    },
    async selectProjectDirectory() {
      return {
        ok: false,
        code: "unavailable",
        messageKey: "app.context.directoryUnavailable",
      };
    },
    async createWorkspace() {
      return {
        ok: false,
        code: "runtime_unavailable",
        messageKey: "app.connection.unavailable",
      };
    },
  };
}
