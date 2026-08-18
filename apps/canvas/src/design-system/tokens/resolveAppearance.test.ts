import { describe, expect, it } from "vitest";
import { applyAppearanceToElement } from "./applyAppearance";
import { resolveAppearance } from "./resolveAppearance";
import { SEMANTIC_TOKEN_NAMES, themeTokensToCssVars } from "./themes";

describe("appearance resolver", () => {
  it("resolves system theme without mutating the preference", () => {
    const dark = resolveAppearance(
      {
        theme: "system",
        density: "comfortable",
        motion: "system",
        contrast: "system",
      },
      {
        prefersDark: true,
        prefersReducedMotion: false,
        prefersHighContrast: false,
        forcedColorsActive: false,
      },
    );
    expect(dark.theme).toBe("dark");
  });

  it("forces reduced motion when the platform requires it", () => {
    const resolved = resolveAppearance(
      {
        theme: "light",
        density: "compact",
        motion: "full",
        contrast: "normal",
      },
      {
        prefersDark: false,
        prefersReducedMotion: true,
        prefersHighContrast: false,
        forcedColorsActive: false,
      },
    );
    expect(resolved.motion).toBe("reduced");
  });

  it("forces high contrast when forced colors are active", () => {
    const resolved = resolveAppearance(
      {
        theme: "light",
        density: "comfortable",
        motion: "full",
        contrast: "normal",
      },
      {
        prefersDark: false,
        prefersReducedMotion: false,
        prefersHighContrast: false,
        forcedColorsActive: true,
      },
    );
    expect(resolved.contrast).toBe("high");
  });

  it("applies only semantic CSS variables to the root", () => {
    const element = document.createElement("div");
    applyAppearanceToElement(
      element,
      {
        theme: "light",
        density: "comfortable",
        motion: "full",
        contrast: "normal",
      },
    );

    for (const name of SEMANTIC_TOKEN_NAMES) {
      expect(element.style.getPropertyValue(name)).not.toBe("");
    }
    expect(element.dataset.theme).toBe("light");
    expect(themeTokensToCssVars("dark")["--color-canvas-background"]).not.toBe(
      themeTokensToCssVars("light")["--color-canvas-background"],
    );
  });
});
