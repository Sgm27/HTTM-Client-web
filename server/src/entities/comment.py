from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Comment:
    id: str
    story_id: str
    user_id: str
    text: str
    created_at: datetime = field(default_factory=datetime.utcnow)
