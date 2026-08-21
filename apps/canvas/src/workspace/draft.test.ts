import { describe, expect, it } from "vitest";
import {
  createEmptyDraft,
  nextStep,
  previousStep,
  summarizePath,
  validateWorkspaceName,
} from "./draft";

describe("workspace draft", () => {
  it("initializes output locale from UI locale without coupling later", () => {
    const draft = createEmptyDraft("en-US");
    expect(draft.outputLocale).toBe("en-US");
    expect(draft.step).toBe("name");
    expect(draft.dirty).toBe(false);
  });

  it("validates names against platform filename restrictions", () => {
    expect(validateWorkspaceName("  ")).toBe("workspace.validation.nameRequired");
    expect(validateWorkspaceName("bad/name")).toBe("workspace.validation.nameInvalidChars");
    expect(validateWorkspaceName("CON")).toBe("workspace.validation.nameInvalidChars");
    expect(validateWorkspaceName("Alpha.")).toBe("workspace.validation.nameInvalidChars");
    expect(validateWorkspaceName("Alpha")).toBeNull();
  });

  it("walks steps forward and back", () => {
    expect(nextStep("name")).toBe("project");
    expect(nextStep("review")).toBeNull();
    expect(previousStep("project")).toBe("name");
    expect(previousStep("name")).toBeNull();
  });

  it("summarizes long paths without rewriting separators", () => {
    const path = "/Users/example/projects/ensemble-demo-workspace";
    expect(summarizePath(path, 24)).toContain("…/");
    expect(summarizePath(path, 24)).not.toContain("\\");
    const windowsPath = "C:\\Users\\example\\projects\\ensemble-demo-workspace";
    expect(summarizePath(windowsPath, 24)).toContain("…\\");
    expect(summarizePath(windowsPath, 24)).not.toContain("/");
  });
});
