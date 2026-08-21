"""MockRunner — writes expected artifacts under run dir."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class RunnerJob:
    workspace_id: str
    run_id: str
    stage: str
    seat_id: str
    role_template: str
    workspace_path: str
    prompt: str
    inputs: list[str] = field(default_factory=list)
    expected_artifacts: list[str] = field(default_factory=list)
    timeout_s: int = 60
    runner: str = "mock"


@dataclass
class RunnerResult:
    ok: bool
    summary: str
    artifacts: list[str] = field(default_factory=list)
    logs_path: str | None = None
    provider: str = "mock"
    exit_code: int = 0


def run_mock(job: RunnerJob, *, fail_missing: bool = False) -> RunnerResult:
    root = Path(job.workspace_path)
    root.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    if fail_missing:
        return RunnerResult(ok=False, summary="intentional miss", exit_code=1)
    for name in job.expected_artifacts:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            f"# {name}\n\nstage={job.stage}\nseat={job.seat_id}\n\n{job.prompt}\n",
            encoding="utf-8",
        )
        written.append(str(path))
    if not job.expected_artifacts:
        return RunnerResult(ok=False, summary="no expected artifacts", exit_code=2)
    return RunnerResult(ok=True, summary=f"wrote {len(written)}", artifacts=written)
