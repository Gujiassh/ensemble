"""Import PiRunner from repo root via pythonpath."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from runners.mock import RunnerJob  # noqa: E402
from runners.pi import run_pi  # noqa: E402


def test_pi_dry_run(tmp_path, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_PI_DRY_RUN", "1")
    job = RunnerJob(
        workspace_id="ws",
        run_id="r",
        stage="implement",
        seat_id="seat_eng",
        role_template="engineer",
        workspace_path=str(tmp_path),
        prompt="hello",
        expected_artifacts=["03-output.md"],
        runner="pi",
    )
    r = run_pi(job)
    assert r.ok
    assert (tmp_path / "03-output.md").exists()
