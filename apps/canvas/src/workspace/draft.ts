import type { MessageKey } from "../i18n/catalog";
import type { UiLocale } from "../preferences/schema";
import type { OutputLocale } from "./gateway";

export type WorkspaceCreateStep = "name" | "project" | "runner" | "output-locale" | "review";

export type WorkspaceCreateDraft = {
  name: string;
  projectPath: string | null;
  runnerProfileId: string | null;
  outputLocale: OutputLocale;
  step: WorkspaceCreateStep;
  dirty: boolean;
};

export const WORKSPACE_CREATE_STEPS: WorkspaceCreateStep[] = [
  "name",
  "project",
  "runner",
  "output-locale",
  "review",
];

export function createEmptyDraft(uiLocale: UiLocale): WorkspaceCreateDraft {
  return {
    name: "",
    projectPath: null,
    runnerProfileId: null,
    outputLocale: uiLocale,
    step: "name",
    dirty: false,
  };
}

const INVALID_NAME_CHARS = /[<>:"/\\|?*]/;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) {
      return true;
    }
  }
  return false;
}

export function validateWorkspaceName(name: string): MessageKey | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "workspace.validation.nameRequired";
  }
  if (
    INVALID_NAME_CHARS.test(trimmed) ||
    hasControlChars(trimmed) ||
    WINDOWS_RESERVED_NAMES.test(trimmed) ||
    trimmed.endsWith(".") ||
    trimmed === "." ||
    trimmed === ".."
  ) {
    return "workspace.validation.nameInvalidChars";
  }
  return null;
}

export function summarizePath(path: string, max = 48): string {
  if (path.length <= max) {
    return path;
  }
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) {
    return `…${path.slice(-(max - 1))}`;
  }
  const separator = path.lastIndexOf("\\") > path.lastIndexOf("/") ? "\\" : "/";
  const tail = parts.slice(-2).join(separator);
  return `…${separator}${tail}`;
}

export function isOutputLocale(value: string): value is OutputLocale {
  return value === "zh-CN" || value === "en-US";
}

export function outputLocaleMessageKey(locale: OutputLocale): "locale.zh-CN" | "locale.en-US" {
  return locale === "zh-CN" ? "locale.zh-CN" : "locale.en-US";
}

export const WORKSPACE_STEP_MESSAGE_KEYS: Record<WorkspaceCreateStep, MessageKey> = {
  name: "workspace.create.step.name",
  project: "workspace.create.step.project",
  runner: "workspace.create.step.runner",
  "output-locale": "workspace.create.step.outputLocale",
  review: "workspace.create.step.review",
};

export function nextStep(step: WorkspaceCreateStep): WorkspaceCreateStep | null {
  const index = WORKSPACE_CREATE_STEPS.indexOf(step);
  if (index < 0 || index >= WORKSPACE_CREATE_STEPS.length - 1) {
    return null;
  }
  return WORKSPACE_CREATE_STEPS[index + 1]!;
}

export function previousStep(step: WorkspaceCreateStep): WorkspaceCreateStep | null {
  const index = WORKSPACE_CREATE_STEPS.indexOf(step);
  if (index <= 0) {
    return null;
  }
  return WORKSPACE_CREATE_STEPS[index - 1]!;
}
