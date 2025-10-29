from __future__ import annotations

from typing import Optional

from .base import DAO
from ..entities import Story


class StoryDAO(DAO):
    async def get_story_by_id(self, story_id: str) -> Optional[Story]:
        raise NotImplementedError

    async def create_story(self, upload_id: str) -> Story:
        raise NotImplementedError

    async def generate_audio(self, story_id: str, options: dict | None = None) -> dict:
        raise NotImplementedError
