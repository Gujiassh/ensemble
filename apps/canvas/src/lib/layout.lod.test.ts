import { describe, expect, it } from "vitest";
import { FIXTURES } from "../fixtures";
import { buildFlowGraph } from "./layout";
import { lodLevel } from "./lod";

describe("buildFlowGraph LOD + collapse", () => {
  it("collapsed nested eng hides children nodes", () => {
    const f = FIXTURES.nested;
    const graph = buildFlowGraph(f.org.root, f.org.edges, {
      collapsed: new Set(f.collapsedIds),
      focusRootId: null,
      seatStatus: () => "idle",
      seatMeta: () => ({}),
      badgeFor: () => ({ busy: 0, waiting: 0, error: 0 }),
      highlightedSeatIds: new Set(),
      highlightedEdgeIds: new Set(),
      packets: new Map(),
      intensity: "stage",
    });
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.has("seat_eng")).toBe(true);
    // children of collapsed eng must not appear (fixture: seat_junior under eng)
    expect(ids.has("seat_qa")).toBe(false);
    expect([...ids].some((id) => id.startsWith("nest_"))).toBe(false);
  });

  it("flowingBudget suppresses excess packet motion flags", () => {
    const f = FIXTURES.four_crew;
    const packets = new Map(
      f.org.edges.map((e) => [e.id, { phase: "flowing" as const, label: e.id }]),
    );
    const lod = lodLevel(50); // reduced → budget 4
    const graph = buildFlowGraph(f.org.root, f.org.edges, {
      collapsed: new Set(),
      focusRootId: null,
      seatStatus: () => "idle",
      seatMeta: () => ({}),
      badgeFor: () => ({ busy: 0, waiting: 0, error: 0 }),
      highlightedSeatIds: new Set(),
      highlightedEdgeIds: new Set(),
      packets,
      intensity: "stage",
      flowingBudget: lod.maxFlowingPackets,
    });
    const suppressed = graph.edges.filter((e) => e.data?.lodSuppressMotion).length;
    const animated = graph.edges.filter((e) => e.animated).length;
    expect(animated).toBeLessThanOrEqual(4);
    expect(suppressed + animated).toBe(graph.edges.length);
  });
});
