/** Ensemble protocol types — aligned with docs/10-events-schema.md and docs/11-ui-commands.md */

export type SeatStatus =
  | "idle"
  | "planning"
  | "working"
  | "tooling"
  | "waiting_human"
  | "waiting_peer"
  | "blocked"
  | "done"
  | "error";

export type NodeKind = "group" | "seat";

export type PacketPhase = "ready" | "flowing" | "delivered" | "rejected";

export type BubbleKind = "approve" | "ask" | "alert" | "status" | "chat";

export type CanvasMode = "stage" | "work" | "debug";

export type FixtureId = "single_agent" | "four_crew" | "nested" | "deep";

export interface OrgNode {
  id: string;
  kind: NodeKind;
  name: string;
  parent_id: string | null;
  role_template?: string | null;
  runner?: string | null;
  tags?: string[];
  children?: OrgNode[];
  /** Local mock fields (M1); runtime may ignore */
  prompt?: string;
  goal?: string;
  current_action?: string;
}

export interface OrgEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface OrgSnapshot {
  root: OrgNode;
  edges: OrgEdge[];
}

export interface Bubble {
  bubble_id: string;
  seat_id: string;
  kind: BubbleKind;
  priority: number;
  title: string;
  body?: string;
  actions?: string[];
  resolved?: boolean;
  resolution?: string;
}

export interface ActivePacket {
  edge_id: string;
  from_seat_id: string;
  to_seat_id: string;
  phase: PacketPhase;
  label?: string;
}

export interface SeatRuntime {
  status: SeatStatus;
  goal?: string;
  current_action?: string;
  prompt?: string;
  history: string[];
  outputs: string[];
}

export interface ParentBadge {
  busy: number;
  waiting: number;
  error: number;
}

export interface EventEnvelope {
  event_id?: string;
  type: string;
  workspace_id: string;
  ts: string;
  run_id?: string;
  seat_id?: string;
}

export interface SeatStatusEvent extends EventEnvelope {
  type: "seat.status";
  seat_id: string;
  status: SeatStatus;
  goal?: string;
  current_action?: string;
  runner?: string | null;
}

export interface EdgePacketEvent extends EventEnvelope {
  type: "edge.packet";
  edge_id: string;
  from_seat_id: string;
  to_seat_id: string;
  phase: PacketPhase;
  label?: string;
  artifact_id?: string;
}

export interface BubbleUpsertEvent extends EventEnvelope {
  type: "bubble.upsert";
  seat_id: string;
  bubble_id: string;
  kind: BubbleKind;
  priority: number;
  title: string;
  body?: string;
  actions?: string[];
}

export interface BubbleResolveEvent extends EventEnvelope {
  type: "bubble.resolve";
  seat_id: string;
  bubble_id: string;
  resolution: string;
  comment?: string;
}

export interface ArtifactWrittenEvent extends EventEnvelope {
  type: "artifact.written";
  seat_id: string;
  name: string;
  version?: number;
}

export interface HumanInjectEvent extends EventEnvelope {
  type: "human.inject";
  seat_id: string;
  inject_kind: string;
  text: string;
}

export type EnsembleEvent =
  | SeatStatusEvent
  | EdgePacketEvent
  | BubbleUpsertEvent
  | BubbleResolveEvent
  | ArtifactWrittenEvent
  | HumanInjectEvent;

/** Parent badge rollup (docs/10 §4.1) */
export function badgeBusy(status: SeatStatus): boolean {
  return status === "planning" || status === "working" || status === "tooling";
}

export function badgeWaiting(status: SeatStatus): boolean {
  return status === "waiting_human" || status === "waiting_peer";
}

export function badgeError(status: SeatStatus): boolean {
  return status === "error" || status === "blocked";
}

export function emptyBadge(): ParentBadge {
  return { busy: 0, waiting: 0, error: 0 };
}

/** Aggregate seat statuses (+ optional open p0 bubbles) for a folded subtree. */
export function rollupBadge(
  statuses: SeatStatus[],
  openP0BubbleCount = 0,
): ParentBadge {
  const badge = emptyBadge();
  for (const s of statuses) {
    if (badgeBusy(s)) badge.busy += 1;
    if (badgeWaiting(s)) badge.waiting += 1;
    if (badgeError(s)) badge.error += 1;
  }
  badge.waiting += openP0BubbleCount;
  return badge;
}

export function walkSeats(node: OrgNode, out: OrgNode[] = []): OrgNode[] {
  if (node.kind === "seat") out.push(node);
  for (const child of node.children ?? []) walkSeats(child, out);
  return out;
}

export function findNode(root: OrgNode, id: string): OrgNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export function collectDescendantSeats(node: OrgNode): OrgNode[] {
  const out: OrgNode[] = [];
  for (const child of node.children ?? []) walkSeats(child, out);
  return out;
}
