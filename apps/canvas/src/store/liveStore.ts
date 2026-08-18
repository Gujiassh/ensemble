/**
 * Live runtime connection state (M2) — workspace list, SSE, group filter.
 * Domain org/runtimes still live in canvasStore; this module drives them.
 */
import type { EnsembleEvent, OrgSnapshot } from "@ensemble/protocol";
import { create } from "zustand";
import {
  bubbleAct,
  fetchOrg,
  fetchWorkspaces,
  humanInject,
  startRun,
  subscribeEvents,
  type WorkspaceInfo,
} from "../api/client";
import { useCanvasStore } from "./canvasStore";

function emptyRuntimes(org: OrgSnapshot): Record<string, { status: "idle"; history: string[]; outputs: string[] }> {
  const out: Record<string, { status: "idle"; history: string[]; outputs: string[] }> = {};
  const walk = (n: { id: string; kind: string; children?: typeof n[] }) => {
    if (n.kind === "seat") {
      out[n.id] = { status: "idle", history: ["live snapshot"], outputs: [] };
    }
    for (const c of n.children ?? []) walk(c);
  };
  walk(org.root);
  return out;
}

export interface LiveState {
  connected: boolean;
  source: "mock" | "live";
  workspaces: WorkspaceInfo[];
  workspaceId: string | null;
  runId: string | null;
  groupFilter: string | "all";
  error: string | null;
  unsub: (() => void) | null;

  bootstrapLive: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  setGroupFilter: (id: string | "all") => void;
  startLiveRun: (template: string) => Promise<void>;
  resolveLiveBubble: (
    bubbleId: string,
    action: "approve" | "reject",
  ) => Promise<void>;
  injectLivePrompt: (
    seatId: string,
    text: string,
    injectKind?: string,
  ) => Promise<void>;
  disconnect: () => void;
  switchToMock: () => void;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  connected: false,
  source: "mock",
  workspaces: [],
  workspaceId: null,
  runId: null,
  groupFilter: "all",
  error: null,
  unsub: null,

  disconnect: () => {
    get().unsub?.();
    set({ unsub: null, connected: false });
  },

  switchToMock: () => {
    get().disconnect();
    set({ source: "mock", workspaceId: null, runId: null, error: null });
    useCanvasStore.getState().loadFixture("single_agent");
  },

  bootstrapLive: async () => {
    try {
      const list = await fetchWorkspaces();
      set({ workspaces: list, source: "live", error: null });
      if (list[0]) await get().selectWorkspace(list[0].id);
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        source: "mock",
      });
    }
  },

  selectWorkspace: async (id) => {
    get().disconnect();
    try {
      const payload = await fetchOrg(id);
      const org = payload.org as OrgSnapshot;
      useCanvasStore.setState({
        org,
        runtimes: emptyRuntimes(org),
        bubbles: [],
        packets: [],
        collapsed: new Set(),
        selectedSeatId: null,
        focusRootId: null,
        focusTrail: [],
        playing: false,
        playStep: 0,
        lastPacketLabels: [],
        runName: `live:${id}`,
        fixtureId: "four_crew",
      });
      const unsub = subscribeEvents(id, (raw) => {
        if (typeof raw.workspace_id === "string" && raw.workspace_id !== id) {
          return;
        }
        const type = String(raw.type ?? "");
        if (
          type === "seat.status" ||
          type === "edge.packet" ||
          type === "bubble.upsert" ||
          type === "bubble.resolve" ||
          type === "artifact.written" ||
          type === "human.inject"
        ) {
          useCanvasStore
            .getState()
            .applyEvents([raw as unknown as EnsembleEvent]);
        }
        if (type === "run.stage" && typeof raw.run_id === "string") {
          set({ runId: raw.run_id });
        }
      });
      set({
        workspaceId: id,
        connected: true,
        unsub,
        source: "live",
        groupFilter: "all",
        runId: null,
        error: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        connected: false,
        workspaceId: null,
      });
    }
  },

  setGroupFilter: (id) => set({ groupFilter: id }),

  startLiveRun: async (template) => {
    const ws = get().workspaceId;
    if (!ws) throw new Error("no workspace");
    // Clear prior run chrome so old gates don't stack across runs.
    useCanvasStore.setState({ bubbles: [], packets: [] });
    const meta = await startRun(ws, {
      client_op_id: `op_${Date.now()}`,
      template,
      title: "live-run",
    });
    set({ runId: meta.run_id });
  },

  resolveLiveBubble: async (bubbleId, action) => {
    const { workspaceId, runId, source } = get();
    if (source !== "live") {
      useCanvasStore.getState().resolveBubble(bubbleId, action);
      return;
    }
    if (!workspaceId || !runId) {
      set({
        error: "Run not ready — wait for run.stage before approving",
      });
      return;
    }
    await bubbleAct(workspaceId, runId, bubbleId, {
      client_op_id: `op_${Date.now()}`,
      action,
    });
  },

  injectLivePrompt: async (seatId, text, injectKind = "prompt_replace") => {
    const { workspaceId, runId, source } = get();
    if (source !== "live") {
      useCanvasStore.getState().setPrompt(seatId, text);
      return;
    }
    if (!workspaceId || !runId) {
      set({ error: "Run not ready — start a run before inject" });
      return;
    }
    const out = await humanInject(workspaceId, runId, seatId, {
      client_op_id: `op_${Date.now()}`,
      inject_kind: injectKind,
      text,
    });
    if (out.prompt != null) {
      useCanvasStore.getState().setPrompt(seatId, out.prompt);
    }
  },
}));
