import {
  collectDescendantSeats,
  findNode,
  rollupBadge,
  type ActivePacket,
  type Bubble,
  type CanvasMode,
  type FixtureId,
  type OrgSnapshot,
  type ParentBadge,
  type SeatRuntime,
  type SeatStatus,
  type EnsembleEvent,
} from "@ensemble/protocol";
import { create } from "zustand";
import { FIXTURES, FOUR_HANDOFF_STEPS } from "../fixtures";
import { lodLevel, type LodState } from "../lib/lod";
import {
  applyEnsembleEvent,
  bubbleUpsertEvent,
  packetEvent,
  statusEvent,
  type DomainSlice,
} from "./applyEvent";

const WS = "ws_mock";

export interface CanvasState {
  fixtureId: FixtureId;
  mode: CanvasMode;
  runName: string;
  org: OrgSnapshot;
  runtimes: Record<string, SeatRuntime>;
  bubbles: Bubble[];
  packets: ActivePacket[];
  collapsed: Set<string>;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
  focusRootId: string | null;
  focusTrail: string[];
  playing: boolean;
  playStep: number;
  lastPacketLabels: string[];
  reducedMotion: boolean;
  lod: LodState;
  visibleNodeCount: number;

  loadFixture: (id: FixtureId) => void;
  setMode: (mode: CanvasMode) => void;
  selectSeat: (id: string | null) => void;
  setHoveredSeat: (id: string | null) => void;
  toggleCollapse: (id: string) => void;
  focusNode: (id: string) => void;
  focusUp: () => void;
  setPrompt: (seatId: string, prompt: string) => void;
  resolveBubble: (bubbleId: string, resolution: "approve" | "reject") => void;
  playHandoff: () => void;
  stopPlayback: () => void;
  advancePlaybackTick: () => void;
  applyEvents: (events: Parameters<typeof applyEnsembleEvent>[1][]) => void;
  getSeatRuntime: (id: string) => SeatRuntime;
  badgeFor: (nodeId: string) => ParentBadge;
  setReducedMotion: (v: boolean) => void;
  setLodFromVisibleCount: (n: number) => void;
}

function cloneRuntimes(
  src: Record<string, SeatRuntime>,
): Record<string, SeatRuntime> {
  const out: Record<string, SeatRuntime> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = {
      ...v,
      history: [...v.history],
      outputs: [...v.outputs],
    };
  }
  return out;
}

function bundleToState(id: FixtureId) {
  const b = FIXTURES[id];
  return {
    fixtureId: id,
    runName: b.runName,
    org: structuredClone(b.org),
    runtimes: cloneRuntimes(b.runtimes),
    bubbles: structuredClone(b.bubbles),
    packets: [] as ActivePacket[],
    collapsed: new Set(b.collapsedIds),
    selectedSeatId: null as string | null,
    hoveredSeatId: null as string | null,
    focusRootId: null as string | null,
    focusTrail: [] as string[],
    playing: false,
    playStep: 0,
    lastPacketLabels: [] as string[],
  };
}

const initial = bundleToState("single_agent");

function domainOf(s: {
  runtimes: Record<string, SeatRuntime>;
  bubbles: Bubble[];
  packets: ActivePacket[];
}): DomainSlice {
  return {
    runtimes: s.runtimes,
    bubbles: s.bubbles,
    packets: s.packets,
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  ...initial,
  mode: "stage",
  reducedMotion: false,
  visibleNodeCount: 0,
  lod: lodLevel(0),

  loadFixture: (id) => {
    set({ ...bundleToState(id), mode: get().mode });
  },

  setMode: (mode) => set({ mode }),

  selectSeat: (id) => set({ selectedSeatId: id }),

  setHoveredSeat: (id) => set({ hoveredSeatId: id }),

  toggleCollapse: (id) => {
    const next = new Set(get().collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ collapsed: next });
  },

  focusNode: (id) => {
    const { focusTrail, focusRootId } = get();
    const trail = focusRootId ? [...focusTrail, focusRootId] : [...focusTrail];
    set({ focusRootId: id, focusTrail: trail, selectedSeatId: id });
  },

  focusUp: () => {
    const { focusTrail } = get();
    if (focusTrail.length === 0) {
      set({ focusRootId: null });
      return;
    }
    const trail = [...focusTrail];
    const parent = trail.pop()!;
    set({ focusRootId: trail.length ? parent : null, focusTrail: trail });
  },

  setPrompt: (seatId, prompt) => {
    const runtimes = { ...get().runtimes };
    const rt = runtimes[seatId] ?? {
      status: "idle" as SeatStatus,
      history: [],
      outputs: [],
    };
    runtimes[seatId] = {
      ...rt,
      prompt,
      history: [...rt.history, `prompt.inject len=${prompt.length}`],
    };
    set({ runtimes });
  },

  applyEvents: (events) => {
    let slice = domainOf(get());
    for (const ev of events) {
      slice = applyEnsembleEvent(slice, ev);
    }
    set({
      runtimes: slice.runtimes,
      bubbles: slice.bubbles,
      packets: slice.packets,
    });
  },

  resolveBubble: (bubbleId, resolution) => {
    const hit = get().bubbles.find((b) => b.bubble_id === bubbleId);
    if (!hit) return;
    const nextStatus: SeatStatus =
      resolution === "approve" ? "done" : "working";
    get().applyEvents([
      {
        type: "bubble.resolve",
        workspace_id: WS,
        ts: new Date().toISOString(),
        seat_id: hit.seat_id,
        bubble_id: bubbleId,
        resolution,
      },
      statusEvent(WS, hit.seat_id, nextStatus, {
        current_action:
          resolution === "approve" ? "Approved" : "Rework requested",
      }),
    ]);
    const runtimes = { ...get().runtimes };
    const rt = runtimes[hit.seat_id];
    if (rt) {
      runtimes[hit.seat_id] = {
        ...rt,
        outputs: [
          ...rt.outputs,
          resolution === "approve" ? "gate-approved.md" : "rework-notes.md",
        ],
      };
      set({ runtimes });
    }
  },

  playHandoff: () => {
    if (get().fixtureId !== "four_crew") {
      get().loadFixture("four_crew");
    }
    set({
      playing: true,
      playStep: 0,
      packets: [],
      lastPacketLabels: [],
      bubbles: [],
      runtimes: cloneRuntimes(FIXTURES.four_crew.runtimes),
    });
  },

  stopPlayback: () => set({ playing: false }),

  advancePlaybackTick: () => {
    const { playing, playStep, lastPacketLabels } = get();
    if (!playing) return;

    const step = FOUR_HANDOFF_STEPS[playStep];
    if (!step) {
      set({ playing: false, packets: [] });
      return;
    }

    const events: EnsembleEvent[] = [
      statusEvent(WS, step.from, step.fromStatus, {
        current_action: `Sending ${step.label}`,
      }),
    ];

    if (step.to !== step.from) {
      events.push(
        statusEvent(WS, step.to, step.toStatus, {
          current_action: `Receiving ${step.label}`,
        }),
        packetEvent(WS, {
          edge_id: step.edge_id,
          from: step.from,
          to: step.to,
          phase: "flowing",
          label: step.label,
        }),
      );
    } else {
      // review gate: keep packet on inbound eng→rev edge with review label
      events.push(
        packetEvent(WS, {
          edge_id: step.edge_id,
          from: "seat_eng",
          to: "seat_rev",
          phase: "flowing",
          label: step.label,
        }),
      );
    }

    if ("bubble" in step && step.bubble) {
      events.push(
        statusEvent(WS, "seat_eng", "done", {
          current_action: "Patch delivered",
        }),
        statusEvent(WS, "seat_rev", "waiting_human", {
          current_action: "Awaiting human gate",
        }),
        bubbleUpsertEvent(WS, {
          bubble_id: "b_rev_approve",
          seat_id: "seat_rev",
          kind: "approve",
          priority: 0,
          title: "Approve review gate?",
          body: "Reviewer finished reading the patch.",
          actions: ["approve", "reject"],
        }),
      );
    } else {
      events.push(
        statusEvent(WS, step.from, step.doneFrom, {
          current_action: `Sent ${step.label}`,
        }),
      );
    }

    get().applyEvents(events);

    // mock outputs for eng on patch step
    if (step.label === "patch") {
      const runtimes = { ...get().runtimes };
      const eng = runtimes.seat_eng;
      if (eng) {
        runtimes.seat_eng = {
          ...eng,
          outputs: eng.outputs.includes("03-patch.diff")
            ? eng.outputs
            : [...eng.outputs, "03-patch.diff"],
        };
        set({ runtimes });
      }
    }
    if (step.label === "review") {
      const runtimes = { ...get().runtimes };
      const rev = runtimes.seat_rev;
      if (rev) {
        runtimes.seat_rev = {
          ...rev,
          outputs: rev.outputs.includes("04-review.md")
            ? rev.outputs
            : [...rev.outputs, "04-review.md"],
        };
        set({ runtimes });
      }
    }

    set({
      lastPacketLabels: [...lastPacketLabels, step.label],
      playStep: playStep + 1,
      playing: playStep + 1 < FOUR_HANDOFF_STEPS.length,
    });
  },

  getSeatRuntime: (id) => {
    return (
      get().runtimes[id] ?? {
        status: "idle",
        history: [],
        outputs: [],
      }
    );
  },

  badgeFor: (nodeId) => {
    const { org, runtimes, bubbles, collapsed } = get();
    const node = findNode(org.root, nodeId);
    if (!node) return { busy: 0, waiting: 0, error: 0 };
    if (!collapsed.has(nodeId)) return { busy: 0, waiting: 0, error: 0 };
    const seats = collectDescendantSeats(node);
    const statuses = seats.map(
      (s) => runtimes[s.id]?.status ?? ("idle" as SeatStatus),
    );
    const openP0 = bubbles.filter(
      (b) =>
        !b.resolved &&
        b.priority === 0 &&
        seats.some((s) => s.id === b.seat_id),
    ).length;
    return rollupBadge(statuses, openP0);
  },

  setReducedMotion: (v) => set({ reducedMotion: v }),

  setLodFromVisibleCount: (n) => {
    if (get().visibleNodeCount === n) return;
    set({ visibleNodeCount: n, lod: lodLevel(n) });
  },
}));
