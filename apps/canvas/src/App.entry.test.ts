import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production entry boundaries", () => {
  it("uses the unavailable gateway and never imports the test adapter", () => {
    const entry = readFileSync(path.resolve(__dirname, "./App.tsx"), "utf8");
    expect(entry).toContain("createUnavailableGateway");
    expect(entry).not.toContain("createTestGateway");
    expect(entry).not.toContain("fixtures");
    expect(entry).not.toContain("TopBar");
    expect(entry).not.toContain("TodoTray");
    expect(entry).not.toContain("DossierDrawer");
  });
});
