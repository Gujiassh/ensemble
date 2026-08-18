import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreferenceDiagnostic } from "../preferences/schema";
import type { WorkspaceGateway, WorkspaceSummary } from "../workspace/gateway";
import { createInitialRootModel, transition, type RootModel } from "./rootState";

type RootLifecycleOptions = {
  gateway: WorkspaceGateway;
  preferencesReady: boolean;
  preferenceDiagnostics: PreferenceDiagnostic[];
  lastWorkspaceId: string | null;
  persistLastWorkspaceId: (workspaceId: string) => Promise<void>;
};

export function useRootLifecycle({
  gateway,
  preferencesReady,
  preferenceDiagnostics,
  lastWorkspaceId,
  persistLastWorkspaceId,
}: RootLifecycleOptions) {
  const [model, setModel] = useState<RootModel>(createInitialRootModel);
  const requestRef = useRef(0);
  const lastWorkspaceIdRef = useRef(lastWorkspaceId);
  const diagnosticsRef = useRef(preferenceDiagnostics);
  const persistLastWorkspaceIdRef = useRef(persistLastWorkspaceId);
  lastWorkspaceIdRef.current = lastWorkspaceId;
  diagnosticsRef.current = preferenceDiagnostics;
  persistLastWorkspaceIdRef.current = persistLastWorkspaceId;

  const activeWorkspace = useMemo(
    () => model.workspaces.find((item) => item.id === model.activeWorkspaceId) ?? null,
    [model.workspaces, model.activeWorkspaceId],
  );

  const bootstrap = useCallback(async () => {
    const requestId = ++requestRef.current;
    setModel((current) =>
      transition(current, {
        lifecycle: "checking_backend",
        connection: { status: "checking" },
        diagnostics: diagnosticsRef.current,
        startupErrorCode: null,
        requestId,
      }),
    );

    try {
      const connection = await gateway.getConnectionState();
      if (requestId !== requestRef.current) {
        return;
      }

      if (connection.status !== "available") {
        const unavailable =
          connection.status === "unavailable" || connection.status === "error"
            ? connection
            : {
                status: "unavailable" as const,
                code: "runtime_unavailable",
                messageKey: "app.connection.unavailable",
              };
        setModel((current) =>
          transition(current, {
            lifecycle: "startup_error",
            connection: unavailable,
            startupErrorCode: unavailable.code,
            workspaces: [],
            activeWorkspaceId: null,
            requestId,
          }),
        );
        return;
      }

      const workspaces = await gateway.listWorkspaces();
      if (requestId !== requestRef.current) {
        return;
      }

      if (workspaces.length === 0) {
        setModel((current) =>
          transition(current, {
            lifecycle: "no_workspace",
            connection,
            workspaces: [],
            activeWorkspaceId: null,
            requestId,
          }),
        );
        return;
      }

      const preferred =
        workspaces.find((item) => item.id === lastWorkspaceIdRef.current) ??
        workspaces[0]!;
      setModel((current) =>
        transition(current, {
          lifecycle: "workspace_loading",
          connection,
          workspaces,
          activeWorkspaceId: preferred.id,
          requestId,
        }),
      );

      setModel((current) =>
        transition(current, {
          lifecycle: "ready",
          connection,
          workspaces,
          activeWorkspaceId: preferred.id,
          requestId,
        }),
      );
      await persistLastWorkspaceIdRef.current(preferred.id).catch(() => undefined);
    } catch {
      if (requestId !== requestRef.current) {
        return;
      }
      setModel((current) =>
        transition(current, {
          lifecycle: "startup_error",
          connection: {
            status: "error",
            code: "startup_failed",
            messageKey: "app.connection.unavailable",
          },
          startupErrorCode: "startup_failed",
          workspaces: [],
          activeWorkspaceId: null,
          requestId,
        }),
      );
    }
  }, [gateway]);

  useEffect(() => {
    if (!preferencesReady) {
      setModel((current) =>
        transition(current, {
          lifecycle: "restoring_preferences",
          diagnostics: diagnosticsRef.current,
          requestId: current.requestId,
        }),
      );
      return;
    }
    void bootstrap();
  }, [preferencesReady, bootstrap]);

  const confirmCreatedWorkspace = useCallback(
    async (workspaceId: string) => {
      const requestId = ++requestRef.current;
      setModel((current) =>
        transition(current, {
          lifecycle: "workspace_loading",
          activeWorkspaceId: workspaceId,
          requestId,
        }),
      );
      try {
        const workspaces = await gateway.listWorkspaces();
        if (requestId !== requestRef.current) {
          return;
        }
        const found = workspaces.find((item) => item.id === workspaceId);
        if (!found) {
          throw new Error("Created workspace was not returned by the gateway");
        }
        setModel((current) =>
          transition(current, {
            lifecycle: "ready",
            workspaces,
            activeWorkspaceId: found.id,
            requestId,
          }),
        );
        await persistLastWorkspaceIdRef.current(found.id).catch(() => undefined);
      } catch {
        if (requestId !== requestRef.current) {
          return;
        }
        setModel((current) =>
          transition(current, {
            lifecycle: "startup_error",
            connection: current.connection,
            startupErrorCode: "workspace_missing_after_create",
            workspaces: [],
            activeWorkspaceId: null,
            requestId,
          }),
        );
      }
    },
    [gateway],
  );

  return {
    model,
    activeWorkspace: activeWorkspace as WorkspaceSummary | null,
    bootstrap,
    confirmCreatedWorkspace,
  };
}
