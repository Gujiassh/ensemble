import { describe, expect, it } from "vitest";
import { lodLevel } from "./lod";

describe("lodLevel", () => {
  it("full at ≤40", () => {
    expect(lodLevel(40).tier).toBe("full");
    expect(lodLevel(40).allowPacketMotion).toBe(true);
  });

  it("reduced at 41–80", () => {
    const s = lodLevel(41);
    expect(s.tier).toBe("reduced");
    expect(s.maxFlowingPackets).toBe(4);
  });

  it("static above 80", () => {
    const s = lodLevel(81);
    expect(s.tier).toBe("static");
    expect(s.allowPacketMotion).toBe(false);
  });

  it("warn above 200", () => {
    const s = lodLevel(201);
    expect(s.tier).toBe("warn");
    expect(s.showCollapseHint).toBe(true);
  });
});
