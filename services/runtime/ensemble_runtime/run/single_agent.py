"""Single-agent stage machine (M3): plan → implement → gate → done|rework."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# allow importing runners from repo root
_REPO = Path(__file__).resolve().parents[4]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from runners.mock import RunnerJob  # noqa: E402

from ensemble_runtime.persist import store as persist  # noqa: E402
from ensemble_runtime.run.dispatch import run_job  # noqa: E402

STAGE_ARTIFACTS = {
    "plan": ["01-plan.md"],
    "implement": ["02-output.md"],
}


async def run_single_agent_pipeline(
    *,
    registry: Any,
    workspace_id: str,
    run_id: str,
    prompt: str,
    fail_contract: bool = False,
) -> None:
    """Drive plan+implement via MockRunner, then upsert approve bubble."""
    import asyncio

    art_root = persist.run_dir(workspace_id, run_id) / "artifacts"
    persist.write_roster(workspace_id, run_id, [])
    persist.write_state(
        workspace_id,
        run_id,
        {"run_id": run_id, "stage": "plan", "status": "running", "version": 1},
    )

    for stage in ("plan", "implement"):
        registry.bus.publish(
            workspace_id,
            {
                "type": "run.stage",
                "run_id": run_id,
                "stage": stage,
                "status": "running",
            },
        )
        registry.bus.publish(
            workspace_id,
            {
                "type": "seat.status",
                "run_id": run_id,
                "seat_id": "seat_eng",
                "status": "working" if stage == "plan" else "tooling",
                "current_action": stage,
            },
        )
        await asyncio.sleep(0.05)
        expected = STAGE_ARTIFACTS[stage]
        # rework uses v2 filename for implement
        state_path = persist.run_dir(workspace_id, run_id) / "state.json"
        version = 1
        if state_path.exists():
            import json

            version = json.loads(state_path.read_text()).get("version", 1)
        if stage == "implement" and version > 1:
            expected = [f"02-output.v{version}.md"]

        job = RunnerJob(
            workspace_id=workspace_id,
            run_id=run_id,
            stage=stage,
            seat_id="seat_eng",
            role_template="engineer",
            workspace_path=str(art_root),
            prompt=prompt,
            expected_artifacts=expected,
            runner="mock",
        )
        if fail_contract and stage == "implement":
            from runners.mock import run_mock

            result = run_mock(job, fail_missing=True)
        else:
            # engineer implement may use pi when ENSEMBLE_SINGLE_AGENT_RUNNER=pi
            import os

            if stage == "implement" and os.environ.get("ENSEMBLE_SINGLE_AGENT_RUNNER") == "pi":
                job.runner = "pi"
                if version > 1:
                    job.expected_artifacts = [f"02-output.v{version}.md"]
            result = run_job(job)
        persist.append_timeline(
            workspace_id,
            run_id,
            {
                "type": "runner.result",
                "stage": stage,
                "ok": result.ok,
                "summary": result.summary,
            },
        )
        if not result.ok:
            registry.bus.publish(
                workspace_id,
                {
                    "type": "seat.status",
                    "run_id": run_id,
                    "seat_id": "seat_eng",
                    "status": "error",
                    "current_action": "contract_failed",
                },
            )
            registry.bus.publish(
                workspace_id,
                {
                    "type": "run.stage",
                    "run_id": run_id,
                    "stage": stage,
                    "status": "failed",
                },
            )
            persist.write_state(
                workspace_id,
                run_id,
                {"run_id": run_id, "stage": stage, "status": "failed", "version": version},
            )
            return

        for name in expected:
            registry.bus.publish(
                workspace_id,
                {
                    "type": "artifact.written",
                    "run_id": run_id,
                    "seat_id": "seat_eng",
                    "name": name,
                    "version": version,
                },
            )

    # gate
    registry.bus.publish(
        workspace_id,
        {
            "type": "bubble.upsert",
            "run_id": run_id,
            "seat_id": "seat_eng",
            "bubble_id": f"b_{run_id}_gate",
            "kind": "approve",
            "priority": 0,
            "title": "Approve single-agent gate?",
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
            "version": version,
        },
    )


async def rework_implement(
    *,
    registry: Any,
    workspace_id: str,
    run_id: str,
    prompt: str,
) -> None:
    """Reject path: bump version, rewrite implement artifact, re-open gate."""
    import asyncio
    import json

    art_root = persist.run_dir(workspace_id, run_id) / "artifacts"
    state_path = persist.run_dir(workspace_id, run_id) / "state.json"
    version = 1
    if state_path.exists():
        version = int(json.loads(state_path.read_text()).get("version", 1)) + 1
    expected = [f"02-output.v{version}.md"]
    registry.bus.publish(
        workspace_id,
        {
            "type": "run.stage",
            "run_id": run_id,
            "stage": "implement",
            "status": "running",
        },
    )
    registry.bus.publish(
        workspace_id,
        {
            "type": "seat.status",
            "run_id": run_id,
            "seat_id": "seat_eng",
            "status": "tooling",
            "current_action": f"rework_v{version}",
        },
    )
    await asyncio.sleep(0.05)
    # use injected prompt if registry has newer text
    if run_id in registry.runs and registry.runs[run_id].get("prompt"):
        prompt = registry.runs[run_id]["prompt"]
    job = RunnerJob(
        workspace_id=workspace_id,
        run_id=run_id,
        stage="implement",
        seat_id="seat_eng",
        role_template="engineer",
        workspace_path=str(art_root),
        prompt=prompt,
        expected_artifacts=expected,
        runner="mock",
    )
    result = run_job(job)
    persist.append_timeline(
        workspace_id,
        run_id,
        {
            "type": "runner.result",
            "stage": "implement",
            "ok": result.ok,
            "summary": result.summary,
            "version": version,
        },
    )
    if not result.ok:
        persist.write_state(
            workspace_id,
            run_id,
            {
                "run_id": run_id,
                "stage": "implement",
                "status": "failed",
                "version": version,
            },
        )
        return
    for name in expected:
        registry.bus.publish(
            workspace_id,
            {
                "type": "artifact.written",
                "run_id": run_id,
                "seat_id": "seat_eng",
                "name": name,
                "version": version,
            },
        )
    registry.bus.publish(
        workspace_id,
        {
            "type": "bubble.upsert",
            "run_id": run_id,
            "seat_id": "seat_eng",
            "bubble_id": f"b_{run_id}_gate_v{version}",
            "kind": "approve",
            "priority": 0,
            "title": f"Approve rework v{version}?",
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
            "version": version,
        },
    )
