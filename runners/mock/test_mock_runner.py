from pathlib import Path
from runners.mock import RunnerJob, run_mock


def test_writes_artifacts(tmp_path: Path):
    job = RunnerJob(
        workspace_id="w",
        run_id="r",
        stage="plan",
        seat_id="seat_eng",
        role_template="engineer",
        workspace_path=str(tmp_path),
        prompt="do it",
        expected_artifacts=["01-plan.md"],
    )
    res = run_mock(job)
    assert res.ok
    assert (tmp_path / "01-plan.md").exists()


def test_fail_missing(tmp_path: Path):
    job = RunnerJob(
        workspace_id="w",
        run_id="r",
        stage="plan",
        seat_id="s",
        role_template="engineer",
        workspace_path=str(tmp_path),
        prompt="x",
        expected_artifacts=["01-plan.md"],
    )
    res = run_mock(job, fail_missing=True)
    assert not res.ok
