"""Per-workspace async event bus for SSE."""

from __future__ import annotations

import asyncio
import itertools
import time
from typing import Any


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[asyncio.Queue[dict[str, Any]]]] = {}
        self._history: dict[str, list[dict[str, Any]]] = {}
        self._seq = itertools.count(1)
        self._seen_ops: dict[str, float] = {}

    def subscribe(self, workspace_id: str) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        self._subs.setdefault(workspace_id, []).append(q)
        return q

    def unsubscribe(self, workspace_id: str, q: asyncio.Queue[dict[str, Any]]) -> None:
        subs = self._subs.get(workspace_id, [])
        if q in subs:
            subs.remove(q)

    def publish(self, workspace_id: str, event: dict[str, Any]) -> dict[str, Any]:
        if "event_id" not in event:
            event["event_id"] = f"evt_{next(self._seq)}"
        if "ts" not in event:
            event["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        event["workspace_id"] = workspace_id
        # reject illegal packet phase
        if event.get("type") == "edge.packet" and event.get("phase") == "idle":
            raise ValueError("edge.packet.phase=idle is forbidden")
        hist = self._history.setdefault(workspace_id, [])
        hist.append(event)
        if len(hist) > 500:
            del hist[: len(hist) - 500]
        for q in list(self._subs.get(workspace_id, [])):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass
        return event

    def history_after(self, workspace_id: str, after: str | None) -> list[dict[str, Any]]:
        hist = self._history.get(workspace_id, [])
        if not after:
            return list(hist)
        out: list[dict[str, Any]] = []
        seen = False
        for ev in hist:
            if seen:
                out.append(ev)
            if ev.get("event_id") == after:
                seen = True
        return out

    def dedupe_op(self, client_op_id: str, ttl_s: float = 60.0) -> bool:
        """Return True if this op should be skipped (duplicate)."""
        now = time.time()
        # purge
        dead = [k for k, t in self._seen_ops.items() if now - t > ttl_s]
        for k in dead:
            del self._seen_ops[k]
        if client_op_id in self._seen_ops:
            return True
        self._seen_ops[client_op_id] = now
        return False
