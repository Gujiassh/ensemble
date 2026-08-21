import { describe, expect, it } from "vitest";
import { createInitialRootModel, transition, type RootModel } from "./rootState";

function modelAt(lifecycle: RootModel["lifecycle"]): RootModel {
  return { ...createInitialRootModel(), lifecycle };
}

describe("root lifecycle state machine", () => {
  it("allows the boot, backend, workspace, and ready paths", () => {
    let model = createInitialRootModel();
    model = transition(model, { lifecycle: "restoring_preferences" });
    model = transition(model, { lifecycle: "checking_backend" });
    model = transition(model, { lifecycle: "no_workspace" });
    model = transition(model, { lifecycle: "workspace_loading" });
    model = transition(model, { lifecycle: "ready" });

    expect(model.lifecycle).toBe("ready");
  });

  it("allows backend result states when React batches the checking state", () => {
    const restoring = modelAt("restoring_preferences");

    expect(transition(restoring, { lifecycle: "no_workspace" }).lifecycle).toBe("no_workspace");
    expect(transition(restoring, { lifecycle: "workspace_loading" }).lifecycle).toBe(
      "workspace_loading",
    );
  });

  it("rejects a direct ready-to-startup-error jump", () => {
    expect(() => transition(modelAt("ready"), { lifecycle: "startup_error" })).toThrow(
      /ready -> startup_error/,
    );
  });
});
