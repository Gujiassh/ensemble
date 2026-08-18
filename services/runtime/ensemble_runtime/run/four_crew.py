"""four_crew via CrewAI projection + RunnerJob per seat (M4).

In ENSEMBLE_CREWAI_MODE=mock|off we still project through project_org_to_crew
and execute seats in sequential task order with MockRunner/PiRunner — no LLM.
Live mode may call build_live_crew (deferred until keys configured).
"""

from __future__ import annotations

import asyncio
from typing import Any

from ensemble_runtime.crew import CrewAIMode, get_crewai_mode, project_org_to_crew
from ensemble_runtime.persist import store as persist
from ensemble_runtime.run.dispatch import resolve_runner, run_job

from runners.mock import RunnerJob

SEAT_ARTIFACTS = {
    "seat_pm": ["01-brief.md"],
    "seat_res": ["02-research.md"],
    "seat_eng": ["03-output.md"],
    "seat_rev": ["04-review.md"],
}

SEAT_STATUS = {
    "seat_pm": "working",
    "seat_res": "working",
    "seat_eng": "tooling",
    "seat_rev": "waiting_human",
}

EDGE_FOR = {
    "seat_pm": ("e_pm_res", "seat_pm", "seat_res", "brief"),
    "seat_res": ("e_res_eng", "seat_res", "seat_eng", "research"),
    "seat_eng": ("e_eng_rev", "seat_eng", "seat_rev", "patch"),
}


async def run_four_crew_pipeline(
    *,
    registry: Any,
    workspace_id: str,
    run_id: str,
    prompt: str,
) -> None:
    org = registry.workspaces[workspace_id]["org"]
    mode = get_crewai_mode()
    proj = project_org_to_crew(org, run_id=run_id, process="sequential", mode=mode)
    persist.write_roster(workspace_id, run_id, [])
    persist.write_state(
        workspace_id,
        run_id,
        {
            "run_id": run_id,
            "stage": "crew",
            "status": "running",
            "version": 1,
            "crew": {
                "framework": "crewai",
                "mode": proj.mode.value if hasattr(proj.mode, "value") else str(proj.mode),
                "process": proj.process,
                "skipped": proj.skipped,
                "agent_ids": proj.agent_ids(),
                "task_ids": [t.task_id for t in proj.tasks],
            },
        },
    )
    registry.bus.publish(
        workspace_id,
        {
            "type": "run.stage",
            "run_id": run_id,
            "stage": "crew",
            "status": "running",
            "crew_framework": "crewai",
            "crew_mode": str(proj.mode.value if hasattr(proj.mode, "value") else proj.mode),
            "crew_task_ids": [t.task_id for t in proj.tasks],
        },
    )
    persist.append_timeline(
        workspace_id,
        run_id,
        {
            "type": "crew.projected",
            "framework": "crewai",
            "mode": str(proj.mode.value if hasattr(proj.mode, "value") else proj.mode),
            "process": proj.process,
            "skipped": proj.skipped,
            "agents": [a.seat_id for a in proj.agents],
            "tasks": [t.task_id for t in proj.tasks],
        },
    )

    if proj.skipped or not proj.tasks:
        # off mode / empty: still demo sequential seats from org
        from ensemble_runtime.crew.project import ProjectedTask

        seat_order = ("seat_pm", "seat_res", "seat_eng", "seat_rev")
        tasks = [
            ProjectedTask(
                task_id=f"task_{s}",
                seat_id=s,
                description=f"demo {s}",
                expected_output="artifact",
            )
            for s in seat_order
        ]
    else:
        tasks = list(proj.tasks)

    art_root = persist.run_dir(workspace_id, run_id) / "artifacts"
    for task in tasks:
        seat_id = task.seat_id
        await asyncio.sleep(0.08)
        status = SEAT_STATUS.get(seat_id, "working")
        registry.bus.publish(
            workspace_id,
            {
                "type": "seat.status",
                "run_id": run_id,
                "seat_id": seat_id,
                "status": status if seat_id != "seat_rev" else "working",
                "current_action": task.task_id,
            },
        )
        expected = SEAT_ARTIFACTS.get(seat_id, [f"{seat_id}.md"])
        # engineer prefers pi
        seat_node = _find_seat(org.get("root") or {}, seat_id) or {}
        requested = seat_node.get("runner") or ("pi" if seat_id == "seat_eng" else "mock")
        effective = resolve_runner(requested)
        job = RunnerJob(
            workspace_id=workspace_id,
            run_id=run_id,
            stage=task.task_id,
            seat_id=seat_id,
            role_template=str(seat_node.get("role_template") or "engineer"),
            workspace_path=str(art_root),
            prompt=prompt,
            expected_artifacts=expected,
            runner=effective,
        )
        result = run_job(job)
        persist.append_timeline(
            workspace_id,
            run_id,
            {
                "type": "runner.result",
                "seat_id": seat_id,
                "task_id": task.task_id,
                "ok": result.ok,
                "provider": result.provider,
                "summary": result.summary,
            },
        )
        if not result.ok:
            registry.bus.publish(
                workspace_id,
                {
                    "type": "seat.status",
                    "run_id": run_id,
                    "seat_id": seat_id,
                    "status": "error",
                    "current_action": "runner_failed",
                },
            )
            registry.bus.publish(
                workspace_id,
                {
                    "type": "run.stage",
                    "run_id": run_id,
                    "stage": "crew",
                    "status": "failed",
                    "error": result.summary,
                },
            )
            persist.write_state(
                workspace_id,
                run_id,
                {
                    "run_id": run_id,
                    "stage": "crew",
                    "status": "failed",
                    "version": 1,
                    "error": result.summary,
                },
            )
            return
        for name in expected:
            registry.bus.publish(
                workspace_id,
                {
                    "type": "artifact.written",
                    "run_id": run_id,
                    "seat_id": seat_id,
                    "name": name,
                    "version": 1,
                },
            )
        edge = EDGE_FOR.get(seat_id)
        if edge:
            eid, frm, to, label = edge
            registry.bus.publish(
                workspace_id,
                {
                    "type": "edge.packet",
                    "run_id": run_id,
                    "edge_id": eid,
                    "from_seat_id": frm,
                    "to_seat_id": to,
                    "phase": "flowing",
                    "label": label,
                },
            )

    # review gate on seat_rev
    registry.bus.publish(
        workspace_id,
        {
            "type": "seat.status",
            "run_id": run_id,
            "seat_id": "seat_rev",
            "status": "waiting_human",
            "current_action": "review",
        },
    )
    registry.bus.publish(
        workspace_id,
        {
            "type": "bubble.upsert",
            "run_id": run_id,
            "seat_id": "seat_rev",
            "bubble_id": f"b_{run_id}_gate",
            "kind": "approve",
            "priority": 0,
            "title": "Approve four-crew review gate?",
            "body": "CrewAI-projected sequential handoff",
            "actions": ["approve", "reject"],
        },
    )
    registry.bus.publish(
        workspace_id,
        {
            "type": "run.stage",
            "run_id": run_id,
            "stage": "gate",
            "status": "waiting_human",
        },
    )
    registry.runs[run_id]["stage"] = "gate"
    registry.runs[run_id]["status"] = "waiting_human"
    persist.write_state(
        workspace_id,
        run_id,
        {
            "run_id": run_id,
            "stage": "gate",
            "status": "waiting_human",
            "version": 1,
            "crew": {
                "framework": "crewai",
                "mode": str(proj.mode.value if hasattr(proj.mode, "value") else proj.mode),
                "process": proj.process,
                "skipped": proj.skipped,
                "agent_ids": proj.agent_ids() if not (proj.skipped or not proj.tasks) else [
                    "seat_pm", "seat_res", "seat_eng", "seat_rev"
                ],
                "task_ids": [t.task_id for t in tasks],
            },
        },
    )


def _find_seat(node: dict, seat_id: str) -> dict | None:
    if not isinstance(node, dict):
        return None
    if node.get("id") == seat_id and node.get("kind") == "seat":
        return node
    for c in node.get("children") or []:
        hit = _find_seat(c, seat_id)
        if hit:
            return hit
    return None
