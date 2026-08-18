export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type DensityPreference = "comfortable" | "compact";
export type MotionPreference = "full" | "reduced" | "system";
export type ResolvedMotion = "full" | "reduced";
export type ContrastPreference = "normal" | "high" | "system";
export type ResolvedContrast = "normal" | "high";

export type AppearanceAxes = {
  theme: ThemePreference;
  density: DensityPreference;
  motion: MotionPreference;
  contrast: ContrastPreference;
};

export type ResolvedAppearance = {
  theme: ResolvedTheme;
  density: DensityPreference;
  motion: ResolvedMotion;
  contrast: ResolvedContrast;
};
