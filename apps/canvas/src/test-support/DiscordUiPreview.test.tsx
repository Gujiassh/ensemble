import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "./render";
import { DiscordUiPreview } from "./DiscordUiPreview";

describe("DiscordUiPreview output inspection", () => {
  it("opens Workspace Files without assigning them to the selected Seat", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiscordUiPreview />);

    await user.click(screen.getByRole("button", { name: "Files" }));

    expect(screen.getByText("Project files")).toBeInTheDocument();
    expect(screen.getByText(/Baseline/)).toBeInTheDocument();
    expect(screen.queryByText("Observed from Implementation")).not.toBeInTheDocument();
  });

  it("opens an interactive Seat session and deep-links its Change Set", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<DiscordUiPreview />);

    await user.click(
      screen.getByRole("button", { name: /Implementation Owns/ }),
    );

    expect(screen.getByLabelText("Implementation session")).toBeInTheDocument();
    expect(screen.getByLabelText("Message Implementation")).toBeInTheDocument();
    expect(container.querySelector(".dui-session-terminal")?.textContent).toContain(
      "Test Files  15 passed",
    );

    await user.click(screen.getByRole("button", { name: /4 changed files/ }));

    expect(screen.getByText("Observed from Implementation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders distinct structured Artifact previews", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiscordUiPreview />);

    await user.click(screen.getByRole("button", { name: "Artifacts" }));
    await user.click(screen.getByRole("button", { name: /runner-probe.json/ }));

    expect(screen.getByRole("heading", { name: "runner-probe.json" })).toBeInTheDocument();
    expect(screen.getByText(/"schemaVersion": 1/)).toBeInTheDocument();
    expect(screen.getByText("runner_diagnostic")).toBeInTheDocument();
  });
});
