from __future__ import annotations

from dataclasses import dataclass

from ..entities import StoryStatus


@dataclass
class CreateStoryRequest:
    upload_id: str


@dataclass
class GenerateAudioResponse:
    audio_url: str


@dataclass
class StoryResponse:
    id: str
    upload_id: str
    title: str
    content: str
    audio_url: str | None
    status: StoryStatus
    views: int
