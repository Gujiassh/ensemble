import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "./canvasStore";

describe("badgeFor nested A4", () => {
  beforeEach(() => {
    useCanvasStore.getState().loadFixture("nested");
  });

  it("collapsed eng with tooling child → busy ≥ 1", () => {
    const s = useCanvasStore.getState();
    expect(s.collapsed.has("seat_eng")).toBe(true);
    expect(s.runtimes.seat_qa?.status).toBe("tooling");
    const badge = s.badgeFor("seat_eng");
    expect(badge.busy).toBeGreaterThanOrEqual(1);
  });

  it("open P0 bubble on descendant increments waiting", () => {
    // nested fixture already has approve bubble on seat_eng (parent),
    // but waiting rollup counts descendant seats only — add QA bubble
    useCanvasStore.setState({
      bubbles: [
        {
          bubble_id: "b_qa",
          seat_id: "seat_qa",
          kind: "approve",
          priority: 0,
          title: "QA gate",
          actions: ["approve", "reject"],
        },
      ],
    });
    const badge = useCanvasStore.getState().badgeFor("seat_eng");
    expect(badge.waiting).toBeGreaterThanOrEqual(1);
  });

  it("expanded parent hides rollup badge counts", () => {
    useCanvasStore.getState().toggleCollapse("seat_eng");
    const badge = useCanvasStore.getState().badgeFor("seat_eng");
    expect(badge).toEqual({ busy: 0, waiting: 0, error: 0 });
  });
});
