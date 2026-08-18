"""Runner dispatch: mock | pi (M4)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

_REPO = Path(__file__).resolve().parents[4]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from runners.mock import RunnerJob, RunnerResult, run_mock  # noqa: E402


def resolve_runner(requested: str | None, *, stage: str = "") -> str:
    """Pick effective runner. ENSEMBLE_FORCE_MOCK=1 forces mock."""
    if os.environ.get("ENSEMBLE_FORCE_MOCK", "").lower() in {"1", "true", "yes"}:
        return "mock"
    name = (requested or "mock").lower()
    if name == "pi":
        return "pi"
    return "mock"


def run_job(job: RunnerJob) -> RunnerResult:
    runner = resolve_runner(job.runner, stage=job.stage)
    if runner == "pi":
        from runners.pi import run_pi

        return run_pi(job)
    return run_mock(job)
