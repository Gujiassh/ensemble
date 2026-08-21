import { describe, expect, it } from "vitest";
import { createMemoryPreferenceAdapter } from "./adapter";
import { DEFAULT_DEVICE_PREFERENCES, validateDevicePreferences } from "./schema";

describe("device preferences", () => {
  it("returns defaults for invalid payloads and records diagnostics", () => {
    const result = validateDevicePreferences({
      schemaVersion: 99,
      theme: "neon",
      projectPath: "/tmp/secret",
      outputLocale: "zh-CN",
    });

    expect(result.preferences).toEqual(DEFAULT_DEVICE_PREFERENCES);
    expect(result.diagnostics.map((item) => item.field)).toEqual(
      expect.arrayContaining(["schemaVersion", "theme", "projectPath", "outputLocale"]),
    );
  });

  it("accepts a valid device-only payload", () => {
    const result = validateDevicePreferences({
      schemaVersion: 1,
      theme: "dark",
      density: "compact",
      motion: "reduced",
      contrast: "high",
      uiLocale: "en-US",
      lastWorkspaceId: "ws_1",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.preferences.theme).toBe("dark");
    expect(result.preferences.uiLocale).toBe("en-US");
  });

  it("reads writes and resets through the adapter", async () => {
    const adapter = createMemoryPreferenceAdapter();
    await adapter.write({
      ...DEFAULT_DEVICE_PREFERENCES,
      theme: "dark",
      uiLocale: "en-US",
    });

    const read = await adapter.read();
    expect(read.preferences.theme).toBe("dark");
    expect(read.preferences.uiLocale).toBe("en-US");

    await adapter.reset();
    const reset = await adapter.read();
    expect(reset.preferences).toEqual(DEFAULT_DEVICE_PREFERENCES);
  });

  it("rejects Workspace and Run fields at the adapter write boundary", async () => {
    const adapter = createMemoryPreferenceAdapter();
    const unsafe = {
      ...DEFAULT_DEVICE_PREFERENCES,
      projectPath: "/private/project",
      runId: "run_1",
    };

    await expect(adapter.write(unsafe)).rejects.toThrow(/projectPath/);
  });
});
