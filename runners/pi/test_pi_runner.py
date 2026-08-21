"""PiRunner unit tests (no live LLM required)."""

from __future__ import annotations

from runners.mock import RunnerJob
from runners.pi import pi_available, run_pi


def test_dry_run_writes_expected(tmp_path, monkeypatch):
    monkeypatch.setenv("ENSEMBLE_PI_DRY_RUN", "1")
    job = RunnerJob(
        workspace_id="ws",
        run_id="r1",
        stage="implement",
        seat_id="seat_eng",
        role_template="engineer",
        workspace_path=str(tmp_path),
        prompt="fix bug",
        expected_artifacts=["03-output.md"],
        runner="pi",
    )
    result = run_pi(job)
    assert result.ok
    assert result.provider == "pi-fallback"
    assert "dry_run" in result.summary
    assert (tmp_path / "03-output.md").exists()
    assert "fix bug" in (tmp_path / "03-output.md").read_text()


def test_missing_binary_falls_back(tmp_path, monkeypatch):
    monkeypatch.delenv("ENSEMBLE_PI_DRY_RUN", raising=False)
    monkeypatch.setenv("ENSEMBLE_PI_BIN", "pi-definitely-missing-xyz")
    job = RunnerJob(
        workspace_id="ws",
        run_id="r1",
        stage="implement",
        seat_id="seat_eng",
        role_template="engineer",
        workspace_path=str(tmp_path),
        prompt="x",
        expected_artifacts=["03-patch.diff"],
        runner="pi",
    )
    result = run_pi(job)
    assert result.ok
    assert result.provider == "pi-fallback"
    assert (tmp_path / "03-patch.diff").exists()


def test_pi_available_smoke():
    # environment may or may not have pi; just ensure callable
    assert isinstance(pi_available(), bool)
