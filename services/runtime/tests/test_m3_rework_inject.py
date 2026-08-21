"""M3 rework version bump + human.inject."""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from ensemble_runtime.api.app import app
from ensemble_runtime.persist import store as persist
from ensemble_runtime.run.registry import reset_registry


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_DATA_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture()
def client(data_dir):
    reset_registry()
    with TestClient(app) as c:
        yield c


@pytest.mark.asyncio
async def test_reject_rework_writes_v2(data_dir):
    reg = reset_registry()
    meta = await reg.start_run(
        "ws_beta",
        client_op_id="op_m3_rework",
        title="first draft",
        template="single_agent",
    )
    await asyncio.sleep(0.6)
    run_id = meta["run_id"]
    bubble_id = f"b_{run_id}_gate"
    reg.bubble_act(
        "ws_beta",
        run_id,
        bubble_id,
        client_op_id="op_reject_1",
        action="reject",
        comment="needs polish",
    )
    await asyncio.sleep(0.4)
    art = persist.run_dir("ws_beta", run_id) / "artifacts"
    assert (art / "02-output.md").exists()
    assert (art / "02-output.v2.md").exists()
    v2 = (art / "02-output.v2.md").read_text()
    assert "first draft" in v2
    state = json.loads((persist.run_dir("ws_beta", run_id) / "state.json").read_text())
    assert state["version"] == 2
    assert state["status"] == "waiting_human"
    types = [e["type"] for e in reg.bus.history_after("ws_beta", None)]
    assert types.count("bubble.upsert") >= 2
    assert any(
        e.get("type") == "artifact.written" and e.get("name") == "02-output.v2.md"
        for e in reg.bus.history_after("ws_beta", None)
    )


@pytest.mark.asyncio
async def test_inject_affects_rework_prompt(data_dir):
    reg = reset_registry()
    meta = await reg.start_run(
        "ws_beta",
        client_op_id="op_m3_inj",
        title="base prompt",
        template="single_agent",
        prompt="base prompt",
    )
    await asyncio.sleep(0.6)
    run_id = meta["run_id"]
    out = reg.human_inject(
        "ws_beta",
        run_id,
        "seat_eng",
        client_op_id="op_inj_1",
        inject_kind="prompt_append",
        text="ADD: prefer async",
    )
    assert "ADD: prefer async" in out["prompt"]
    timeline = (persist.run_dir("ws_beta", run_id) / "timeline.jsonl").read_text()
    assert "human.inject" in timeline
    assert any(
        e.get("type") == "human.inject" and "ADD: prefer async" in str(e.get("text"))
        for e in reg.bus.history_after("ws_beta", None)
    )
    reg.bubble_act(
        "ws_beta",
        run_id,
        f"b_{run_id}_gate",
        client_op_id="op_rej_inj",
        action="reject",
    )
    await asyncio.sleep(0.4)
    v2 = (persist.run_dir("ws_beta", run_id) / "artifacts" / "02-output.v2.md").read_text()
    assert "ADD: prefer async" in v2


def test_artifact_get_and_inject_http(client):
    r = client.post(
        "/workspaces/ws_beta/runs",
        json={
            "client_op_id": "op_http_sa",
            "template": "single_agent",
            "title": "http plan",
            "prompt": "http plan body",
        },
    )
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    import time

    time.sleep(0.7)
    art = client.get(f"/workspaces/ws_beta/runs/{run_id}/artifacts/01-plan.md")
    assert art.status_code == 200
    assert "http plan" in art.text
    inj = client.post(
        f"/workspaces/ws_beta/runs/{run_id}/seats/seat_eng/inject",
        json={
            "client_op_id": "op_http_inj",
            "inject_kind": "prompt_append",
            "text": "ship it",
        },
    )
    assert inj.status_code == 200
    assert "ship it" in inj.json()["prompt"]


def test_http_reject_rework_v2(client):
    """Sync TestClient must still schedule rework (needs async route + running loop)."""
    import time

    r = client.post(
        "/workspaces/ws_beta/runs",
        json={
            "client_op_id": "op_http_rework",
            "template": "single_agent",
            "title": "http rework",
            "prompt": "http rework body",
        },
    )
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    time.sleep(0.7)
    rej = client.post(
        f"/workspaces/ws_beta/runs/{run_id}/bubbles/b_{run_id}_gate/act",
        json={"client_op_id": "op_http_rej", "action": "reject"},
    )
    assert rej.status_code == 200, rej.text
    time.sleep(0.5)
    v2 = client.get(f"/workspaces/ws_beta/runs/{run_id}/artifacts/02-output.v2.md")
    assert v2.status_code == 200
    assert "http rework" in v2.text
