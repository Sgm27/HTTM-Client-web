from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .enums import ContentType, StoryStatus, Visibility


@dataclass
class Upload:
    id: str
    user_id: str
    content_type: ContentType
    visibility: Visibility
    title: str
    description: str | None
    content_file_id: str
    thumbnail_file_id: str | None
    status: StoryStatus
    progress: int | None = None
    error_reason: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def mark_completed(self) -> None:
        self.status = StoryStatus.READY
        self.progress = 100
        self.error_reason = None
        self.updated_at = datetime.utcnow()

    def mark_failed(self, reason: str) -> None:
        self.status = StoryStatus.FAILED
        self.error_reason = reason
        self.updated_at = datetime.utcnow()
