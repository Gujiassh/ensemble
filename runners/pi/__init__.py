"""PiRunner — spawn `pi -p` for Engineer seats (M4)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Re-export job/result shapes from mock to keep one protocol
from runners.mock import RunnerJob, RunnerResult  # noqa: F401


def pi_available(binary: str | None = None) -> bool:
    name = binary or os.environ.get("ENSEMBLE_PI_BIN", "pi")
    return shutil.which(name) is not None


def run_pi(
    job: RunnerJob,
    *,
    binary: str | None = None,
    timeout_s: int | None = None,
    dry_run: bool | None = None,
) -> RunnerResult:
    """Run pi non-interactively; write expected artifacts under workspace_path.

    If pi is missing or ENSEMBLE_PI_DRY_RUN=1 / dry_run=True, write a stub
    artifact that records the skip reason (mock fallback for demos).
    """
    root = Path(job.workspace_path)
    root.mkdir(parents=True, exist_ok=True)
    bin_name = binary or os.environ.get("ENSEMBLE_PI_BIN", "pi")
    timeout = timeout_s if timeout_s is not None else job.timeout_s
    if dry_run is None:
        dry_run = os.environ.get("ENSEMBLE_PI_DRY_RUN", "").lower() in {
            "1",
            "true",
            "yes",
        }

    if dry_run or not pi_available(bin_name):
        reason = "dry_run" if dry_run else "pi_not_found"
        return _write_fallback(job, root, reason=reason, provider="pi-fallback")

    session_dir = root.parent / "sessions" / job.seat_id
    session_dir.mkdir(parents=True, exist_ok=True)
    expected = list(job.expected_artifacts) or ["03-output.md"]
    # Ask pi to produce the first expected file as primary deliverable
    primary = expected[0]
    prompt = (
        f"{job.prompt}\n\n"
        f"Working directory is {root}. "
        f"Write your deliverable to ./{primary}. "
        f"Stage={job.stage} seat={job.seat_id}."
    )
    cmd = [
        bin_name,
        "-p",
        "--mode",
        "text",
        "--session-dir",
        str(session_dir),
        "--tools",
        "read,bash,edit,write",
        prompt,
    ]
    logs_path = session_dir / "pi.log"
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "PI_OFFLINE": os.environ.get("PI_OFFLINE", "1")},
            check=False,
        )
    except subprocess.TimeoutExpired as e:
        logs_path.write_text(
            f"timeout after {timeout}s\nstdout={e.stdout}\nstderr={e.stderr}\n",
            encoding="utf-8",
        )
        return RunnerResult(
            ok=False,
            summary=f"pi_timeout after {timeout}s",
            artifacts=[],
            logs_path=str(logs_path),
            provider="pi",
            exit_code=124,
        )
    except FileNotFoundError:
        return _write_fallback(job, root, reason="pi_not_found", provider="pi-fallback")

    logs_path.write_text(
        f"cmd={' '.join(cmd)}\nexit={proc.returncode}\n"
        f"--- stdout ---\n{proc.stdout}\n--- stderr ---\n{proc.stderr}\n",
        encoding="utf-8",
    )

    written: list[str] = []
    missing: list[str] = []
    for name in expected:
        path = root / name
        if path.exists():
            written.append(str(path))
        else:
            missing.append(name)

    if missing and proc.returncode == 0:
        # pi succeeded but did not write expected files — materialize from stdout
        for name in missing:
            path = root / name
            path.write_text(
                f"# {name}\n\nprovider=pi\nstage={job.stage}\n\n"
                f"{job.prompt}\n\n--- pi stdout ---\n{proc.stdout}\n",
                encoding="utf-8",
            )
            written.append(str(path))
        missing = []

    ok = proc.returncode == 0 and not missing
    return RunnerResult(
        ok=ok,
        summary="ok" if ok else f"pi_exit={proc.returncode} missing={missing}",
        artifacts=written,
        logs_path=str(logs_path),
        provider="pi",
        exit_code=proc.returncode,
    )


def _write_fallback(
    job: RunnerJob,
    root: Path,
    *,
    reason: str,
    provider: str,
) -> RunnerResult:
    written: list[str] = []
    expected = list(job.expected_artifacts) or ["03-output.md"]
    for name in expected:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            f"# {name}\n\nprovider={provider}\nreason={reason}\n"
            f"stage={job.stage}\nseat={job.seat_id}\n\n{job.prompt}\n",
            encoding="utf-8",
        )
        written.append(str(path))
    return RunnerResult(
        ok=True,
        summary=f"fallback:{reason}",
        artifacts=written,
        provider=provider,
        exit_code=0,
    )
