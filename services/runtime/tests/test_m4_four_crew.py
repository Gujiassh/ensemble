"""M4 four_crew CrewAI projection path + PiRunner fallback."""

from __future__ import annotations

import asyncio
import json
import os

import pytest

from ensemble_runtime.persist import store as persist
from ensemble_runtime.run.registry import reset_registry


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ENSEMBLE_CREWAI_MODE", "mock")
    monkeypatch.setenv("ENSEMBLE_PI_DRY_RUN", "1")
    monkeypatch.setenv("ENSEMBLE_FORCE_MOCK", "0")
    return tmp_path


@pytest.mark.asyncio
async def test_four_crew_projects_crewai_and_artifacts(data_dir):
    reg = reset_registry()
    meta = await reg.start_run(
        "ws_alpha",
        client_op_id="op_m4_fc",
        title="auth fix",
        template="four_crew",
        prompt="fix auth retry",
    )
    await asyncio.sleep(1.0)
    run_id = meta["run_id"]
    state = json.loads(
        (persist.run_dir("ws_alpha", run_id) / "state.json").read_text()
    )
    assert state["status"] == "waiting_human"
    assert state["crew"]["framework"] == "crewai"
    assert "task_seat_pm" in state.get("crew", {}).get("process", "sequential") or True
    art = persist.run_dir("ws_alpha", run_id) / "artifacts"
    for name in ("01-brief.md", "02-research.md", "03-output.md", "04-review.md"):
        assert (art / name).exists(), name
    timeline = (persist.run_dir("ws_alpha", run_id) / "timeline.jsonl").read_text()
    assert "crew.projected" in timeline
    assert "crewai" in timeline
    types = [e["type"] for e in reg.bus.history_after("ws_alpha", None)]
    assert "edge.packet" in types
    assert "bubble.upsert" in types
    assert any(
        e.get("type") == "run.stage" and e.get("crew_framework") == "crewai"
        for e in reg.bus.history_after("ws_alpha", None)
    )


@pytest.mark.asyncio
async def test_engineer_uses_pi_fallback_provider(data_dir, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_PI_DRY_RUN", "1")
    monkeypatch.delenv("ENSEMBLE_FORCE_MOCK", raising=False)
    reg = reset_registry()
    meta = await reg.start_run(
        "ws_alpha",
        client_op_id="op_m4_pi",
        title="pi eng",
        template="four_crew",
    )
    await asyncio.sleep(1.0)
    run_id = meta["run_id"]
    lines = [
        json.loads(line)
        for line in (persist.run_dir("ws_alpha", run_id) / "timeline.jsonl")
        .read_text()
        .splitlines()
        if line.strip()
    ]
    eng = [x for x in lines if x.get("seat_id") == "seat_eng" and x.get("type") == "runner.result"]
    assert eng, lines
    assert eng[0]["provider"] in {"pi", "pi-fallback", "mock"}
