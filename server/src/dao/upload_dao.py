from __future__ import annotations

from typing import Optional

from .base import DAO
from ..entities import Upload


class UploadDAO(DAO):
    async def create(
        self,
        upload: dict,
    ) -> Upload:
        raise NotImplementedError

    async def find_by_id(self, upload_id: str) -> Optional[Upload]:
        raise NotImplementedError

    async def mark_completed(self, upload_id: str) -> None:
        raise NotImplementedError

    async def mark_failed(self, upload_id: str, reason: str) -> None:
        raise NotImplementedError
