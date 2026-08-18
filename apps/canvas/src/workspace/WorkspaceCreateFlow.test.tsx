import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { renderWithProviders } from "../test-support/render";
import { createTestGateway } from "../test-support/gateway";
import { WorkspaceCreateFlow } from "./WorkspaceCreateFlow";
import type { WorkspaceCreateResult, WorkspaceGateway } from "./gateway";

function Harness({
  onCreated,
  gateway,
}: {
  onCreated: (workspaceId: string) => void;
  gateway?: WorkspaceGateway;
}) {
  const [open, setOpen] = useState(true);
  const stableGateway = useMemo(() => gateway ?? createTestGateway(), [gateway]);
  return (
    <WorkspaceCreateFlow
      open={open}
      gateway={stableGateway}
      uiLocale="en-US"
      onClose={() => setOpen(false)}
      onCreated={(workspaceId) => {
        onCreated(workspaceId);
        setOpen(false);
      }}
    />
  );
}

describe("WorkspaceCreateFlow", () => {
  it("walks the four-step flow and submits a typed create command", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    renderWithProviders(<Harness onCreated={(id) => created.push(id)} />, {
      preferences: { uiLocale: "en-US" },
    });

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    await user.type(within(dialog).getByLabelText("Workspace name"), "Beta");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Choose directory" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("button", { name: /pi/i });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByLabelText("Agent output language")).toHaveValue("en-US");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Create workspace" }));

    await waitFor(() => {
      expect(created).toEqual(["ws_1"]);
    });
  });

  it("preserves a dirty draft confirmation path", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceCreateFlow
        open
        gateway={createTestGateway()}
        uiLocale="en-US"
        onClose={() => undefined}
        onCreated={() => undefined}
      />,
      { preferences: { uiLocale: "en-US" } },
    );

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    await user.type(within(dialog).getByLabelText("Workspace name"), "Dirty");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("dialog", { name: "Discard draft?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create workspace" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(await screen.findByDisplayValue("Dirty")).toBeInTheDocument();
  });

  it("keeps the draft after a failed create command", async () => {
    const user = userEvent.setup();
    const gateway = createTestGateway({
      createResult: {
        ok: false,
        code: "create_failed",
        messageKey: "workspace.create.failedDetail",
      },
    });
    renderWithProviders(<Harness gateway={gateway} onCreated={() => undefined} />, {
      preferences: { uiLocale: "en-US" },
    });

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    await user.type(within(dialog).getByLabelText("Workspace name"), "Persistent draft");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Choose directory" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("button", { name: /pi/i });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Create workspace" }));

    expect(await within(dialog).findByText("Workspace could not be created")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    await user.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(within(dialog).getByDisplayValue("Persistent draft")).toBeInTheDocument();
  });

  it("ignores a create result after the flow is discarded", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    let resolveCreate!: (result: WorkspaceCreateResult) => void;
    const pendingCreate = new Promise<WorkspaceCreateResult>((resolve) => {
      resolveCreate = resolve;
    });
    const gateway: WorkspaceGateway = {
      ...createTestGateway(),
      createWorkspace: () => pendingCreate,
    };
    renderWithProviders(
      <Harness gateway={gateway} onCreated={(workspaceId) => created.push(workspaceId)} />,
      { preferences: { uiLocale: "en-US" } },
    );

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    await user.type(within(dialog).getByLabelText("Workspace name"), "Discard me");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Choose directory" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("button", { name: /pi/i });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Create workspace" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    resolveCreate({ ok: true, workspaceId: "late_workspace" });
    await pendingCreate;
    await Promise.resolve();
    expect(created).toEqual([]);
  });

  it("allows an available runner to resolve before a slow profile", async () => {
    const user = userEvent.setup();
    const gateway = createTestGateway({
      runners: [
        { id: "slow", displayName: "Slow runner", status: "missing", capabilities: [] },
        { id: "pi", displayName: "pi", status: "available", capabilities: ["code"] },
      ],
      runnerDelaysMs: { slow: 300, pi: 0 },
    });
    renderWithProviders(<Harness gateway={gateway} onCreated={() => undefined} />, {
      preferences: { uiLocale: "en-US" },
    });

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    await user.type(within(dialog).getByLabelText("Workspace name"), "Partial probe");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.click(within(dialog).getByRole("button", { name: "Choose directory" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(await within(dialog).findByRole("button", { name: /pi/i })).toBeEnabled();
    expect(within(dialog).queryByText("Slow runner")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await within(dialog).findByLabelText("Agent output language")).toBeInTheDocument();
  });
});
