from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Iterable, Optional
from urllib.parse import quote

from fastapi import status

from supabase import Client, create_client

from ..dao import UploadDAO
from ..dtos import (
    CreateUploadResponse,
    UploadCreateRecord,
    UploadDTO,
    UploadFilePayload,
    UploadRequest,
)
from ..entities import ContentType, StoryStatus, Visibility
from ..utils.config import Settings
from .document_extractor import DocumentExtractor

logger = logging.getLogger(__name__)


class UploadServiceError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class UploadService:
    def __init__(
        self,
        settings: Settings,
        upload_dao: UploadDAO | None = None,
        service_client: Client | None = None,
        public_client: Client | None = None,
    ) -> None:
        supabase_url = str(settings.supabase_url)
        service_key = settings.supabase_service_role_key
        public_key = settings.supabase_anon_key or service_key

        self._service_client: Client = service_client or create_client(supabase_url, service_key)
        self._public_client: Client = public_client or create_client(supabase_url, public_key)
        self._upload_dao: UploadDAO = upload_dao or UploadDAO(self._service_client)
        self._settings = settings

    async def create_upload(
        self,
        request: UploadRequest,
        content_file: UploadFilePayload,
        thumbnail_file: Optional[UploadFilePayload] = None,
    ) -> CreateUploadResponse:
        content_path = self._build_object_path(request.user_id, content_file.filename)
        thumbnail_path = (
            self._build_object_path(request.user_id, thumbnail_file.filename)
            if thumbnail_file and thumbnail_file.filename
            else None
        )

        bucket = self._service_client.storage.from_("uploads")
        uploaded_paths: list[str] = []

        try:
            bucket.upload(
                content_path,
                content_file.data,
                {"content-type": content_file.content_type or "application/octet-stream"},
            )
            uploaded_paths.append(content_path)
            content_url = self._resolve_public_url(content_path)

            thumbnail_url = None
            if thumbnail_path and thumbnail_file:
                bucket.upload(
                    thumbnail_path,
                    thumbnail_file.data,
                    {"content-type": thumbnail_file.content_type or "image/jpeg"},
                )
                uploaded_paths.append(thumbnail_path)
                thumbnail_url = self._resolve_public_url(thumbnail_path)

            status_value, progress, extracted_text = self._derive_initial_status(
                content_file=content_file,
                user_id=request.user_id,
            )

            now = datetime.utcnow()
            record = UploadCreateRecord(
                user_id=request.user_id,
                content_type=request.content_type,
                visibility=request.visibility,
                title=request.title,
                description=request.description,
                content_file_id=content_path,
                thumbnail_file_id=thumbnail_path,
                status=status_value,
                progress=progress,
                extracted_text=extracted_text,
                created_at=now,
                updated_at=now,
            )

            upload = await self._upload_dao.create(record)
            dto = UploadDTO.from_entity(upload, content_url=content_url, thumbnail_url=thumbnail_url)
            return CreateUploadResponse(upload=dto)

        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("Failed to create upload: %s", exc, exc_info=exc)
            self._rollback_storage(bucket, uploaded_paths)
            raise UploadServiceError("Failed to create upload") from exc

    async def get_upload(self, upload_id: str) -> UploadDTO:
        upload = await self._upload_dao.find_by_id(upload_id)
        if upload is None:
            raise UploadServiceError(
                message=f"Upload with id {upload_id} not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        content_url = self._resolve_public_url(upload.content_file_id)
        thumbnail_url = self._resolve_public_url(upload.thumbnail_file_id)
        return UploadDTO.from_entity(upload, content_url=content_url, thumbnail_url=thumbnail_url)

    def _resolve_public_url(self, path: Optional[str]) -> Optional[str]:
        if not path:
            return None

        bucket = self._public_client.storage.from_("uploads")
        fallback = self._build_public_url(path)

        try:
            result = bucket.get_public_url(path)
        except Exception:  # pragma: no cover - network failure
            return fallback

        return self._extract_public_url(result, fallback)

    @staticmethod
    def _extract_public_url(result: Any, fallback: str) -> str:
        if isinstance(result, dict):
            data = result.get("data")
            if isinstance(data, dict):
                url = data.get("publicUrl") or data.get("publicURL")
                if url:
                    return url
            url = result.get("publicUrl") or result.get("publicURL")
            if url:
                return url
        return fallback

    @staticmethod
    def _build_object_path(user_id: str, filename: str | None) -> str:
        safe_name = filename or "upload"
        return f"{user_id}/{uuid.uuid4()}_{safe_name}"

    def _derive_initial_status(
        self,
        *,
        content_file: UploadFilePayload,
        user_id: str,
    ) -> tuple[StoryStatus, int, Optional[str]]:
        filename = content_file.filename or ""
        extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

        text_extensions = {"txt", "text"}
        document_extensions = {"pdf", "docx", "doc"}
        image_extensions = {"jpg", "jpeg", "png", "gif", "bmp", "webp"}

        if extension in text_extensions or extension in document_extensions:
            try:
                extracted_text = DocumentExtractor.extract_text(content_file.data, filename)
            except Exception as exc:  # pragma: no cover - library errors
                logger.warning("Error extracting text for user %s: %s", user_id, exc)
                return StoryStatus.FAILED, 0, None

            if extracted_text and extracted_text.strip():
                return StoryStatus.READY, 100, extracted_text
            logger.info("No text extracted from %s for user %s", filename, user_id)
            return StoryStatus.FAILED, 0, None

        if extension in image_extensions and self._settings.ocr_service_enabled:
            return StoryStatus.OCR_IN_PROGRESS, 0, None

        return StoryStatus.DRAFT, 0, None

    def _rollback_storage(self, bucket: Any, paths: Iterable[str]) -> None:
        if not paths:
            return
        try:
            bucket.remove(list(paths))
        except Exception:  # pragma: no cover - cleanup failure is non-critical
            logger.warning("Failed to rollback uploaded files: paths=%s", list(paths))

    def _build_public_url(self, path: str) -> str:
        base_url = str(self._settings.supabase_url).rstrip("/")
        normalized = path.lstrip("/")
        encoded = quote(normalized, safe="/")
        return f"{base_url}/storage/v1/object/public/uploads/{encoded}"


def make_upload_request(
    *,
    user_id: str,
    content_type: str,
    visibility: str,
    title: str,
    description: str | None,
) -> UploadRequest:
    return UploadRequest(
        user_id=user_id,
        content_type=_to_content_type(content_type),
        visibility=_to_visibility(visibility),
        title=title,
        description=description,
    )


def _to_content_type(value: str) -> ContentType:
    try:
        return ContentType(value.upper())
    except ValueError as exc:  # pragma: no cover - validated by caller
        raise UploadServiceError(f"Unsupported content type: {value}", status.HTTP_400_BAD_REQUEST) from exc


def _to_visibility(value: str) -> Visibility:
    try:
        return Visibility(value.upper())
    except ValueError as exc:  # pragma: no cover - validated by caller
        raise UploadServiceError(f"Unsupported visibility: {value}", status.HTTP_400_BAD_REQUEST) from exc
