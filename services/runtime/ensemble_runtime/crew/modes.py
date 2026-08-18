"""CrewAI runtime modes."""

from __future__ import annotations

import os
from enum import Enum


class CrewAIMode(str, Enum):
    """How aggressively we instantiate CrewAI.

    - off: no Crew; single-agent stage loop still valid
    - mock: full projection shape; mock LLM/tools (CI / no key)
    - live: real CrewAI + configured LLM; coding still via Runner
    """

    OFF = "off"
    MOCK = "mock"
    LIVE = "live"


def get_crewai_mode(default: CrewAIMode = CrewAIMode.MOCK) -> CrewAIMode:
    raw = os.environ.get("ENSEMBLE_CREWAI_MODE", default.value).strip().lower()
    try:
        return CrewAIMode(raw)
    except ValueError:
        return default
