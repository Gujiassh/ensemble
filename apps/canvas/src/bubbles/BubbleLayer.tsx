import { findNode } from "@ensemble/protocol";
import { useStore } from "@xyflow/react";
import { useMemo } from "react";
import { useCanvasStore } from "../store/canvasStore";
import { useLiveStore } from "../store/liveStore";

/** Node-anchored bubbles; overflow tray if node not on screen. */
export function BubbleLayer() {
  const allBubbles = useCanvasStore((s) => s.bubbles);
  const bubbles = useMemo(
    () => allBubbles.filter((b) => !b.resolved),
    [allBubbles],
  );
  const resolveBubbleLocal = useCanvasStore((s) => s.resolveBubble);
  const resolveLiveBubble = useLiveStore((s) => s.resolveLiveBubble);
  const source = useLiveStore((s) => s.source);
  const resolveBubble = (id: string, action: "approve" | "reject") => {
    if (source === "live") void resolveLiveBubble(id, action);
    else resolveBubbleLocal(id, action);
  };
  const selectSeat = useCanvasStore((s) => s.selectSeat);
  const org = useCanvasStore((s) => s.org);
  const nodeLookup = useStore((s) => s.nodeLookup);

  if (bubbles.length === 0) return null;

  const anchored: typeof bubbles = [];
  const overflow: typeof bubbles = [];

  for (const b of bubbles) {
    const n = nodeLookup.get(b.seat_id);
    if (n) anchored.push(b);
    else overflow.push(b);
  }

  return (
    <>
      {anchored.map((b) => {
        const n = nodeLookup.get(b.seat_id)!;
        const seatName = findNode(org.root, b.seat_id)?.name ?? b.seat_id;
        const abs = n.internals.positionAbsolute;
        const x = abs.x;
        const y = abs.y;
        const w = (n.measured?.width ?? 132) as number;
        return (
          <div
            key={b.bubble_id}
            className={`bubble-card anchored kind-${b.kind}`}
            style={{
              position: "absolute",
              left: x + w + 12,
              top: y,
              zIndex: 20,
            }}
            onClick={() => selectSeat(b.seat_id)}
          >
            <BubbleBody
              seatName={seatName}
              bubble={b}
              onApprove={() => resolveBubble(b.bubble_id, "approve")}
              onReject={() => resolveBubble(b.bubble_id, "reject")}
            />
          </div>
        );
      })}
      {overflow.length > 0 ? (
        <div className="bubble-layer tray" aria-label="Overflow bubbles">
          {overflow.map((b) => {
            const seatName = findNode(org.root, b.seat_id)?.name ?? b.seat_id;
            return (
              <div
                key={b.bubble_id}
                className={`bubble-card kind-${b.kind}`}
                onClick={() => selectSeat(b.seat_id)}
              >
                <BubbleBody
                  seatName={seatName}
                  bubble={b}
                  onApprove={() => resolveBubble(b.bubble_id, "approve")}
                  onReject={() => resolveBubble(b.bubble_id, "reject")}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function BubbleBody({
  seatName,
  bubble,
  onApprove,
  onReject,
}: {
  seatName: string;
  bubble: {
    kind: string;
    title: string;
    body?: string;
  };
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <div className="bubble-seat">{seatName}</div>
      <div className="bubble-title">{bubble.title}</div>
      {bubble.body ? <div className="bubble-body">{bubble.body}</div> : null}
      {bubble.kind === "approve" ? (
        <div className="bubble-actions">
          <button
            type="button"
            className="primary"
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            Reject
          </button>
        </div>
      ) : null}
    </>
  );
}
