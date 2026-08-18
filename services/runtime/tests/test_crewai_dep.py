"""Ensure CrewAI is a hard runtime dependency (declared + importable when installed)."""

from __future__ import annotations

from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def test_pyproject_declares_crewai():
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert "crewai" in text.lower()
    assert "crewai>=" in text or "\"crewai" in text or "crewai>=" in text


def test_crewai_importable_when_installed():
    pytest.importorskip("crewai")
    import crewai

    assert crewai is not None
