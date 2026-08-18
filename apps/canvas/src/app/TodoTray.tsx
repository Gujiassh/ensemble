import { ListTodo } from "lucide-react";
import { useMemo } from "react";
import { useCanvasStore } from "../store/canvasStore";
import { useLiveStore } from "../store/liveStore";

export interface TrayItem {
  key: string;
  workspaceId: string;
  workspaceLabel: string;
  seatId: string;
  bubbleId: string;
  title: string;
  kind: string;
}

/** Cross-workspace open-bubble tray (M5). Mock: current fixture only; live: current ws bubbles. */
export function TodoTray() {
  const bubbles = useCanvasStore((s) => s.bubbles);
  const selectSeat = useCanvasStore((s) => s.selectSeat);
  const source = useLiveStore((s) => s.source);
  const workspaceId = useLiveStore((s) => s.workspaceId);
  const workspaces = useLiveStore((s) => s.workspaces);
  const selectWorkspace = useLiveStore((s) => s.selectWorkspace);

  const items = useMemo((): TrayItem[] => {
    const wsId = source === "live" ? workspaceId ?? "live" : "mock";
    const label =
      source === "live"
        ? workspaces.find((w) => w.id === workspaceId)?.name ?? wsId
        : "Mock fixture";
    return bubbles
      .filter((b) => !b.resolved)
      .map((b) => ({
        key: `${wsId}:${b.bubble_id}`,
        workspaceId: wsId,
        workspaceLabel: label,
        seatId: b.seat_id,
        bubbleId: b.bubble_id,
        title: b.title,
        kind: b.kind,
      }));
  }, [bubbles, source, workspaceId, workspaces]);

  const onJump = async (item: TrayItem) => {
    if (source === "live" && workspaceId && item.workspaceId !== workspaceId) {
      await selectWorkspace(item.workspaceId);
    }
    selectSeat(item.seatId);
  };

  return (
    <aside className="todo-tray" aria-label="Open todos">
      <header className="todo-tray-head">
        <ListTodo size={14} />
        <span>Todos</span>
        <span className="todo-tray-count">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <div className="todo-tray-empty muted">No open bubbles</div>
      ) : (
        <ul className="todo-tray-list">
          {items.map((it) => (
            <li key={it.key}>
              <button type="button" className="todo-tray-item" onClick={() => void onJump(it)}>
                <span className="todo-tray-kind">{it.kind}</span>
                <span className="todo-tray-title">{it.title}</span>
                <span className="todo-tray-meta muted">
                  {it.workspaceLabel} · {it.seatId}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
