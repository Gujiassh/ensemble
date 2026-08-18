"""M2 API: envelope, isolation, no idle packet phase."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from ensemble_runtime.api.app import app
from ensemble_runtime.run.registry import reset_registry


@pytest.fixture()
def client():
    reset_registry()
    with TestClient(app) as c:
        yield c


def test_list_two_workspaces(client: TestClient):
    r = client.get("/workspaces")
    assert r.status_code == 200
    ids = {w["id"] for w in r.json()["workspaces"]}
    assert ids == {"ws_alpha", "ws_beta"}


def test_org_snapshot_shape(client: TestClient):
    r = client.get("/workspaces/ws_alpha/org")
    assert r.status_code == 200
    body = r.json()
    assert body["workspace_id"] == "ws_alpha"
    assert "root" in body["org"]
    assert "edges" in body["org"]
    # ≥2 groups under root
    kids = body["org"]["root"]["children"]
    groups = [c for c in kids if c["kind"] == "group"]
    assert len(groups) >= 2


def test_workspaces_isolated(client: TestClient):
    a = client.get("/workspaces/ws_alpha/org").json()["org"]
    b = client.get("/workspaces/ws_beta/org").json()["org"]
    assert a["root"]["id"] != b["root"]["id"] or len(a["edges"]) != len(b["edges"])
    beta_seats = []

    def walk(n):
        if n.get("kind") == "seat":
            beta_seats.append(n["id"])
        for c in n.get("children") or []:
            walk(c)

    walk(b["root"])
    assert beta_seats == ["seat_eng"]


def test_run_start_emits_envelope_fields(client: TestClient):
    r = client.post(
        "/workspaces/ws_beta/runs",
        json={
            "client_op_id": "op_test_1",
            "template": "single_agent",
            "title": "t",
        },
    )
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    assert run_id.startswith("run_")

    # pull history via bus
    from ensemble_runtime.run.registry import get_registry

    hist = get_registry().bus.history_after("ws_beta", None)
    assert hist
    for ev in hist:
        assert "type" in ev
        assert ev["workspace_id"] == "ws_beta"
        assert "ts" in ev
        if ev["type"] == "edge.packet":
            assert ev["phase"] in ("ready", "flowing", "delivered", "rejected")
            assert ev["phase"] != "idle"


def test_bubble_act_resolve(client: TestClient):
    start = client.post(
        "/workspaces/ws_beta/runs",
        json={"client_op_id": "op_b1", "template": "single_agent"},
    ).json()
    run_id = start["run_id"]
    # wait playback a bit via sync client — drain by polling history
    import time

    from ensemble_runtime.run.registry import get_registry

    deadline = time.time() + 2
    bubble_id = None
    while time.time() < deadline:
        for ev in get_registry().bus.history_after("ws_beta", None):
            if ev.get("type") == "bubble.upsert":
                bubble_id = ev["bubble_id"]
                break
        if bubble_id:
            break
        time.sleep(0.05)
    assert bubble_id
    r = client.post(
        f"/workspaces/ws_beta/runs/{run_id}/bubbles/{bubble_id}/act",
        json={"client_op_id": "op_b2", "action": "approve"},
    )
    assert r.status_code == 200
    types = [e["type"] for e in get_registry().bus.history_after("ws_beta", None)]
    assert "bubble.resolve" in types


def test_forbid_idle_packet_phase():
    from ensemble_runtime.run.registry import reset_registry

    reg = reset_registry()
    with pytest.raises(ValueError):
        reg.bus.publish(
            "ws_beta",
            {
                "type": "edge.packet",
                "edge_id": "e",
                "from_seat_id": "a",
                "to_seat_id": "b",
                "phase": "idle",
            },
        )


def test_four_crew_emits_packets(client: TestClient):
    import time

    from ensemble_runtime.run.registry import get_registry

    r = client.post(
        "/workspaces/ws_alpha/runs",
        json={"client_op_id": "op_four_1", "template": "four_crew"},
    )
    assert r.status_code == 200
    packets = []
    deadline = time.time() + 3
    while time.time() < deadline:
        for ev in get_registry().bus.history_after("ws_alpha", None):
            assert "type" in ev and ev["workspace_id"] == "ws_alpha" and "ts" in ev
            if ev["type"] == "run.stage":
                assert "status" in ev
            if ev["type"] == "edge.packet":
                assert ev["phase"] in ("ready", "flowing", "delivered", "rejected")
                assert ev["phase"] != "idle"
                packets.append(ev)
        if len(packets) >= 1:
            break
        time.sleep(0.05)
    assert len(packets) >= 1


def test_bus_workspace_isolation():
    from ensemble_runtime.run.registry import reset_registry

    reg = reset_registry()
    reg.bus.publish(
        "ws_alpha",
        {"type": "seat.status", "seat_id": "seat_pm", "status": "idle"},
    )
    hist_b = reg.bus.history_after("ws_beta", None)
    assert not any(ev.get("seat_id") == "seat_pm" for ev in hist_b)
