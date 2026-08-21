import type {
  AppearanceAxes,
  ContrastPreference,
  MotionPreference,
  ResolvedAppearance,
  ResolvedContrast,
  ResolvedMotion,
  ResolvedTheme,
  ThemePreference,
} from "./types";

export type PlatformSignals = {
  prefersDark: boolean;
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  forcedColorsActive: boolean;
};

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }
  return preference;
}

export function resolveMotion(
  preference: MotionPreference,
  prefersReducedMotion: boolean,
): ResolvedMotion {
  if (prefersReducedMotion) {
    return "reduced";
  }
  if (preference === "system") {
    return "full";
  }
  return preference;
}

export function resolveContrast(
  preference: ContrastPreference,
  prefersHighContrast: boolean,
  forcedColorsActive = false,
): ResolvedContrast {
  if (forcedColorsActive) {
    return "high";
  }
  if (preference === "system") {
    return prefersHighContrast ? "high" : "normal";
  }
  return preference;
}

export function resolveAppearance(
  axes: AppearanceAxes,
  signals: PlatformSignals,
): ResolvedAppearance {
  return {
    theme: resolveTheme(axes.theme, signals.prefersDark),
    density: axes.density,
    motion: resolveMotion(axes.motion, signals.prefersReducedMotion),
    contrast: resolveContrast(
      axes.contrast,
      signals.prefersHighContrast,
      signals.forcedColorsActive,
    ),
  };
}

export function readPlatformSignals(
  matchMedia: (query: string) => { matches: boolean } = globalThis.matchMedia?.bind(globalThis) ??
    (() => ({ matches: false })),
): PlatformSignals {
  return {
    prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
    prefersReducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    prefersHighContrast: matchMedia("(prefers-contrast: more)").matches,
    forcedColorsActive: matchMedia("(forced-colors: active)").matches,
  };
}
