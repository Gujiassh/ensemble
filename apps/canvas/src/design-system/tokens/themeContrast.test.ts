import { describe, expect, it } from "vitest";
import { THEME_TOKENS, type ThemeTokenMap } from "./themes";

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function assertTextContrast(tokens: ThemeTokenMap) {
  const pairs = [
    [tokens.textPrimary, tokens.appBackground],
    [tokens.textPrimary, tokens.canvasBackground],
    [tokens.textPrimary, tokens.surface],
    [tokens.textPrimary, tokens.selection],
    [tokens.textSecondary, tokens.canvasBackground],
    [tokens.textSecondary, tokens.surface],
    [tokens.textNavigation, tokens.navigationBackground],
    [tokens.textOnPrimary, tokens.actionPrimary],
    [tokens.textOnPrimary, tokens.actionPrimaryHover],
    [tokens.textOnPrimary, tokens.statusDanger],
    [tokens.statusActive, tokens.surface],
    [tokens.statusWaiting, tokens.surface],
    [tokens.statusDanger, tokens.surface],
    [tokens.statusSuccess, tokens.surface],
    [tokens.statusNeutral, tokens.surface],
  ];

  for (const [foreground, background] of pairs) {
    expect(
      contrastRatio(foreground!, background!),
      `${foreground} on ${background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
}

describe("theme text contrast", () => {
  it("meets WCAG AA in the light theme", () => {
    assertTextContrast(THEME_TOKENS.light);
  });

  it("meets WCAG AA in the dark theme", () => {
    assertTextContrast(THEME_TOKENS.dark);
  });
});
