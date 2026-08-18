import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";
import { BubbleLayer } from "../bubbles/BubbleLayer";
import { PacketEdge } from "../edges/PacketEdge";
import { buildFlowGraph } from "../lib/layout";
import { GroupNode } from "../nodes/GroupNode";
import { SeatNode } from "../nodes/SeatNode";
import { findNode } from "@ensemble/protocol";
import { useCanvasStore } from "../store/canvasStore";
import { useLiveStore } from "../store/liveStore";
import { HoverCard } from "./HoverCard";

const nodeTypes: NodeTypes = {
  seatNode: SeatNode,
  groupNode: GroupNode,
};

const edgeTypes: EdgeTypes = {
  packetEdge: PacketEdge,
};

function OrgCanvasInner() {
  const org = useCanvasStore((s) => s.org);
  const collapsed = useCanvasStore((s) => s.collapsed);
  const focusRootId = useCanvasStore((s) => s.focusRootId);
  const runtimes = useCanvasStore((s) => s.runtimes);
  const packets = useCanvasStore((s) => s.packets);
  const hoveredSeatId = useCanvasStore((s) => s.hoveredSeatId);
  const mode = useCanvasStore((s) => s.mode);
  const selectSeat = useCanvasStore((s) => s.selectSeat);
  const groupFilter = useLiveStore((s) => s.groupFilter);
  const lodAllowMotion = useCanvasStore((s) => s.lod.allowPacketMotion);
  const lodMaxFlowing = useCanvasStore((s) => s.lod.maxFlowingPackets);
  const lodTier = useCanvasStore((s) => s.lod.tier);
  const lodVisible = useCanvasStore((s) => s.lod.visibleCount);
  const lodShowHint = useCanvasStore((s) => s.lod.showCollapseHint);
  const setLodFromVisibleCount = useCanvasStore((s) => s.setLodFromVisibleCount);

  const highlightedEdgeIds = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredSeatId) return set;
    for (const e of org.edges) {
      if (e.from === hoveredSeatId || e.to === hoveredSeatId) set.add(e.id);
    }
    return set;
  }, [hoveredSeatId, org.edges]);

  const highlightedSeatIds = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredSeatId) return set;
    set.add(hoveredSeatId);
    for (const e of org.edges) {
      if (e.from === hoveredSeatId) set.add(e.to);
      if (e.to === hoveredSeatId) set.add(e.from);
    }
    return set;
  }, [hoveredSeatId, org.edges]);

  const packetMap = useMemo(() => {
    const m = new Map<
      string,
      { label?: string; phase?: import("@ensemble/protocol").PacketPhase }
    >();
    for (const p of packets) {
      m.set(p.edge_id, { label: p.label, phase: p.phase });
    }
    return m;
  }, [packets]);

  const layoutRoot = useMemo(() => {
    if (groupFilter === "all") return org.root;
    const g = findNode(org.root, groupFilter);
    return g ?? org.root;
  }, [org, groupFilter]);

  const graph = useMemo(
    () =>
      buildFlowGraph(layoutRoot, org.edges, {
        collapsed,
        focusRootId: groupFilter === "all" ? focusRootId : null,
        seatStatus: (id) => runtimes[id]?.status ?? "idle",
        seatMeta: (id) => ({
          goal: runtimes[id]?.goal,
          current_action: runtimes[id]?.current_action,
        }),
        badgeFor: (id) => useCanvasStore.getState().badgeFor(id),
        highlightedSeatIds,
        highlightedEdgeIds,
        packets: packetMap,
        intensity: mode === "work" ? "work" : "stage",
        lodSuppressMotion: !lodAllowMotion,
        flowingBudget: lodMaxFlowing,
      }),
    [
      org,
      layoutRoot,
      groupFilter,
      collapsed,
      focusRootId,
      runtimes,
      highlightedSeatIds,
      highlightedEdgeIds,
      packetMap,
      mode,
      lodAllowMotion,
      lodMaxFlowing,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    const n = graph.nodes.length;
    if (n !== lodVisible) setLodFromVisibleCount(n);
  }, [graph.nodes.length, lodVisible, setLodFromVisibleCount]);

  return (
    <div className={`org-canvas mode-${mode}`}>
      {lodShowHint ? (
        <div className="lod-banner" role="status">
          Visible nodes {lodVisible} — fold subtrees or focus a child canvas (LOD warn).
        </div>
      ) : lodTier === "static" ? (
        <div className="lod-banner soft" role="status">
          LOD static · packet motion off ({lodVisible} nodes)
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.6}
        onPaneClick={() => selectSeat(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#1e2a3a" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.55)"
          nodeColor="#1d4ed8"
        />
        <HoverCard />
        <BubbleLayer />
      </ReactFlow>
    </div>
  );
}

export function OrgCanvas() {
  return (
    <ReactFlowProvider>
      <OrgCanvasInner />
    </ReactFlowProvider>
  );
}
