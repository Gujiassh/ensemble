import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const ALLOWED = new Set([path.join(SRC_ROOT, "design-system/tokens/themes.ts")]);

const HEX = /#(?:[0-9a-fA-F]{3,8})\b/;
const RGB = /\brgba?\(/;
const HSL = /\bhsla?\(/;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (
      /\.(ts|tsx|css)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("raw color ownership", () => {
  it("keeps hex/rgb/hsl literals out of business and component modules", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      if (ALLOWED.has(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (HEX.test(source) || RGB.test(source) || HSL.test(source)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
