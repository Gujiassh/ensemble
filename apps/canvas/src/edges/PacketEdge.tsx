import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { PacketEdgeData } from "../lib/layout";
import { useCanvasStore } from "../store/canvasStore";

export function PacketEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<PacketEdgeData>>) {
  const reduced = useCanvasStore((s) => s.reducedMotion);
  const allowPacketMotion = useCanvasStore((s) => s.lod.allowPacketMotion);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const flowing = data?.phase === "flowing";
  const intensity = data?.intensity ?? "stage";
  const motion = !reduced && allowPacketMotion && !(data?.lodSuppressMotion);
  const stroke =
    flowing || data?.highlighted
      ? "var(--accent)"
      : "color-mix(in srgb, var(--border) 80%, var(--muted))";
  const width = flowing ? (intensity === "stage" ? 2.5 : 2) : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: width,
          opacity: flowing ? 1 : 0.65,
        }}
      />
      {flowing && data?.label ? (
        <EdgeLabelRenderer>
          <div
            className={`packet-label ${motion ? "flow" : "static"} ${intensity}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {flowing && motion ? (
        <circle r="4" fill="var(--accent)" className="packet-dot">
          <animateMotion dur="0.7s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}
