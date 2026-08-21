"""Org tree → CrewAI projection (read-only).

Never writes tree.json. Staffing mutations must go through org/staffing commands.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .modes import CrewAIMode, get_crewai_mode


@dataclass(frozen=True)
class ProjectedAgent:
    seat_id: str
    role: str
    goal: str
    backstory: str
    runner: str | None = None
    is_manager: bool = False


@dataclass(frozen=True)
class ProjectedTask:
    task_id: str
    seat_id: str
    description: str
    expected_output: str
    depends_on: tuple[str, ...] = ()


@dataclass(frozen=True)
class CrewProjection:
    """Serializable projection result (safe without live LLM)."""

    mode: CrewAIMode
    process: str  # sequential | hierarchical
    agents: tuple[ProjectedAgent, ...]
    tasks: tuple[ProjectedTask, ...]
    skipped: bool = False
    skip_reason: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    def agent_ids(self) -> list[str]:
        return [a.seat_id for a in self.agents]


def _walk_seats(node: dict[str, Any], out: list[dict[str, Any]]) -> None:
    if not node:
        return
    kind = node.get("kind")
    if kind == "seat":
        out.append(node)
    for child in node.get("children") or []:
        if isinstance(child, dict):
            _walk_seats(child, out)


def _default_goal(role: str) -> str:
    return {
        "pm": "Clarify requirements and produce a brief.",
        "researcher": "Gather facts and constraints for implementation.",
        "engineer": "Implement the change and produce artifacts.",
        "reviewer": "Review output and gate quality.",
        "qa": "Test and report defects.",
    }.get(role, f"Execute role duties for {role}.")


def project_org_to_crew(
    tree: dict[str, Any],
    *,
    run_id: str | None = None,
    process: str = "sequential",
    mode: CrewAIMode | None = None,
    manager_seat_ids: frozenset[str] | None = None,
) -> CrewProjection:
    """Project an org tree (or active subtree) into a CrewAI-shaped plan.

    Parameters
    ----------
    tree:
        Full tree.json object or a subtree root wrapper with ``root`` key,
        or a single node dict with ``kind``/``children``.
    process:
        ``sequential`` (default) or ``hierarchical``.
    mode:
        Override env ``ENSEMBLE_CREWAI_MODE``.
    """
    resolved = mode or get_crewai_mode()
    if process not in ("sequential", "hierarchical"):
        process = "sequential"

    root = tree.get("root") if isinstance(tree.get("root"), dict) else tree
    seats: list[dict[str, Any]] = []
    _walk_seats(root, seats)

    if resolved == CrewAIMode.OFF:
        return CrewProjection(
            mode=resolved,
            process=process,
            agents=(),
            tasks=(),
            skipped=True,
            skip_reason="ENSEMBLE_CREWAI_MODE=off",
            meta={"run_id": run_id, "seat_count": len(seats)},
        )

    managers = manager_seat_ids or frozenset()
    agents: list[ProjectedAgent] = []
    tasks: list[ProjectedTask] = []
    prev_task_id: str | None = None

    for seat in seats:
        seat_id = str(seat.get("id") or "")
        if not seat_id:
            continue
        role = str(seat.get("role_template") or seat.get("role") or "engineer")
        name = str(seat.get("name") or role)
        agent = ProjectedAgent(
            seat_id=seat_id,
            role=role,
            goal=_default_goal(role),
            backstory=f"You are {name} ({role}) on the Ensemble org canvas.",
            runner=seat.get("runner"),
            is_manager=seat_id in managers,
        )
        agents.append(agent)
        task_id = f"task_{seat_id}"
        depends: tuple[str, ...] = (
            (prev_task_id,) if prev_task_id and process == "sequential" else ()
        )
        tasks.append(
            ProjectedTask(
                task_id=task_id,
                seat_id=seat_id,
                description=f"As {name}, complete your stage deliverable.",
                expected_output=f"Artifacts for seat {seat_id}",
                depends_on=depends,
            )
        )
        prev_task_id = task_id

    return CrewProjection(
        mode=resolved,
        process=process,
        agents=tuple(agents),
        tasks=tuple(tasks),
        skipped=False,
        meta={
            "run_id": run_id,
            "seat_count": len(agents),
            "framework": "crewai",
            # Live Crew instance is built only when mode=live and kickoff is requested (M4).
            "live_crew_deferred": resolved != CrewAIMode.LIVE,
        },
    )


def build_live_crew(projection: CrewProjection):  # type: ignore[no-untyped-def]
    """Materialize a real crewai.Crew from a projection (live mode only).

    Import is local so `off`/`mock` CI can avoid heavy optional side effects
    when only testing projection shape. M4 wires tools → RunnerJob.
    """
    if projection.mode != CrewAIMode.LIVE:
        raise RuntimeError("build_live_crew requires CrewAIMode.LIVE")
    if projection.skipped or not projection.agents:
        raise RuntimeError("empty projection")

    from crewai import Agent, Crew, Process, Task

    agents = [
        Agent(
            role=a.role,
            goal=a.goal,
            backstory=a.backstory,
            allow_delegation=a.is_manager,
            verbose=False,
        )
        for a in projection.agents
    ]
    by_seat = {a.seat_id: agents[i] for i, a in enumerate(projection.agents)}
    tasks = [
        Task(
            description=t.description,
            expected_output=t.expected_output,
            agent=by_seat[t.seat_id],
        )
        for t in projection.tasks
    ]
    process = Process.hierarchical if projection.process == "hierarchical" else Process.sequential
    return Crew(agents=agents, tasks=tasks, process=process, verbose=False)
