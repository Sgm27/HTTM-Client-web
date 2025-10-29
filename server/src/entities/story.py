from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .enums import StoryStatus


@dataclass
class Story:
    id: str
    upload_id: str
    title: str
    content: str
    audio_url: str | None
    status: StoryStatus
    views: int
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def set_file(self, file_id: str) -> None:
        self.upload_id = file_id
        self.updated_at = datetime.utcnow()

    def publish(self) -> None:
        self.status = StoryStatus.PUBLISHED
        self.updated_at = datetime.utcnow()
