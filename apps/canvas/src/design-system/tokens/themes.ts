import type { ResolvedTheme } from "./types";

/** Primitive reference values used only inside theme definitions. */
const lightPrimitives = {
  appBackground: "#ECEFF1",
  canvasBackground: "#F7F8F9",
  navigationBackground: "#1A1D21",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  textPrimary: "#17191C",
  textSecondary: "#676E76",
  textNavigation: "#F7F8F9",
  textOnPrimary: "#F7F8F9",
  borderSubtle: "#D9DEE3",
  borderStrong: "#A8B0B8",
  actionPrimary: "#C93626",
  actionPrimaryHover: "#B73627",
  focus: "#2F6FDB",
  selection: "#D6E4F8",
  statusActive: "#2F6FDB",
  statusWaiting: "#95600C",
  statusDanger: "#C33F39",
  statusSuccess: "#287658",
  statusNeutral: "#676E76",
} as const;

/** Dark theme is a separate hierarchy, not an invert of light. */
const darkPrimitives = {
  appBackground: "#121417",
  canvasBackground: "#171A1E",
  navigationBackground: "#0E1012",
  surface: "#1E2227",
  surfaceRaised: "#262B31",
  textPrimary: "#EEF1F4",
  textSecondary: "#9AA3AC",
  textNavigation: "#EEF1F4",
  textOnPrimary: "#17191C",
  borderSubtle: "#2E343B",
  borderStrong: "#4A535C",
  actionPrimary: "#F0624D",
  actionPrimaryHover: "#F57A68",
  focus: "#5B8FE8",
  selection: "#243652",
  statusActive: "#5B8FE8",
  statusWaiting: "#D49A3A",
  statusDanger: "#E0625A",
  statusSuccess: "#3D9A74",
  statusNeutral: "#9AA3AC",
} as const;

export type ThemeTokenMap = {
  [K in keyof typeof lightPrimitives]: string;
};

export const THEME_TOKENS: Record<ResolvedTheme, ThemeTokenMap> = {
  light: lightPrimitives,
  dark: darkPrimitives,
};

export const SEMANTIC_TOKEN_NAMES = [
  "--color-app-background",
  "--color-canvas-background",
  "--color-navigation-background",
  "--color-surface",
  "--color-surface-raised",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-navigation",
  "--color-text-on-primary",
  "--color-border-subtle",
  "--color-border-strong",
  "--color-action-primary",
  "--color-action-primary-hover",
  "--color-focus",
  "--color-selection",
  "--color-status-active",
  "--color-status-waiting",
  "--color-status-danger",
  "--color-status-success",
  "--color-status-neutral",
] as const;

export function themeTokensToCssVars(theme: ResolvedTheme): Record<string, string> {
  const t = THEME_TOKENS[theme];
  return {
    "--color-app-background": t.appBackground,
    "--color-canvas-background": t.canvasBackground,
    "--color-navigation-background": t.navigationBackground,
    "--color-surface": t.surface,
    "--color-surface-raised": t.surfaceRaised,
    "--color-text-primary": t.textPrimary,
    "--color-text-secondary": t.textSecondary,
    "--color-text-navigation": t.textNavigation,
    "--color-text-on-primary": t.textOnPrimary,
    "--color-border-subtle": t.borderSubtle,
    "--color-border-strong": t.borderStrong,
    "--color-action-primary": t.actionPrimary,
    "--color-action-primary-hover": t.actionPrimaryHover,
    "--color-focus": t.focus,
    "--color-selection": t.selection,
    "--color-status-active": t.statusActive,
    "--color-status-waiting": t.statusWaiting,
    "--color-status-danger": t.statusDanger,
    "--color-status-success": t.statusSuccess,
    "--color-status-neutral": t.statusNeutral,
  };
}
