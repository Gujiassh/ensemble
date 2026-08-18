import { themeTokensToCssVars } from "./themes";
import type { ResolvedAppearance } from "./types";

const DENSITY_VARS: Record<ResolvedAppearance["density"], Record<string, string>> = {
  comfortable: {
    "--space-1": "4px",
    "--space-2": "8px",
    "--space-3": "12px",
    "--space-4": "16px",
    "--space-5": "20px",
    "--space-6": "24px",
    "--control-height": "36px",
    "--list-row-height": "40px",
    "--line-height-ui": "1.45",
    "--font-size-ui": "14px",
  },
  compact: {
    "--space-1": "4px",
    "--space-2": "6px",
    "--space-3": "8px",
    "--space-4": "12px",
    "--space-5": "16px",
    "--space-6": "20px",
    "--control-height": "30px",
    "--list-row-height": "32px",
    "--line-height-ui": "1.3",
    "--font-size-ui": "13px",
  },
};

const MOTION_VARS: Record<ResolvedAppearance["motion"], Record<string, string>> = {
  full: {
    "--duration-instant": "100ms",
    "--duration-fast": "180ms",
    "--duration-layout": "260ms",
    "--handoff-duration": "520ms",
    "--ease-standard": "cubic-bezier(.2, .8, .2, 1)",
    "--ease-exit": "cubic-bezier(.4, 0, 1, 1)",
  },
  reduced: {
    "--duration-instant": "0ms",
    "--duration-fast": "80ms",
    "--duration-layout": "100ms",
    "--handoff-duration": "100ms",
    "--ease-standard": "linear",
    "--ease-exit": "linear",
  },
};

const COMPONENT_VARS: Record<string, string> = {
  "--navigation-rail-width": "56px",
  "--navigation-rail-overlay-width": "208px",
  "--context-bar-height": "52px",
  "--inspector-width": "320px",
  "--inspector-max-width": "360px",
  "--seat-size": "72px",
  "--radius-control": "6px",
  "--radius-surface": "8px",
  "--font-ui":
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  "--font-mono":
    'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace',
  "--font-weight-regular": "400",
  "--font-weight-medium": "500",
  "--font-weight-semibold": "600",
};

export function applyAppearanceToElement(
  element: HTMLElement,
  appearance: ResolvedAppearance,
): void {
  const vars = {
    ...themeTokensToCssVars(appearance.theme),
    ...DENSITY_VARS[appearance.density],
    ...MOTION_VARS[appearance.motion],
    ...COMPONENT_VARS,
  };

  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }

  element.dataset.theme = appearance.theme;
  element.dataset.density = appearance.density;
  element.dataset.motion = appearance.motion;
  element.dataset.contrast = appearance.contrast;
  element.style.colorScheme = appearance.theme;
}
