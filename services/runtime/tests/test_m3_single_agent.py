"""M3 single-agent persist + MockRunner."""

from __future__ import annotations

import asyncio
import json

import pytest

from ensemble_runtime.persist import store as persist
from ensemble_runtime.run.registry import reset_registry
from ensemble_runtime.run.single_agent import run_single_agent_pipeline


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_DATA_DIR", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_single_agent_writes_artifacts(data_dir):
    reg = reset_registry()
    meta = await reg.start_run(
        "ws_beta",
        client_op_id="op_m3_sa",
        title="plan me",
        template="single_agent",
    )
    await asyncio.sleep(0.6)
    run_id = meta["run_id"]
    art = persist.run_dir("ws_beta", run_id) / "artifacts"
    assert (art / "01-plan.md").exists()
    assert (art / "02-output.md").exists()
    assert (persist.workspace_dir("ws_beta") / "org" / "tree.json").exists()
    state = json.loads((persist.run_dir("ws_beta", run_id) / "state.json").read_text())
    assert state["status"] == "waiting_human"
    types = [e["type"] for e in reg.bus.history_after("ws_beta", None)]
    assert "bubble.upsert" in types
    assert "artifact.written" in types


@pytest.mark.asyncio
async def test_contract_failure(data_dir):
    reg = reset_registry()
    await run_single_agent_pipeline(
        registry=reg,
        workspace_id="ws_beta",
        run_id="run_fail",
        prompt="x",
        fail_contract=True,
    )
    state = json.loads((persist.run_dir("ws_beta", "run_fail") / "state.json").read_text())
    assert state["status"] == "failed"
