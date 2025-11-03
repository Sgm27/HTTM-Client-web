from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Sequence

from .base import DAO
from ..dtos import UploadImageCreateRecord
from ..entities import ProcessingStatus, UploadImage


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.rstrip("Z")
        if normalized != value:
            normalized = f"{normalized}+00:00"
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return datetime.utcnow()
    return datetime.utcnow()


def _parse_processing_status(value: str | None) -> ProcessingStatus:
    if not value:
        return ProcessingStatus.PENDING
    try:
        return ProcessingStatus(value.upper())
    except ValueError:
        return ProcessingStatus.PENDING


class UploadImageDAO(DAO):
    table_name = "upload_images"

    async def create_many(self, records: Iterable[UploadImageCreateRecord]) -> list[UploadImage]:
        payload = [record.to_record() for record in records]
        if not payload:
            return []
        response = self._connection.table(self.table_name).insert(payload).execute()
        return [self._map(row) for row in getattr(response, "data", []) or []]

    async def list_by_upload(self, upload_id: str) -> list[UploadImage]:
        response = (
            self._connection.table(self.table_name)
            .select("*")
            .eq("upload_id", upload_id)
            .order("order_index")
            .execute()
        )
        return [self._map(row) for row in getattr(response, "data", []) or []]

    async def list_by_story(self, story_id: str) -> list[UploadImage]:
        response = (
            self._connection.table(self.table_name)
            .select("*")
            .eq("story_id", story_id)
            .order("order_index")
            .execute()
        )
        return [self._map(row) for row in getattr(response, "data", []) or []]

    async def update_image(
        self,
        image_id: str,
        *,
        status: ProcessingStatus | None = None,
        progress: int | None = None,
        extracted_text: str | None = None,
        public_url: str | None = None,
        story_id: str | None = None,
    ) -> UploadImage | None:
        update: dict[str, object] = {"updated_at": datetime.utcnow().isoformat()}
        if status is not None:
            update["status"] = status.value
        if progress is not None:
            update["progress"] = progress
        if extracted_text is not None:
            update["extracted_text"] = extracted_text
        if public_url is not None:
            update["public_url"] = public_url
        if story_id is not None:
            update["story_id"] = story_id

        response = self._connection.table(self.table_name).update(update).eq("id", image_id).execute()
        records: Sequence[dict[str, Any]] = getattr(response, "data", []) or []
        if not records:
            return None
        return self._map(records[0])

    async def bulk_assign_story(self, upload_id: str, story_id: str) -> None:
        self._connection.table(self.table_name).update(
            {
                "story_id": story_id,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("upload_id", upload_id).execute()

    @staticmethod
    def _map(record: dict[str, Any]) -> UploadImage:
        return UploadImage(
            id=str(record.get("id")),
            upload_id=str(record.get("upload_id")),
            storage_path=record.get("storage_path") or "",
            mime_type=record.get("mime_type") or "",
            order_index=int(record.get("order_index") or 0),
            status=_parse_processing_status(record.get("status")),
            progress=int(record.get("progress") or 0),
            story_id=record.get("story_id"),
            public_url=record.get("public_url"),
            file_size=int(record.get("file_size")) if record.get("file_size") is not None else None,
            extracted_text=record.get("extracted_text"),
            created_at=_parse_datetime(record.get("created_at")),
            updated_at=_parse_datetime(record.get("updated_at")),
        )
