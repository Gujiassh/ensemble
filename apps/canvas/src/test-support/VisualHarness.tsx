import { AppShell } from "../app-shell/AppShell";
import type { CanvasViewportState } from "../canvas/types";
import type { DevicePreferences, UiLocale } from "../preferences/schema";
import { DiscordUiPreview } from "./DiscordUiPreview";
import {
  createUnavailableGateway,
  type WorkspaceGateway,
  type WorkspaceSummary,
} from "../workspace/gateway";
import { createTestGateway } from "./gateway";
import { TestProviders } from "./TestProviders";

type VisualScenario = "startup-error" | "no-workspace" | "create-failure" | "ready" | "ui-preview";

type VisualHarnessProps = {
  params: URLSearchParams;
};

const READY_WORKSPACE: WorkspaceSummary = {
  id: "workspace_atlas",
  name: "Atlas",
  projectPath: "/projects/atlas",
  runnerProfileId: "pi",
  defaultOutputLocale: "en-US",
};

function readScenario(params: URLSearchParams): VisualScenario {
  const value = params.get("scenario");
  if (
    value === "no-workspace" ||
    value === "create-failure" ||
    value === "ready" ||
    value === "ui-preview"
  ) {
    return value;
  }
  return "startup-error";
}

function readLocale(params: URLSearchParams): UiLocale {
  return params.get("locale") === "en-US" ? "en-US" : "zh-CN";
}

function readPreferences(params: URLSearchParams): Partial<DevicePreferences> {
  return {
    uiLocale: readLocale(params),
    theme: params.get("theme") === "dark" ? "dark" : "light",
    density: params.get("density") === "compact" ? "compact" : "comfortable",
    motion: params.get("motion") === "reduced" ? "reduced" : "full",
    contrast: params.get("contrast") === "high" ? "high" : "normal",
  };
}

function createScenarioGateway(scenario: VisualScenario): WorkspaceGateway {
  if (scenario === "startup-error") {
    return createUnavailableGateway();
  }
  if (scenario === "ready") {
    return createTestGateway({ workspaces: [READY_WORKSPACE] });
  }
  if (scenario === "create-failure") {
    return createTestGateway({
      createResult: {
        ok: false,
        code: "create_failed",
        messageKey: "workspace.create.failedDetail",
      },
    });
  }
  return createTestGateway();
}

function projectionForWorkspace(workspace: WorkspaceSummary): CanvasViewportState {
  return {
    status: "ready",
    projection: {
      workspaceId: workspace.id,
      objects: [
        {
          id: "seat_research",
          kind: "seat",
          label: "Research",
          summary: "Coordinates investigation and source review.",
        },
        {
          id: "seat_implementation",
          kind: "seat",
          label: "Implementation",
          summary: "Owns the active code change.",
        },
        {
          id: "attention_review",
          kind: "attention",
          label: "Review needed",
          summary: "A decision is waiting for review.",
        },
      ],
    },
  };
}

export function VisualHarness({ params }: VisualHarnessProps) {
  const scenario = readScenario(params);
  if (scenario === "ui-preview") {
    return (
      <div className="app-root">
        <TestProviders preferences={readPreferences(params)}>
          <DiscordUiPreview />
        </TestProviders>
      </div>
    );
  }
  const gateway = createScenarioGateway(scenario);

  return (
    <div className="app-root">
      <TestProviders preferences={readPreferences(params)}>
        <AppShell gateway={gateway} projectionForWorkspace={projectionForWorkspace} />
      </TestProviders>
    </div>
  );
}
