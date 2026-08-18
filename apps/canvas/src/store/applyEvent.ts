/**
 * Pure event apply helpers — shared by M1 mock playback and M2 SSE.
 * Mutates a draft snapshot of canvas domain fields only (not UI chrome).
 */
import type {
  ActivePacket,
  ArtifactWrittenEvent,
  Bubble,
  BubbleResolveEvent,
  BubbleUpsertEvent,
  EdgePacketEvent,
  EnsembleEvent,
  HumanInjectEvent,
  SeatRuntime,
  SeatStatus,
  SeatStatusEvent,
} from "@ensemble/protocol";

export interface DomainSlice {
  runtimes: Record<string, SeatRuntime>;
  bubbles: Bubble[];
  packets: ActivePacket[];
}

function ensureRuntime(
  runtimes: Record<string, SeatRuntime>,
  seatId: string,
): SeatRuntime {
  return (
    runtimes[seatId] ?? {
      status: "idle",
      history: [],
      outputs: [],
    }
  );
}

/** Apply one protocol event onto domain state; returns a new slice. */
export function applyEnsembleEvent(
  state: DomainSlice,
  event: EnsembleEvent,
): DomainSlice {
  const runtimes = { ...state.runtimes };
  let bubbles = [...state.bubbles];
  let packets = [...state.packets];

  switch (event.type) {
    case "seat.status": {
      const ev = event as SeatStatusEvent;
      const rt = ensureRuntime(runtimes, ev.seat_id);
      runtimes[ev.seat_id] = {
        ...rt,
        status: ev.status,
        goal: ev.goal ?? rt.goal,
        current_action: ev.current_action ?? rt.current_action,
        history: [
          ...rt.history,
          `seat.status=${ev.status}${ev.current_action ? ` action=${ev.current_action}` : ""}`,
        ],
      };
      break;
    }
    case "edge.packet": {
      const ev = event as EdgePacketEvent;
      const others = packets.filter((p) => p.edge_id !== ev.edge_id);
      if (ev.phase === "delivered" || ev.phase === "rejected") {
        packets = others;
      } else {
        packets = [
          ...others,
          {
            edge_id: ev.edge_id,
            from_seat_id: ev.from_seat_id,
            to_seat_id: ev.to_seat_id,
            phase: ev.phase,
            label: ev.label,
          },
        ];
      }
      break;
    }
    case "bubble.upsert": {
      const ev = event as BubbleUpsertEvent;
      const rest = bubbles.filter((b) => b.bubble_id !== ev.bubble_id);
      bubbles = [
        ...rest,
        {
          bubble_id: ev.bubble_id,
          seat_id: ev.seat_id,
          kind: ev.kind,
          priority: ev.priority,
          title: ev.title,
          body: ev.body,
          actions: ev.actions,
        },
      ];
      break;
    }
    case "bubble.resolve": {
      const ev = event as BubbleResolveEvent;
      bubbles = bubbles.map((b) =>
        b.bubble_id === ev.bubble_id
          ? {
              ...b,
              resolved: true,
              resolution: ev.resolution,
            }
          : b,
      );
      break;
    }
    case "artifact.written": {
      const ev = event as ArtifactWrittenEvent;
      const rt = ensureRuntime(runtimes, ev.seat_id);
      const name = ev.name;
      const outputs = rt.outputs.includes(name)
        ? rt.outputs
        : [...rt.outputs, name];
      runtimes[ev.seat_id] = {
        ...rt,
        outputs,
        history: [
          ...rt.history,
          `artifact.written=${name}${ev.version != null ? ` v=${ev.version}` : ""}`,
        ],
      };
      break;
    }
    case "human.inject": {
      const ev = event as HumanInjectEvent;
      const rt = ensureRuntime(runtimes, ev.seat_id);
      const nextPrompt =
        ev.inject_kind === "prompt_replace"
          ? ev.text
          : [rt.prompt ?? "", ev.text].filter(Boolean).join("\n");
      runtimes[ev.seat_id] = {
        ...rt,
        prompt: nextPrompt,
        history: [
          ...rt.history,
          `human.inject kind=${ev.inject_kind} len=${ev.text.length}`,
        ],
      };
      break;
    }
    default:
      break;
  }

  return { runtimes, bubbles, packets };
}

export function statusEvent(
  workspaceId: string,
  seatId: string,
  status: SeatStatus,
  extra?: { goal?: string; current_action?: string; run_id?: string },
): SeatStatusEvent {
  return {
    type: "seat.status",
    workspace_id: workspaceId,
    ts: new Date().toISOString(),
    seat_id: seatId,
    status,
    goal: extra?.goal,
    current_action: extra?.current_action,
    run_id: extra?.run_id,
  };
}

export function packetEvent(
  workspaceId: string,
  opts: {
    edge_id: string;
    from: string;
    to: string;
    phase: ActivePacket["phase"];
    label?: string;
    run_id?: string;
  },
): EdgePacketEvent {
  return {
    type: "edge.packet",
    workspace_id: workspaceId,
    ts: new Date().toISOString(),
    edge_id: opts.edge_id,
    from_seat_id: opts.from,
    to_seat_id: opts.to,
    phase: opts.phase,
    label: opts.label,
    run_id: opts.run_id,
  };
}

export function bubbleUpsertEvent(
  workspaceId: string,
  bubble: Bubble,
  runId?: string,
): BubbleUpsertEvent {
  return {
    type: "bubble.upsert",
    workspace_id: workspaceId,
    ts: new Date().toISOString(),
    seat_id: bubble.seat_id,
    bubble_id: bubble.bubble_id,
    kind: bubble.kind,
    priority: bubble.priority,
    title: bubble.title,
    body: bubble.body,
    actions: bubble.actions,
    run_id: runId,
  };
}
