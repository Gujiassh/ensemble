from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path
from typing import Any

import yaml

ACTION_SHA = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[a-f0-9]{40}$")


def validate_workflow_text(text: str) -> list[str]:
    errors: list[str] = []
    try:
        workflow = yaml.safe_load(text)
    except yaml.YAMLError:
        return ["workflow_yaml_syntax"]
    if not isinstance(workflow, dict) or not isinstance(workflow.get("jobs"), dict):
        return ["workflow_schema"]
    uses_values = re.findall(r"^\s*(?:-\s*)?uses:\s*([^\s#]+)", text, flags=re.MULTILINE)
    if not uses_values:
        errors.append("workflow_actions_missing")
    for value in uses_values:
        if not ACTION_SHA.fullmatch(value):
            errors.append(f"workflow_action_unpinned:{value}")
    quality_job = workflow["jobs"].get("quality", {})
    steps = quality_job.get("steps", []) if isinstance(quality_job, dict) else []
    run_commands = [step.get("run") for step in steps if isinstance(step, dict)]
    if "pnpm quality" not in run_commands:
        errors.append("workflow_aggregate_missing")
    return errors


def validate_repository(root: Path) -> list[str]:
    errors: list[str] = []
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    config = json.loads((root / "scripts/quality/quality.config.json").read_text(encoding="utf-8"))
    for manifest in (
        "architecture-debt.json",
        "formatter-debt.json",
        "shape-exceptions.json",
        "soft-warning-reviews.json",
    ):
        value = json.loads((root / "scripts/quality" / manifest).read_text(encoding="utf-8"))
        if value.get("version") != 1:
            errors.append(f"manifest_version:{manifest}")
    node_version = (root / ".node-version").read_text(encoding="utf-8").strip()
    if node_version != "22.22.0" or package.get("engines", {}).get("node") != ">=22.22.0 <23":
        errors.append("node_version_mismatch")
    workflow_text = (root / ".github/workflows/quality.yml").read_text(encoding="utf-8")
    errors.extend(validate_workflow_text(workflow_text))
    if f"node-version: {node_version}" not in workflow_text:
        errors.append("workflow_node_version_mismatch")
    if "python-version: 3.12.3" not in workflow_text or "uv==0.11.21" not in workflow_text:
        errors.append("workflow_python_version_mismatch")
    with (root / "rust-toolchain.toml").open("rb") as stream:
        rust = tomllib.load(stream)
    if rust.get("toolchain", {}).get("channel") != "1.95.0":
        errors.append("rust_toolchain_mismatch")
    if "rustup toolchain install 1.95.0" not in workflow_text:
        errors.append("workflow_rust_version_mismatch")
    with (root / "services/runtime/pyproject.toml").open("rb") as stream:
        python_project: dict[str, Any] = tomllib.load(stream)
    dev = python_project["project"]["optional-dependencies"]["dev"]
    if "pyyaml==6.0.3" not in dev:
        errors.append("workflow_parser_unlocked")
    if config.get("shape", {}).get("maxExceptionReviewDays") != 180:
        errors.append("exception_review_horizon")
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    errors = validate_repository(root)
    for error in errors:
        print(f"quality_config_error code={json.dumps(error)}")
    print(f"quality_config_summary status={'pass' if not errors else 'fail'} errors={len(errors)}")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
