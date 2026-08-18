"""CrewAI projection: shape + no tree mutation."""

from __future__ import annotations

import copy

from ensemble_runtime.crew import CrewAIMode, project_org_to_crew


SAMPLE_TREE = {
    "root": {
        "id": "group_default",
        "kind": "group",
        "name": "Default",
        "parent_id": None,
        "children": [
            {
                "id": "seat_eng",
                "kind": "seat",
                "name": "Engineer",
                "parent_id": "group_default",
                "role_template": "engineer",
                "runner": "pi",
                "children": [],
            }
        ],
    },
    "edges": [],
}


FOUR_CREW = {
    "root": {
        "id": "g",
        "kind": "group",
        "children": [
            {"id": "pm", "kind": "seat", "name": "PM", "role_template": "pm", "children": []},
            {
                "id": "res",
                "kind": "seat",
                "name": "Researcher",
                "role_template": "researcher",
                "children": [],
            },
            {
                "id": "eng",
                "kind": "seat",
                "name": "Engineer",
                "role_template": "engineer",
                "runner": "pi",
                "children": [],
            },
            {
                "id": "rev",
                "kind": "seat",
                "name": "Reviewer",
                "role_template": "reviewer",
                "children": [],
            },
        ],
    },
    "edges": [],
}


def test_single_seat_projection_mock():
    proj = project_org_to_crew(SAMPLE_TREE, run_id="r1", mode=CrewAIMode.MOCK)
    assert proj.skipped is False
    assert proj.meta["framework"] == "crewai"
    assert len(proj.agents) == 1
    assert proj.agents[0].seat_id == "seat_eng"
    assert proj.agents[0].runner == "pi"
    assert len(proj.tasks) == 1


def test_off_mode_skips_crew():
    proj = project_org_to_crew(SAMPLE_TREE, mode=CrewAIMode.OFF)
    assert proj.skipped is True
    assert proj.agents == ()


def test_projection_does_not_mutate_tree():
    original = copy.deepcopy(SAMPLE_TREE)
    tree = copy.deepcopy(SAMPLE_TREE)
    project_org_to_crew(tree, mode=CrewAIMode.MOCK)
    assert tree == original


def test_four_crew_sequential_depends():
    proj = project_org_to_crew(FOUR_CREW, process="sequential", mode=CrewAIMode.MOCK)
    assert len(proj.agents) == 4
    assert proj.tasks[0].depends_on == ()
    assert proj.tasks[1].depends_on == ("task_pm",)
    assert proj.tasks[2].depends_on == ("task_res",)
    assert proj.tasks[3].depends_on == ("task_eng",)
