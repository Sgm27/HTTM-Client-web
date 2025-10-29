from __future__ import annotations

from typing import Optional

from .base import DAO
from ..entities import File


class FileDAO(DAO):
    async def save_file(self, data: dict) -> File:
        raise NotImplementedError

    async def progress_ocr(self, file_id: str) -> dict[str, Optional[str | int]]:
        raise NotImplementedError
