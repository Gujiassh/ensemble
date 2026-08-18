"""CrewAI projection layer (read-only over Org tree).

Locked AI framework: CrewAI (see docs/ssot/crewai.md).
"""

from .modes import CrewAIMode, get_crewai_mode
from .project import CrewProjection, project_org_to_crew

__all__ = [
    "CrewAIMode",
    "CrewProjection",
    "get_crewai_mode",
    "project_org_to_crew",
]
