import {
  findNode,
  type OrgEdge,
  type OrgNode,
  type PacketPhase,
  type SeatStatus,
} from "@ensemble/protocol";
import type { Edge, Node } from "@xyflow/react";

export type SeatNodeData = {
  kind: "seat";
  org: OrgNode;
  status: SeatStatus;
  goal?: string;
  current_action?: string;
  badge?: { busy: number; waiting: number; error: number };
  collapsed: boolean;
  hasChildren: boolean;
  highlighted: boolean;
};

export type GroupNodeData = {
  kind: "group";
  org: OrgNode;
  collapsed: boolean;
  hasChildren: boolean;
  width: number;
  height: number;
};

export type CanvasNodeData = SeatNodeData | GroupNodeData;

export type PacketEdgeData = {
  label?: string;
  phase?: PacketPhase;
  highlighted?: boolean;
  intensity?: "stage" | "work";
  lodSuppressMotion?: boolean;
};

const SEAT_W = 140;
const SEAT_H = 130;
const GROUP_PAD_X = 36;
const GROUP_PAD_Y = 48;
const GAP = 36;

type Pos = { id: string; x: number; y: number; parentId?: string };

function sizeSubtree(
  node: OrgNode,
  collapsed: Set<string>,
): { w: number; h: number } {
  const kids = node.children ?? [];
  if (kids.length === 0 || collapsed.has(node.id)) {
    return node.kind === "group"
      ? { w: 200, h: 72 }
      : { w: SEAT_W, h: SEAT_H };
  }
  let w = 0;
  let maxChildH = 0;
  for (const child of kids) {
    const s = sizeSubtree(child, collapsed);
    w += s.w + GAP;
    maxChildH = Math.max(maxChildH, s.h);
  }
  w = Math.max(w - GAP, SEAT_W) + GROUP_PAD_X * 2;
  const h = GROUP_PAD_Y + maxChildH + 24;
  return { w, h };
}

function place(
  node: OrgNode,
  x: number,
  y: number,
  collapsed: Set<string>,
  parentId: string | undefined,
  out: Pos[],
): void {
  out.push({ id: node.id, x, y, parentId });
  const kids = node.children ?? [];
  if (kids.length === 0 || collapsed.has(node.id)) return;

  let cursorX = GROUP_PAD_X;
  const childY = GROUP_PAD_Y;
  for (const child of kids) {
    // child positions are relative when parent is a group frame
    const relParent = node.kind === "group" ? node.id : parentId;
    const absX = node.kind === "group" ? cursorX : x + cursorX;
    const absY = node.kind === "group" ? childY : y + childY;
    if (node.kind === "group") {
      place(child, absX, absY, collapsed, relParent, out);
    } else {
      place(child, absX, absY, collapsed, undefined, out);
    }
    cursorX += sizeSubtree(child, collapsed).w + GAP;
  }
}

function collectVisible(
  node: OrgNode,
  collapsed: Set<string>,
  out: Set<string>,
): void {
  out.add(node.id);
  if (collapsed.has(node.id)) return;
  for (const c of node.children ?? []) collectVisible(c, collapsed, out);
}

/** Tree layout → xyflow nodes. Groups become parent frames for children. */
export function buildFlowGraph(
  root: OrgNode,
  edges: OrgEdge[],
  opts: {
    collapsed: Set<string>;
    focusRootId: string | null;
    seatStatus: (id: string) => SeatStatus;
    seatMeta: (id: string) => { goal?: string; current_action?: string };
    badgeFor: (id: string) => { busy: number; waiting: number; error: number };
    highlightedSeatIds: Set<string>;
    highlightedEdgeIds: Set<string>;
    packets: Map<string, { label?: string; phase?: PacketPhase }>;
    intensity: "stage" | "work";
    lodSuppressMotion?: boolean;
    flowingBudget?: number;
  },
): { nodes: Node<CanvasNodeData>[]; edges: Edge<PacketEdgeData>[] } {
  const focusRoot =
    (opts.focusRootId && findNode(root, opts.focusRootId)) || root;

  const positions: Pos[] = [];
  place(focusRoot, 40, 40, opts.collapsed, undefined, positions);
  const posMap = new Map(positions.map((p) => [p.id, p]));

  const visible = new Set<string>();
  collectVisible(focusRoot, opts.collapsed, visible);

  const nodes: Node<CanvasNodeData>[] = [];
  for (const id of visible) {
    const org = findNode(root, id) ?? findNode(focusRoot, id);
    if (!org) continue;
    const pos = posMap.get(id) ?? { id, x: 0, y: 0 };
    const hasChildren = (org.children?.length ?? 0) > 0;

    if (org.kind === "group") {
      const size = sizeSubtree(org, opts.collapsed);
      nodes.push({
        id,
        type: "groupNode",
        position: { x: pos.x, y: pos.y },
        data: {
          kind: "group",
          org,
          collapsed: opts.collapsed.has(id),
          hasChildren,
          width: size.w,
          height: size.h,
        },
        style: {
          width: size.w,
          height: opts.collapsed.has(id) ? 72 : size.h,
        },
        zIndex: 0,
      });
    } else {
      const meta = opts.seatMeta(id);
      const n: Node<SeatNodeData> = {
        id,
        type: "seatNode",
        position: { x: pos.x, y: pos.y },
        data: {
          kind: "seat",
          org,
          status: opts.seatStatus(id),
          goal: meta.goal,
          current_action: meta.current_action,
          badge: opts.collapsed.has(id) ? opts.badgeFor(id) : undefined,
          collapsed: opts.collapsed.has(id),
          hasChildren,
          highlighted: opts.highlightedSeatIds.has(id),
        },
        zIndex: 1,
      };
      if (pos.parentId && visible.has(pos.parentId)) {
        n.parentId = pos.parentId;
        n.extent = "parent";
      }
      nodes.push(n);
    }
  }

  // Parents before children for xyflow
  nodes.sort((a, b) => {
    const ap = a.type === "groupNode" ? 0 : 1;
    const bp = b.type === "groupNode" ? 0 : 1;
    return ap - bp;
  });

  const flowEdges: Edge<PacketEdgeData>[] = [];
  let flowingUsed = 0;
  const budget = opts.flowingBudget ?? Infinity;
  for (const e of edges) {
    if (!visible.has(e.from) || !visible.has(e.to)) continue;
    const pkt = opts.packets.get(e.id);
    const isFlowing = pkt?.phase === "flowing";
    let suppress = Boolean(opts.lodSuppressMotion);
    if (isFlowing && !suppress) {
      if (flowingUsed >= budget) suppress = true;
      else flowingUsed += 1;
    }
    flowEdges.push({
      id: e.id,
      source: e.from,
      target: e.to,
      type: "packetEdge",
      data: {
        label: pkt?.label,
        phase: pkt?.phase,
        highlighted: opts.highlightedEdgeIds.has(e.id),
        intensity: opts.intensity,
        lodSuppressMotion: suppress,
      },
      animated: isFlowing && !suppress,
      zIndex: 2,
    });
  }

  return { nodes, edges: flowEdges };
}
