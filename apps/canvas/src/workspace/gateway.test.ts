import { describe, expect, it } from "vitest";
import { createTestGateway } from "../test-support/gateway";
import { createUnavailableGateway } from "./gateway";

describe("workspace gateway seam", () => {
  it("production unavailable gateway never claims persistence", async () => {
    const gateway = createUnavailableGateway();
    const connection = await gateway.getConnectionState();
    expect(connection.status).toBe("unavailable");

    const created = await gateway.createWorkspace({
      name: "Demo",
      projectPath: "/tmp/demo",
      runnerProfileId: "pi",
      defaultOutputLocale: "zh-CN",
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.code).toBe("runtime_unavailable");
    }

    expect(await gateway.listWorkspaces()).toEqual([]);
    const profiles: unknown[] = [];
    await gateway.probeRunnerProfiles((profile) => profiles.push(profile));
    expect(profiles).toEqual([]);
  });

  it("test adapter is deterministic and injectable", async () => {
    const gateway = createTestGateway({
      runners: [
        {
          id: "pi",
          displayName: "pi",
          status: "available",
          capabilities: ["code"],
          version: "1.2.3",
        },
        {
          id: "other",
          displayName: "other",
          status: "missing",
          capabilities: [],
        },
      ],
    });

    const created = await gateway.createWorkspace({
      name: "Alpha",
      projectPath: "/tmp/alpha",
      runnerProfileId: "pi",
      defaultOutputLocale: "en-US",
    });
    expect(created).toEqual({ ok: true, workspaceId: "ws_1" });
    const workspaces = await gateway.listWorkspaces();
    expect(workspaces[0]?.defaultOutputLocale).toBe("en-US");
  });

  it("delivers runner probe results independently", async () => {
    const gateway = createTestGateway({
      runners: [
        { id: "slow", displayName: "Slow", status: "missing", capabilities: [] },
        { id: "pi", displayName: "pi", status: "available", capabilities: ["code"] },
      ],
      runnerDelaysMs: { slow: 30, pi: 0 },
    });
    const received: string[] = [];

    await gateway.probeRunnerProfiles((profile) => received.push(profile.id));

    expect(received).toEqual(["pi", "slow"]);
  });
});
