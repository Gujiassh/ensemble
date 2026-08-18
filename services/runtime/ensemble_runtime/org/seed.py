"""Seed workspaces for M2 mock (in-memory + optional data/ mirror)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def _seat(
    id: str,
    name: str,
    parent: str,
    role: str,
    runner: str | None = "mock",
    children: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "kind": "seat",
        "name": name,
        "parent_id": parent,
        "role_template": role,
        "runner": runner,
        "children": children or [],
    }


def workspace_alpha() -> dict[str, Any]:
    """Two groups: Product + Engineering (filter demo)."""
    return {
        "workspace": {
            "id": "ws_alpha",
            "name": "Alpha — Auth fix",
            "title": "Auth retry",
        },
        "org": {
            "root": {
                "id": "group_root",
                "kind": "group",
                "name": "Alpha",
                "parent_id": None,
                "children": [
                    {
                        "id": "group_product",
                        "kind": "group",
                        "name": "Product",
                        "parent_id": "group_root",
                        "children": [
                            _seat("seat_pm", "PM", "group_product", "pm"),
                            _seat("seat_res", "Researcher", "group_product", "researcher"),
                        ],
                    },
                    {
                        "id": "group_eng",
                        "kind": "group",
                        "name": "Engineering",
                        "parent_id": "group_root",
                        "children": [
                            _seat("seat_eng", "Engineer", "group_eng", "engineer", "pi"),
                            _seat("seat_rev", "Reviewer", "group_eng", "reviewer"),
                        ],
                    },
                ],
            },
            "edges": [
                {"id": "e_pm_res", "from": "seat_pm", "to": "seat_res", "kind": "handoff"},
                {"id": "e_res_eng", "from": "seat_res", "to": "seat_eng", "kind": "handoff"},
                {"id": "e_eng_rev", "from": "seat_eng", "to": "seat_rev", "kind": "handoff"},
            ],
        },
    }


def workspace_beta() -> dict[str, Any]:
    """Single-agent workspace for isolation demo."""
    return {
        "workspace": {
            "id": "ws_beta",
            "name": "Beta — Solo eng",
            "title": "Solo patch",
        },
        "org": {
            "root": {
                "id": "group_default",
                "kind": "group",
                "name": "Default",
                "parent_id": None,
                "children": [
                    _seat("seat_eng", "Engineer", "group_default", "engineer", "pi"),
                ],
            },
            "edges": [],
        },
    }


def all_seeds() -> dict[str, dict[str, Any]]:
    return {
        "ws_alpha": deepcopy(workspace_alpha()),
        "ws_beta": deepcopy(workspace_beta()),
    }
