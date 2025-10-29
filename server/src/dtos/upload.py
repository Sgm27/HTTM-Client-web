from __future__ import annotations

from dataclasses import dataclass

from ..entities import ContentType, Visibility, StoryStatus


@dataclass
class UploadRequest:
    user_id: str
    content_type: ContentType
    visibility: Visibility
    title: str
    description: str | None
    content_file_id: str
    thumbnail_file_id: str | None


@dataclass
class UploadResponse:
    id: str
    status: StoryStatus
    progress: int | None = None
