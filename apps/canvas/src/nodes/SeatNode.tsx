import type { SeatStatus } from "@ensemble/protocol";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { SeatNodeData } from "../lib/layout";
import { statusLabel } from "../lib/statusLabel";
import { useCanvasStore } from "../store/canvasStore";

const STATUS_COLOR: Record<SeatStatus, string> = {
  idle: "var(--idle)",
  planning: "var(--planning)",
  working: "var(--working)",
  tooling: "var(--tooling)",
  waiting_human: "var(--waiting)",
  waiting_peer: "var(--waiting)",
  blocked: "var(--error)",
  done: "var(--done)",
  error: "var(--error)",
};

export function SeatNode({ id, data }: NodeProps<Node<SeatNodeData>>) {
  const toggleCollapse = useCanvasStore((s) => s.toggleCollapse);
  const selectSeat = useCanvasStore((s) => s.selectSeat);
  const setHoveredSeat = useCanvasStore((s) => s.setHoveredSeat);
  const focusNode = useCanvasStore((s) => s.focusNode);
  const selected = useCanvasStore((s) => s.selectedSeatId === id);

  const ring = STATUS_COLOR[data.status];
  const initial = data.org.name.slice(0, 1).toUpperCase();
  const badge = data.badge;
  const showBadge =
    data.collapsed &&
    badge &&
    (badge.busy > 0 || badge.waiting > 0 || badge.error > 0);

  // 10§4.1 display priority: error > waiting > busy
  let badgeChip: { cls: string; n: number } | null = null;
  if (showBadge && badge) {
    if (badge.error > 0) badgeChip = { cls: "err", n: badge.error };
    else if (badge.waiting > 0) badgeChip = { cls: "wait", n: badge.waiting };
    else if (badge.busy > 0) badgeChip = { cls: "busy", n: badge.busy };
  }

  return (
    <div
      className={`seat-node ${selected ? "selected" : ""} ${data.highlighted ? "highlighted" : ""}`}
      onMouseEnter={() => setHoveredSeat(id)}
      onMouseLeave={() => setHoveredSeat(null)}
      onClick={(e) => {
        e.stopPropagation();
        selectSeat(id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (data.hasChildren) focusNode(id);
      }}
    >
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="seat-top">
        {data.hasChildren ? (
          <button
            type="button"
            className="icon-btn"
            title={data.collapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(id);
            }}
          >
            {data.collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        ) : (
          <span className="icon-spacer" />
        )}
        {data.org.runner ? (
          <span className="runner-badge" title={`runner=${data.org.runner}`}>
            <Wrench size={10} />
            {data.org.runner}
          </span>
        ) : null}
      </div>

      <div className="avatar-wrap" style={{ boxShadow: `0 0 0 3px ${ring}` }}>
        <div className="avatar">{initial}</div>
        {badgeChip ? (
          <div className="parent-badge">
            <span className={`b ${badgeChip.cls}`}>{badgeChip.n}</span>
          </div>
        ) : null}
      </div>

      <div className="seat-name">{data.org.name}</div>
      <div className="seat-role">{data.org.role_template ?? "seat"}</div>
      <div className="seat-status" style={{ color: ring }}>
        {statusLabel(data.status)}
      </div>

      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
