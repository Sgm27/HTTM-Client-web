from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Sequence, TYPE_CHECKING

from .base import DAO
from ..dtos import UploadCreateRecord
from ..entities import ContentType, StoryStatus, Upload, Visibility, ProcessingStatus

if TYPE_CHECKING:  # pragma: no cover - import for type checking only
    from supabase import Client  # pylint: disable=unused-import  # noqa: F401


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


def _parse_content_type(value: str | None) -> ContentType:
    if not value:
        return ContentType.TEXT
    try:
        return ContentType(value.upper())
    except ValueError:
        return ContentType.TEXT


def _parse_visibility(value: str | None) -> Visibility:
    if not value:
        return Visibility.PUBLIC
    try:
        return Visibility(value.upper())
    except ValueError:
        return Visibility.PUBLIC


def _parse_status(value: str | None) -> StoryStatus:
    if not value:
        return StoryStatus.DRAFT
    try:
        return StoryStatus(value.upper())
    except ValueError:
        return StoryStatus.DRAFT


def _parse_processing_status(value: str | None) -> ProcessingStatus:
    if not value:
        return ProcessingStatus.PENDING
    try:
        return ProcessingStatus(value.upper())
    except ValueError:
        return ProcessingStatus.PENDING


class UploadDAO(DAO):
    def __init__(self, connection: Any) -> None:
        super().__init__(connection)

    async def create(self, payload: UploadCreateRecord) -> Upload:
        response = self._connection.table("uploads").insert(payload.to_record()).execute()
        record = self._extract_single(response)
        return self._map_upload(record)

    async def find_by_id(self, upload_id: str) -> Optional[Upload]:
        response = self._connection.table("uploads").select("*").eq("id", upload_id).limit(1).execute()
        records: Sequence[dict[str, Any]] = getattr(response, "data", []) or []
        if not records:
            return None
        return self._map_upload(records[0])

    async def mark_completed(self, upload_id: str) -> None:
        now = datetime.utcnow().isoformat()
        self._connection.table("uploads").update(
            {
                "status": StoryStatus.READY.value,
                "progress": 100,
                "processing_status": ProcessingStatus.COMPLETED.value,
                "error_reason": None,
                "updated_at": now,
            }
        ).eq("id", upload_id).execute()

    async def mark_failed(self, upload_id: str, reason: str) -> None:
        now = datetime.utcnow().isoformat()
        self._connection.table("uploads").update(
            {
                "status": StoryStatus.FAILED.value,
                "processing_status": ProcessingStatus.FAILED.value,
                "error_reason": reason,
                "updated_at": now,
            }
        ).eq("id", upload_id).execute()

    async def update_processing(
        self,
        upload_id: str,
        *,
        status: ProcessingStatus | None = None,
        progress: int | None = None,
        extracted_text: str | None = None,
        ocr_text: str | None = None,
        story_status: StoryStatus | None = None,
    ) -> None:
        update: dict[str, object] = {"updated_at": datetime.utcnow().isoformat()}
        if status is not None:
            update["processing_status"] = status.value
        if progress is not None:
            update["progress"] = progress
        if extracted_text is not None:
            update["extracted_text"] = extracted_text
        if ocr_text is not None:
            update["ocr_text"] = ocr_text
        if story_status is not None:
            update["status"] = story_status.value

        if len(update) > 1:  # avoid empty updates beyond updated_at
            self._connection.table("uploads").update(update).eq("id", upload_id).execute()

    @staticmethod
    def _extract_single(response: Any) -> dict[str, Any]:
        data = getattr(response, "data", None)
        if isinstance(data, Sequence) and data:
            return data[0]
        raise ValueError("Empty response received from Supabase.")

    @staticmethod
    def _map_upload(record: dict[str, Any]) -> Upload:
        return Upload(
            id=str(record.get("id")),
            user_id=str(record.get("user_id")),
            content_type=_parse_content_type(record.get("content_type")),
            visibility=_parse_visibility(record.get("visibility")),
            title=record.get("title") or "",
            description=record.get("description"),
            content_file_id=record.get("content_file_id"),
            thumbnail_file_id=record.get("thumbnail_file_id"),
            status=_parse_status(record.get("status")),
            processing_status=_parse_processing_status(record.get("processing_status")),
            progress=record.get("progress"),
            error_reason=record.get("error_reason"),
            extracted_text=record.get("extracted_text"),
            ocr_text=record.get("ocr_text"),
            created_at=_parse_datetime(record.get("created_at")),
            updated_at=_parse_datetime(record.get("updated_at")),
        )
