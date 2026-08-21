import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test-support/render";
import { createTestGateway } from "../test-support/gateway";
import { createUnavailableGateway } from "../workspace/gateway";
import { AppShell } from "./AppShell";

describe("AppShell root lifecycle", () => {
  it("boots into startup_error with the unavailable production gateway", async () => {
    renderWithProviders(<AppShell gateway={createUnavailableGateway()} />);

    expect(await screen.findByRole("button", { name: /Retry|重试/ })).toBeInTheDocument();
    expect(
      screen.getAllByText(/Workspace service unavailable|工作区服务不可用/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Fixture|LOD|Todo/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Open diagnostics|打开诊断/ }));
    expect(await screen.findByRole("dialog", { name: /Diagnostics|诊断/ })).toBeInTheDocument();
  });

  it("reaches no_workspace when the injected gateway is available and empty", async () => {
    renderWithProviders(<AppShell gateway={createTestGateway({ workspaces: [] })} />, {
      preferences: { uiLocale: "en-US" },
    });

    expect(
      (await screen.findAllByRole("heading", { name: "No workspace" })).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Create workspace" }).length).toBeGreaterThan(0);
  });

  it("creates a workspace only after a gateway success", async () => {
    const user = userEvent.setup();
    const gateway = createTestGateway();
    renderWithProviders(<AppShell gateway={gateway} />, {
      preferences: { uiLocale: "en-US" },
    });

    await screen.findAllByRole("heading", { name: "No workspace" });
    await user.click(screen.getAllByRole("button", { name: "Create workspace" })[0]!);

    const dialog = await screen.findByRole("dialog", { name: "Create workspace" });
    const nameInput = within(dialog).getByLabelText("Workspace name");
    await user.type(nameInput, "Alpha");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    await user.click(within(dialog).getByRole("button", { name: "Choose directory" }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    await within(dialog).findByRole("button", { name: /pi/i });
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    await within(dialog).findByLabelText("Agent output language");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));

    await user.click(within(dialog).getByRole("button", { name: "Create workspace" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create workspace" })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("heading", { name: "Alpha" })).toBeInTheDocument();
  });

  it("keeps UI locale independent from draft output locale defaults", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell gateway={createTestGateway()} />, {
      preferences: { uiLocale: "zh-CN" },
    });

    await screen.findAllByRole("heading", { name: "暂无工作区" });
    await user.click(screen.getAllByRole("button", { name: "创建工作区" })[0]!);

    const dialog = await screen.findByRole("dialog", { name: "创建工作区" });
    await user.type(within(dialog).getByLabelText("工作区名称"), "演示");
    await user.click(within(dialog).getByRole("button", { name: "继续" }));
    await user.click(within(dialog).getByRole("button", { name: "选择目录" }));
    await user.click(within(dialog).getByRole("button", { name: "继续" }));
    await within(dialog).findByRole("button", { name: /pi/i });
    await user.click(within(dialog).getByRole("button", { name: "继续" }));

    const outputSelect = await within(dialog).findByLabelText("Agent 输出语言");
    expect(outputSelect).toHaveValue("zh-CN");
  });

  it("restores dialog and inspector focus without exposing internal IDs", async () => {
    const user = userEvent.setup();
    const gateway = createTestGateway({
      workspaces: [
        {
          id: "workspace_internal_1",
          name: "Atlas",
          projectPath: "/projects/atlas",
          runnerProfileId: "pi",
          defaultOutputLocale: "en-US",
        },
      ],
    });
    renderWithProviders(
      <AppShell
        gateway={gateway}
        projectionForWorkspace={() => ({
          status: "ready",
          projection: {
            workspaceId: "workspace_internal_1",
            objects: [
              {
                id: "seat_internal_123",
                kind: "seat",
                label: "Research",
                summary: "Coordinates investigation",
              },
            ],
          },
        })}
      />,
      { preferences: { uiLocale: "en-US" } },
    );

    const objectButton = await screen.findByRole("button", { name: "Research" });
    await user.click(objectButton);
    expect(await screen.findByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.queryByText("seat_internal_123")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(objectButton).toHaveFocus());

    const settingsButton = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsButton);
    const settingsDialog = await screen.findByRole("dialog", { name: "Settings" });
    await user.click(within(settingsDialog).getByRole("button", { name: "Close settings" }));
    await waitFor(() => expect(settingsButton).toHaveFocus());
  });
});
