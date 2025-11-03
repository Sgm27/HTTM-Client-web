from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Optional, Sequence
from urllib.parse import quote

from fastapi import BackgroundTasks, status

from supabase import Client, create_client

from ..dao import UploadDAO, UploadImageDAO
from ..dtos import (
    CreateUploadResponse,
    UploadCreateRecord,
    UploadDTO,
    UploadFilePayload,
    UploadRequest,
    UploadImageCreateRecord,
)
from ..entities import ContentType, StoryStatus, Visibility, ProcessingStatus, UploadImage
from ..utils.config import Settings
from .document_extractor import DocumentExtractor
from .ocr import ocr_service, DEFAULT_OCR_PROMPT

logger = logging.getLogger(__name__)


class UploadServiceError(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(slots=True)
class _PreparedFile:
    payload: UploadFilePayload
    storage_path: str
    public_url: str | None
    is_image: bool
    order_index: int


class UploadService:
    def __init__(
        self,
        settings: Settings,
        upload_dao: UploadDAO | None = None,
        upload_image_dao: UploadImageDAO | None = None,
        service_client: Client | None = None,
        public_client: Client | None = None,
    ) -> None:
        supabase_url = str(settings.supabase_url)
        service_key = settings.supabase_service_role_key
        public_key = settings.supabase_anon_key or service_key

        self._service_client: Client = service_client or create_client(supabase_url, service_key)
        self._public_client: Client = public_client or create_client(supabase_url, public_key)
        self._upload_dao: UploadDAO = upload_dao or UploadDAO(self._service_client)
        self._upload_image_dao: UploadImageDAO = upload_image_dao or UploadImageDAO(self._service_client)
        self._settings = settings

    async def create_upload(
        self,
        request: UploadRequest,
        content_files: Sequence[UploadFilePayload],
        thumbnail_file: Optional[UploadFilePayload] = None,
        background_tasks: BackgroundTasks | None = None,
    ) -> CreateUploadResponse:
        if not content_files:
            raise UploadServiceError("No content files provided", status.HTTP_400_BAD_REQUEST)

        bucket = self._service_client.storage.from_("uploads")
        uploaded_paths: list[str] = []

        try:
            prepared_files: list[_PreparedFile] = []
            for index, payload in enumerate(content_files):
                content_path = self._build_object_path(request.user_id, payload.filename)
                bucket.upload(
                    content_path,
                    payload.data,
                    {"content-type": payload.content_type or "application/octet-stream"},
                )
                uploaded_paths.append(content_path)
                prepared_files.append(
                    _PreparedFile(
                        payload=payload,
                        storage_path=content_path,
                        public_url=self._resolve_public_url(content_path),
                        is_image=self._is_image_file(payload),
                        order_index=index,
                    )
                )

            if not prepared_files:
                raise UploadServiceError("Không thể chuẩn bị file tải lên", status.HTTP_400_BAD_REQUEST)

            thumbnail_url = None
            thumbnail_path = None
            if thumbnail_file and thumbnail_file.filename:
                thumbnail_path = self._build_object_path(request.user_id, thumbnail_file.filename)
                bucket.upload(
                    thumbnail_path,
                    thumbnail_file.data,
                    {"content-type": thumbnail_file.content_type or "image/jpeg"},
                )
                uploaded_paths.append(thumbnail_path)
                thumbnail_url = self._resolve_public_url(thumbnail_path)

            story_status, processing_status, progress, extracted_text, ocr_text = self._derive_initial_state(
                prepared_files=prepared_files,
                user_id=request.user_id,
            )

            now = datetime.utcnow()
            primary_path = prepared_files[0].storage_path
            record = UploadCreateRecord(
                user_id=request.user_id,
                content_type=request.content_type,
                visibility=request.visibility,
                title=request.title,
                description=request.description,
                content_file_id=primary_path,
                thumbnail_file_id=thumbnail_path,
                status=story_status,
                processing_status=processing_status,
                progress=progress,
                extracted_text=extracted_text,
                ocr_text=ocr_text,
                created_at=now,
                updated_at=now,
            )

            upload = await self._upload_dao.create(record)

            image_prepared = [item for item in prepared_files if item.is_image]
            image_records: list[UploadImage] = []

            if image_prepared:
                create_records = [
                    UploadImageCreateRecord(
                        upload_id=upload.id,
                        storage_path=item.storage_path,
                        mime_type=item.payload.content_type or "image/jpeg",
                        file_size=len(item.payload.data),
                        order_index=item.order_index,
                        public_url=item.public_url,
                        status=ProcessingStatus.PROCESSING if processing_status == ProcessingStatus.PROCESSING else ProcessingStatus.PENDING,
                        progress=0,
                    )
                    for item in image_prepared
                ]
                image_records = await self._upload_image_dao.create_many(create_records)

                if processing_status == ProcessingStatus.PROCESSING and self._settings.ocr_service_enabled:
                    if background_tasks:
                        for prepared, image in zip(image_prepared, image_records):
                            background_tasks.add_task(self._process_image_ocr, upload.id, image.id, prepared)
                    else:
                        for prepared, image in zip(image_prepared, image_records):
                            await self._process_image_ocr(upload.id, image.id, prepared)

            content_url = prepared_files[0].public_url
            dto = UploadDTO.from_entity(
                upload,
                content_url=content_url,
                thumbnail_url=thumbnail_url,
                images=image_records,
            )
            return CreateUploadResponse(upload=dto)

        except UploadServiceError:
            self._rollback_storage(bucket, uploaded_paths)
            raise
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
        images = await self._upload_image_dao.list_by_upload(upload_id)
        return UploadDTO.from_entity(upload, content_url=content_url, thumbnail_url=thumbnail_url, images=images)

    async def get_ocr_progress(self, upload_id: str) -> dict[str, object]:
        upload = await self._upload_dao.find_by_id(upload_id)
        if upload is None:
            raise UploadServiceError(
                message=f"Upload với id {upload_id} không tồn tại",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        images = await self._upload_image_dao.list_by_upload(upload_id)
        return {
            "status": upload.processing_status.value,
            "storyStatus": upload.status.value,
            "progress": upload.progress or 0,
            "ocrText": upload.ocr_text,
            "extractedText": upload.extracted_text,
            "images": [
                {
                    "id": image.id,
                    "uploadId": image.upload_id,
                    "storyId": image.story_id,
                    "status": image.status.value,
                    "progress": image.progress,
                    "publicUrl": image.public_url,
                    "storagePath": image.storage_path,
                    "order": image.order_index,
                    "extractedText": image.extracted_text,
                }
                for image in images
            ],
        }

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

    def _derive_initial_state(
        self,
        *,
        prepared_files: Sequence[_PreparedFile],
        user_id: str,
    ) -> tuple[StoryStatus, ProcessingStatus, int, Optional[str], Optional[str]]:
        image_files = [item for item in prepared_files if item.is_image]
        non_image_files = [item for item in prepared_files if not item.is_image]

        if image_files:
            if non_image_files:
                raise UploadServiceError(
                    "Không hỗ trợ tải đồng thời ảnh và tài liệu trong cùng một lần upload.",
                    status.HTTP_400_BAD_REQUEST,
                )
            if not self._settings.ocr_service_enabled:
                raise UploadServiceError(
                    "OCR service đang tắt. Vui lòng bật OCR hoặc tải file văn bản.",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return (
                StoryStatus.OCR_IN_PROGRESS,
                ProcessingStatus.PROCESSING,
                0,
                None,
                None,
            )

        primary = prepared_files[0]
        if len(prepared_files) > 1:
            raise UploadServiceError(
                "Hiện chỉ hỗ trợ một file văn bản mỗi lần tải lên.",
                status.HTTP_400_BAD_REQUEST,
            )

        if not self._is_document_file(primary.payload):
            raise UploadServiceError(
                "Định dạng file không được hỗ trợ cho việc trích xuất văn bản.",
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        filename = primary.payload.filename or "upload"
        try:
            extracted_text = DocumentExtractor.extract_text(primary.payload.data, filename)
        except Exception as exc:  # pragma: no cover - library errors
            logger.warning("Error extracting text for user %s: %s", user_id, exc)
            raise UploadServiceError(
                "Không thể trích xuất văn bản từ file đã tải lên.",
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            ) from exc

        if not extracted_text or not extracted_text.strip():
            raise UploadServiceError(
                "File không chứa nội dung văn bản hợp lệ.",
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        cleaned = extracted_text.strip()
        return (
            StoryStatus.READY,
            ProcessingStatus.COMPLETED,
            100,
            cleaned,
            cleaned,
        )

    @staticmethod
    def _is_image_file(payload: UploadFilePayload) -> bool:
        if payload.content_type and payload.content_type.lower().startswith("image/"):
            return True
        filename = (payload.filename or "").lower()
        if "." in filename:
            extension = filename.rsplit(".", 1)[-1]
            return extension in {"jpg", "jpeg", "png", "gif", "bmp", "webp", "tif", "tiff", "heic"}
        return False

    @staticmethod
    def _is_document_file(payload: UploadFilePayload) -> bool:
        if payload.content_type:
            lowered = payload.content_type.lower()
            if lowered in {"text/plain", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}:
                return True
        filename = (payload.filename or "").lower()
        if "." not in filename:
            return False
        extension = filename.rsplit(".", 1)[-1]
        return extension in {"txt", "text", "pdf", "doc", "docx"}

    async def _process_image_ocr(self, upload_id: str, image_id: str, prepared: _PreparedFile) -> None:
        try:
            await self._upload_image_dao.update_image(
                image_id,
                status=ProcessingStatus.PROCESSING,
                progress=5,
            )

            text = await self._run_ocr_bytes(prepared.payload)

            await self._upload_image_dao.update_image(
                image_id,
                status=ProcessingStatus.COMPLETED,
                progress=100,
                extracted_text=text.strip() if text else None,
            )

        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("OCR processing failed for upload %s image %s: %s", upload_id, image_id, exc)
            await self._upload_image_dao.update_image(
                image_id,
                status=ProcessingStatus.FAILED,
                progress=0,
            )
            await self._upload_dao.update_processing(
                upload_id,
                status=ProcessingStatus.FAILED,
                story_status=StoryStatus.FAILED,
            )
            return

        await self._refresh_upload_progress(upload_id)

    async def _refresh_upload_progress(self, upload_id: str) -> None:
        images = await self._upload_image_dao.list_by_upload(upload_id)
        if not images:
            return

        total = len(images)
        completed = sum(1 for image in images if image.status == ProcessingStatus.COMPLETED)
        failed = any(image.status == ProcessingStatus.FAILED for image in images)

        if failed:
            status_value = ProcessingStatus.FAILED
            story_status = StoryStatus.FAILED
        elif completed == total:
            status_value = ProcessingStatus.COMPLETED
            story_status = StoryStatus.READY
        else:
            status_value = ProcessingStatus.PROCESSING
            story_status = StoryStatus.OCR_IN_PROGRESS

        progress = int(round((completed / total) * 100)) if total else 0
        combined_text = self._combine_extracted_text(images)

        await self._upload_dao.update_processing(
            upload_id,
            status=status_value,
            progress=progress,
            extracted_text=combined_text,
            ocr_text=combined_text,
            story_status=story_status,
        )

    async def _run_ocr_bytes(self, payload: UploadFilePayload) -> str:
        if not self._settings.ocr_service_enabled:
            raise UploadServiceError("OCR service is disabled", status.HTTP_503_SERVICE_UNAVAILABLE)

        result = await ocr_service.run_bytes(payload.data, DEFAULT_OCR_PROMPT)
        if isinstance(result, dict):
            answer = result.get("answer") or ""
        else:
            answer = str(result or "")
        return answer.strip()

    @staticmethod
    def _combine_extracted_text(images: Sequence[UploadImage]) -> Optional[str]:
        pieces = [image.extracted_text.strip() for image in images if image.extracted_text]
        if not pieces:
            return None
        return "\n\n".join(pieces)

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
