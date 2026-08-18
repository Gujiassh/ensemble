"""Workspace registry + mock run playback."""

from __future__ import annotations

import asyncio
import uuid
from copy import deepcopy
from typing import Any

from ensemble_runtime.org.seed import all_seeds
from ensemble_runtime.run.bus import EventBus


FOUR_STEPS = [
    ("seat_pm", "working", "e_pm_res", "seat_pm", "seat_res", "brief"),
    ("seat_res", "working", "e_res_eng", "seat_res", "seat_eng", "research"),
    ("seat_eng", "tooling", "e_eng_rev", "seat_eng", "seat_rev", "patch"),
    ("seat_rev", "waiting_human", None, None, None, "review"),
]


class Registry:
    def __init__(self) -> None:
        self.bus = EventBus()
        self.workspaces: dict[str, dict[str, Any]] = all_seeds()
        self.runs: dict[str, dict[str, Any]] = {}  # run_id -> meta
        self._tasks: dict[str, asyncio.Task[None]] = {}

    def list_workspaces(self) -> list[dict[str, Any]]:
        return [deepcopy(w["workspace"]) for w in self.workspaces.values()]

    def get_org(self, workspace_id: str) -> dict[str, Any]:
        ws = self.workspaces.get(workspace_id)
        if not ws:
            raise KeyError(workspace_id)
        return deepcopy(ws["org"])

    def get_workspace(self, workspace_id: str) -> dict[str, Any]:
        ws = self.workspaces.get(workspace_id)
        if not ws:
            raise KeyError(workspace_id)
        return deepcopy(ws["workspace"])

    async def start_run(
        self,
        workspace_id: str,
        *,
        client_op_id: str,
        title: str | None,
        template: str,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        if workspace_id not in self.workspaces:
            raise KeyError(workspace_id)
        if self.bus.dedupe_op(client_op_id):
            # return last run for ws if any
            for r in self.runs.values():
                if r["workspace_id"] == workspace_id:
                    return r
        run_id = f"run_{uuid.uuid4().hex[:10]}"
        prompt_text = prompt or title or "mock-run"
        meta = {
            "run_id": run_id,
            "workspace_id": workspace_id,
            "title": title or prompt_text,
            "template": template,
            "stage": "running",
            "prompt": prompt_text,
        }
        self.runs[run_id] = meta
        self.bus.publish(
            workspace_id,
            {
                "type": "run.stage",
                "run_id": run_id,
                "stage": "running",
                "status": "running",
                "template": template,
            },
        )
        # persist org snapshot for M3
        from ensemble_runtime.persist import store as persist

        persist.ensure_workspace(
            workspace_id,
            self.workspaces[workspace_id]["workspace"],
            self.workspaces[workspace_id]["org"],
        )

        if template == "four_crew":
            from ensemble_runtime.run.four_crew import run_four_crew_pipeline

            self._tasks[run_id] = asyncio.create_task(
                run_four_crew_pipeline(
                    registry=self,
                    workspace_id=workspace_id,
                    run_id=run_id,
                    prompt=prompt_text,
                )
            )
        elif template == "single_agent":
            from ensemble_runtime.run.single_agent import run_single_agent_pipeline

            self._tasks[run_id] = asyncio.create_task(
                run_single_agent_pipeline(
                    registry=self,
                    workspace_id=workspace_id,
                    run_id=run_id,
                    prompt=prompt_text,
                )
            )
        else:
            self._tasks[run_id] = asyncio.create_task(
                self._play_single(workspace_id, run_id)
            )
        return meta

    async def _play_four(self, workspace_id: str, run_id: str) -> None:
        for seat, status, edge, frm, to, label in FOUR_STEPS:
            await asyncio.sleep(0.35)
            self.bus.publish(
                workspace_id,
                {
                    "type": "seat.status",
                    "run_id": run_id,
                    "seat_id": seat,
                    "status": status,
                    "current_action": f"step={label}",
                },
            )
            if edge and frm and to:
                self.bus.publish(
                    workspace_id,
                    {
                        "type": "edge.packet",
                        "run_id": run_id,
                        "edge_id": edge,
                        "from_seat_id": frm,
                        "to_seat_id": to,
                        "phase": "flowing",
                        "label": label,
                    },
                )
            if label == "review":
                self.bus.publish(
                    workspace_id,
                    {
                        "type": "bubble.upsert",
                        "run_id": run_id,
                        "seat_id": "seat_rev",
                        "bubble_id": f"b_{run_id}_gate",
                        "kind": "approve",
                        "priority": 0,
                        "title": "Approve review gate?",
                        "body": "SSE mock gate",
                        "actions": ["approve", "reject"],
                    },
                )
                self.bus.publish(
                    workspace_id,
                    {
                        "type": "run.stage",
                        "run_id": run_id,
                        "stage": "gate",
                        "status": "waiting_human",
                    },
                )
                self.runs[run_id]["stage"] = "gate"
                self.runs[run_id]["status"] = "waiting_human"
                return
        self.runs[run_id]["stage"] = "done"
        self.runs[run_id]["status"] = "passed"

    async def _play_single(self, workspace_id: str, run_id: str) -> None:
        await asyncio.sleep(0.2)
        self.bus.publish(
            workspace_id,
            {
                "type": "seat.status",
                "run_id": run_id,
                "seat_id": "seat_eng",
                "status": "working",
                "current_action": "implement",
            },
        )
        await asyncio.sleep(0.3)
        self.bus.publish(
            workspace_id,
            {
                "type": "bubble.upsert",
                "run_id": run_id,
                "seat_id": "seat_eng",
                "bubble_id": f"b_{run_id}_gate",
                "kind": "approve",
                "priority": 0,
                "title": "Approve solo gate?",
                "actions": ["approve", "reject"],
            },
        )
        self.bus.publish(
            workspace_id,
            {
                "type": "run.stage",
                "run_id": run_id,
                "stage": "gate",
                "status": "waiting_human",
            },
        )
        self.runs[run_id]["stage"] = "gate"
        self.runs[run_id]["status"] = "waiting_human"

    def bubble_act(
        self,
        workspace_id: str,
        run_id: str,
        bubble_id: str,
        *,
        client_op_id: str,
        action: str,
        comment: str | None = None,
    ) -> dict[str, Any]:
        if self.bus.dedupe_op(client_op_id):
            return {"ok": True, "deduped": True}
        if run_id not in self.runs:
            raise KeyError(run_id)
        if self.runs[run_id]["workspace_id"] != workspace_id:
            raise ValueError("run/workspace mismatch")
        seat = self._bubble_seat(workspace_id, bubble_id)
        ev = self.bus.publish(
            workspace_id,
            {
                "type": "bubble.resolve",
                "run_id": run_id,
                "bubble_id": bubble_id,
                "seat_id": seat,
                "resolution": action,
                "comment": comment,
            },
        )
        status = "done" if action == "approve" else "working"
        self.bus.publish(
            workspace_id,
            {
                "type": "seat.status",
                "run_id": run_id,
                "seat_id": seat,
                "status": status,
                "current_action": f"bubble.{action}",
            },
        )
        if action == "approve":
            self.runs[run_id]["stage"] = "done"
            self.runs[run_id]["status"] = "passed"
            self.bus.publish(
                workspace_id,
                {
                    "type": "run.stage",
                    "run_id": run_id,
                    "stage": "done",
                    "status": "passed",
                },
            )
            from ensemble_runtime.persist import store as persist
            import json

            version = 1
            state_path = persist.run_dir(workspace_id, run_id) / "state.json"
            if state_path.exists():
                version = int(json.loads(state_path.read_text()).get("version", 1))
            persist.write_state(
                workspace_id,
                run_id,
                {
                    "run_id": run_id,
                    "stage": "done",
                    "status": "passed",
                    "version": version,
                },
            )
        else:
            self.runs[run_id]["stage"] = "rework"
            self.runs[run_id]["status"] = "rework"
            self.bus.publish(
                workspace_id,
                {
                    "type": "run.stage",
                    "run_id": run_id,
                    "stage": "rework",
                    "status": "rework",
                },
            )
            # M3: rework → re-run implement with version++
            if self.runs[run_id].get("template") == "single_agent":
                from ensemble_runtime.run.single_agent import rework_implement

                prompt = self.runs[run_id].get("prompt") or "rework"
                loop = asyncio.get_running_loop()
                self._tasks[f"{run_id}_rework"] = loop.create_task(
                    rework_implement(
                        registry=self,
                        workspace_id=workspace_id,
                        run_id=run_id,
                        prompt=prompt,
                    )
                )
        return {"ok": True, "event": ev}

    def human_inject(
        self,
        workspace_id: str,
        run_id: str,
        seat_id: str,
        *,
        client_op_id: str,
        inject_kind: str,
        text: str,
    ) -> dict[str, Any]:
        if self.bus.dedupe_op(client_op_id):
            return {"ok": True, "deduped": True}
        if run_id not in self.runs:
            raise KeyError(run_id)
        if self.runs[run_id]["workspace_id"] != workspace_id:
            raise ValueError("run/workspace mismatch")
        prev = self.runs[run_id].get("prompt") or ""
        if inject_kind == "prompt_replace":
            self.runs[run_id]["prompt"] = text
        else:
            self.runs[run_id]["prompt"] = f"{prev}\n{text}".strip()
        from ensemble_runtime.persist import store as persist

        persist.append_timeline(
            workspace_id,
            run_id,
            {
                "type": "human.inject",
                "seat_id": seat_id,
                "inject_kind": inject_kind,
                "text": text,
            },
        )
        ev = self.bus.publish(
            workspace_id,
            {
                "type": "human.inject",
                "run_id": run_id,
                "seat_id": seat_id,
                "inject_kind": inject_kind,
                "text": text,
            },
        )
        return {"ok": True, "event": ev, "prompt": self.runs[run_id]["prompt"]}


    def _bubble_seat(self, workspace_id: str, bubble_id: str) -> str:
        for ev in reversed(self.bus.history_after(workspace_id, None)):
            if ev.get("type") == "bubble.upsert" and ev.get("bubble_id") == bubble_id:
                sid = ev.get("seat_id")
                if isinstance(sid, str) and sid:
                    return sid
        # fallback: single-agent eng, four_crew review
        if workspace_id == "ws_alpha":
            return "seat_rev"
        return "seat_eng"


_REGISTRY: Registry | None = None


def get_registry() -> Registry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = Registry()
    return _REGISTRY


def reset_registry() -> Registry:
    global _REGISTRY
    _REGISTRY = Registry()
    return _REGISTRY
