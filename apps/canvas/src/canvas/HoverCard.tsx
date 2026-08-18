import { findNode } from "@ensemble/protocol";
import { useStore } from "@xyflow/react";
import { statusLabel } from "../lib/statusLabel";
import { useCanvasStore } from "../store/canvasStore";

export function HoverCard() {
  const hoveredSeatId = useCanvasStore((s) => s.hoveredSeatId);
  const selectedSeatId = useCanvasStore((s) => s.selectedSeatId);
  const org = useCanvasStore((s) => s.org);
  const getSeatRuntime = useCanvasStore((s) => s.getSeatRuntime);
  const nodeLookup = useStore((s) => s.nodeLookup);

  if (!hoveredSeatId || hoveredSeatId === selectedSeatId) return null;
  const node = findNode(org.root, hoveredSeatId);
  if (!node || node.kind !== "seat") return null;
  const rt = getSeatRuntime(hoveredSeatId);
  const flowNode = nodeLookup.get(hoveredSeatId);
  if (!flowNode) return null;

  const abs = flowNode.internals.positionAbsolute;
  const x = abs.x;
  const y = abs.y;
  const h = (flowNode.measured?.height ?? 120) as number;

  return (
    <div
      className="hover-card"
      role="tooltip"
      style={{
        left: x,
        top: y + h + 8,
      }}
    >
      <div className="hover-title">{node.name}</div>
      <div className="hover-line">
        <span className="muted">status</span> {statusLabel(rt.status)}
      </div>
      <div className="hover-line">
        <span className="muted">goal</span> {rt.goal ?? node.goal ?? "—"}
      </div>
      <div className="hover-line">
        <span className="muted">action</span>{" "}
        {rt.current_action ?? node.current_action ?? "—"}
      </div>
    </div>
  );
}
