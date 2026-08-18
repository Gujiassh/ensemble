"""Filesystem persist for workspaces (M3)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def data_root() -> Path:
    env = os.environ.get("ENSEMBLE_DATA_DIR")
    if env:
        return Path(env)
    # repo data/ relative to services/runtime → ../../data
    here = Path(__file__).resolve()
    return here.parents[4] / "data"


def workspace_dir(workspace_id: str) -> Path:
    return data_root() / "workspaces" / workspace_id


def ensure_workspace(workspace_id: str, workspace: dict[str, Any], org: dict[str, Any]) -> Path:
    d = workspace_dir(workspace_id)
    (d / "org").mkdir(parents=True, exist_ok=True)
    (d / "runs").mkdir(parents=True, exist_ok=True)
    (d / "workspace.json").write_text(
        json.dumps(workspace, indent=2) + "\n", encoding="utf-8"
    )
    save_org(workspace_id, org)
    return d


def save_org(workspace_id: str, org: dict[str, Any]) -> None:
    path = workspace_dir(workspace_id) / "org" / "tree.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(org, indent=2) + "\n", encoding="utf-8")


def load_org(workspace_id: str) -> dict[str, Any] | None:
    path = workspace_dir(workspace_id) / "org" / "tree.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def run_dir(workspace_id: str, run_id: str) -> Path:
    d = workspace_dir(workspace_id) / "runs" / run_id
    (d / "artifacts").mkdir(parents=True, exist_ok=True)
    (d / "sessions").mkdir(parents=True, exist_ok=True)
    return d


def append_timeline(workspace_id: str, run_id: str, row: dict[str, Any]) -> None:
    path = run_dir(workspace_id, run_id) / "timeline.jsonl"
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def write_state(workspace_id: str, run_id: str, state: dict[str, Any]) -> None:
    path = run_dir(workspace_id, run_id) / "state.json"
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def write_roster(workspace_id: str, run_id: str, entries: list[dict[str, Any]]) -> None:
    path = run_dir(workspace_id, run_id) / "roster.json"
    path.write_text(json.dumps({"entries": entries}, indent=2) + "\n", encoding="utf-8")
