import type {
  ConnectionState,
  DirectorySelectionResult,
  RunnerProbeResult,
  WorkspaceCreateInput,
  WorkspaceCreateResult,
  WorkspaceGateway,
  WorkspaceSummary,
} from "../workspace/gateway";

export type TestGatewayOptions = {
  connection?: ConnectionState;
  workspaces?: WorkspaceSummary[];
  runners?: RunnerProbeResult[];
  directoryResult?: DirectorySelectionResult;
  createResult?: WorkspaceCreateResult | ((input: WorkspaceCreateInput) => WorkspaceCreateResult);
  createDelayMs?: number;
  runnerDelaysMs?: Record<string, number>;
  runnerProbeError?: Error;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Deterministic gateway for tests/demo harnesses only.
 * Must be dependency-injected; never imported by the production entry.
 */
export function createTestGateway(options: TestGatewayOptions = {}): WorkspaceGateway {
  let workspaces = [...(options.workspaces ?? [])];
  const connection: ConnectionState = options.connection ?? {
    status: "available",
    capabilities: ["workspace.create", "runner.probe", "directory.pick"],
  };

  return {
    async getConnectionState() {
      return connection;
    },
    async listWorkspaces() {
      return [...workspaces];
    },
    async probeRunnerProfiles(onResult, operationOptions) {
      const runners = options.runners ?? [
        {
          id: "pi",
          displayName: "pi",
          status: "available",
          version: "1.0.0",
          capabilities: ["code"],
        },
      ];
      await Promise.all(
        runners.map(async (runner) => {
          const delayMs = options.runnerDelaysMs?.[runner.id] ?? 0;
          if (delayMs) {
            await delay(delayMs);
          }
          if (!operationOptions?.signal?.aborted) {
            onResult({ ...runner });
          }
        }),
      );
      if (options.runnerProbeError && !operationOptions?.signal?.aborted) {
        throw options.runnerProbeError;
      }
    },
    async selectProjectDirectory(operationOptions) {
      if (operationOptions?.signal?.aborted) {
        throw new DOMException("Directory selection aborted", "AbortError");
      }
      return (
        options.directoryResult ?? {
          ok: true,
          path: "/tmp/ensemble-project",
        }
      );
    },
    async createWorkspace(input, operationOptions) {
      if (options.createDelayMs) {
        await delay(options.createDelayMs);
      }
      if (operationOptions?.signal?.aborted) {
        throw new DOMException("Workspace creation aborted", "AbortError");
      }
      const result =
        typeof options.createResult === "function"
          ? options.createResult(input)
          : (options.createResult ?? {
              ok: true as const,
              workspaceId: `ws_${workspaces.length + 1}`,
            });

      if (result.ok) {
        workspaces = [
          ...workspaces,
          {
            id: result.workspaceId,
            name: input.name,
            projectPath: input.projectPath,
            defaultOutputLocale: input.defaultOutputLocale,
            runnerProfileId: input.runnerProfileId,
          },
        ];
      }
      return result;
    },
  };
}

export function setTestGatewayConnection(
  gateway: WorkspaceGateway & { __setConnection?: (state: ConnectionState) => void },
  state: ConnectionState,
): void {
  gateway.__setConnection?.(state);
}
