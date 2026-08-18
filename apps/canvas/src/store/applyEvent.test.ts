import { describe, expect, it } from "vitest";
import {
  applyEnsembleEvent,
  packetEvent,
  statusEvent,
  type DomainSlice,
} from "./applyEvent";

const empty = (): DomainSlice => ({
  runtimes: {},
  bubbles: [],
  packets: [],
});

describe("applyEnsembleEvent", () => {
  it("applies seat.status", () => {
    const next = applyEnsembleEvent(
      empty(),
      statusEvent("ws", "seat_eng", "tooling", { current_action: "edit" }),
    );
    expect(next.runtimes.seat_eng.status).toBe("tooling");
    expect(next.runtimes.seat_eng.current_action).toBe("edit");
  });

  it("applies bubble upsert and resolve", () => {
    let s = applyEnsembleEvent(empty(), {
      type: "bubble.upsert",
      workspace_id: "ws",
      ts: "t",
      seat_id: "seat_rev",
      bubble_id: "b1",
      kind: "approve",
      priority: 0,
      title: "Gate",
      actions: ["approve", "reject"],
    });
    expect(s.bubbles).toHaveLength(1);
    s = applyEnsembleEvent(s, {
      type: "bubble.resolve",
      workspace_id: "ws",
      ts: "t",
      seat_id: "seat_rev",
      bubble_id: "b1",
      resolution: "approve",
    });
    expect(s.bubbles[0].resolved).toBe(true);
  });

  it("applies edge.packet flowing then clears on delivered", () => {
    let s = applyEnsembleEvent(
      empty(),
      packetEvent("ws", {
        edge_id: "e1",
        from: "a",
        to: "b",
        phase: "flowing",
        label: "brief",
      }),
    );
    expect(s.packets).toHaveLength(1);
    expect(s.packets[0].label).toBe("brief");
    s = applyEnsembleEvent(
      s,
      packetEvent("ws", {
        edge_id: "e1",
        from: "a",
        to: "b",
        phase: "delivered",
      }),
    );
    expect(s.packets).toHaveLength(0);
  });

  it("applies artifact.written and human.inject", () => {
    let s = applyEnsembleEvent(empty(), {
      type: "artifact.written",
      workspace_id: "ws",
      ts: "t",
      seat_id: "seat_eng",
      name: "02-output.md",
      version: 1,
    });
    expect(s.runtimes.seat_eng.outputs).toEqual(["02-output.md"]);
    s = applyEnsembleEvent(s, {
      type: "human.inject",
      workspace_id: "ws",
      ts: "t",
      seat_id: "seat_eng",
      inject_kind: "prompt_append",
      text: "more",
    });
    expect(s.runtimes.seat_eng.prompt).toContain("more");
  });
});
