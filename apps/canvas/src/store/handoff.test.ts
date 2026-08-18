import { describe, expect, it, beforeEach } from "vitest";
import { useCanvasStore } from "./canvasStore";

describe("four-crew handoff labels", () => {
  beforeEach(() => {
    useCanvasStore.getState().loadFixture("four_crew");
  });

  it("plays brief → research → patch → review in order", () => {
    const s = useCanvasStore.getState();
    s.playHandoff();
    // drain ticks
    for (let i = 0; i < 8; i++) {
      useCanvasStore.getState().advancePlaybackTick();
      if (!useCanvasStore.getState().playing) break;
    }
    expect(useCanvasStore.getState().lastPacketLabels).toEqual([
      "brief",
      "research",
      "patch",
      "review",
    ]);
    const bubbles = useCanvasStore.getState().bubbles.filter((b) => !b.resolved);
    expect(bubbles.some((b) => b.kind === "approve")).toBe(true);
  });
});
