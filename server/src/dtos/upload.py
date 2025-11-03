from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Sequence

from ..entities import ContentType, StoryStatus, Upload, Visibility, ProcessingStatus, UploadImage


@dataclass(frozen=True, slots=True)
class UploadRequest:
    user_id: str
    content_type: ContentType
    visibility: Visibility
    title: str
    description: str | None


@dataclass(frozen=True, slots=True)
class UploadFilePayload:
    filename: str
    content_type: str | None
    data: bytes


@dataclass(frozen=True, slots=True)
class UploadCreateRecord:
    user_id: str
    content_type: ContentType
    visibility: Visibility
    title: str
    description: str | None
    content_file_id: str
    thumbnail_file_id: str | None
    status: StoryStatus
    processing_status: ProcessingStatus
    progress: int
    extracted_text: str | None
    ocr_text: str | None
    created_at: datetime
    updated_at: datetime
    error_reason: str | None = None

    def to_record(self) -> dict[str, object]:
        record = {
            "user_id": self.user_id,
            "content_type": self.content_type.value,
            "visibility": self.visibility.value,
            "title": self.title,
            "description": self.description,
            "content_file_id": self.content_file_id,
            "thumbnail_file_id": self.thumbnail_file_id,
            "status": self.status.value,
            "processing_status": self.processing_status.value,
            "progress": self.progress,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if self.extracted_text is not None:
            record["extracted_text"] = self.extracted_text

        if self.ocr_text is not None:
            record["ocr_text"] = self.ocr_text

        if self.error_reason is not None:
            record["error_reason"] = self.error_reason

        return record


@dataclass(slots=True)
class UploadDTO:
    id: str
    user_id: str
    content_type: ContentType
    visibility: Visibility
    title: str
    description: str | None
    content_file_id: str
    thumbnail_file_id: str | None
    status: StoryStatus
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    progress: int | None = None
    extracted_text: str | None = None
    ocr_text: str | None = None
    error_reason: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    content_url: str | None = None
    thumbnail_url: str | None = None
    images: list[UploadImage] | None = None

    @classmethod
    def from_entity(
        cls,
        upload: Upload,
        *,
        content_url: str | None = None,
        thumbnail_url: str | None = None,
        images: Sequence[UploadImage] | None = None,
    ) -> "UploadDTO":
        return cls(
            id=upload.id,
            user_id=upload.user_id,
            content_type=upload.content_type,
            visibility=upload.visibility,
            title=upload.title,
            description=upload.description,
            content_file_id=upload.content_file_id,
            thumbnail_file_id=upload.thumbnail_file_id,
            status=upload.status,
            processing_status=upload.processing_status,
            progress=upload.progress,
            extracted_text=upload.extracted_text,
            ocr_text=upload.ocr_text,
            error_reason=upload.error_reason,
            created_at=upload.created_at,
            updated_at=upload.updated_at,
            content_url=content_url,
            thumbnail_url=thumbnail_url,
            images=list(images) if images is not None else None,
        )

    def to_api(self) -> dict[str, object]:
        return {
            "id": self.id,
            "userId": self.user_id,
            "contentType": self.content_type.value,
            "visibility": self.visibility.value,
            "title": self.title,
            "description": self.description,
            "contentFileId": self.content_file_id,
            "thumbnailFileId": self.thumbnail_file_id,
            "status": self.status.value,
            "processingStatus": self.processing_status.value,
            "progress": self.progress,
            "content": self.extracted_text,
            "ocrText": self.ocr_text,
            "errorReason": self.error_reason,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "contentUrl": self.content_url,
            "thumbnailUrl": self.thumbnail_url,
            "images": [
                {
                    "id": image.id,
                    "uploadId": image.upload_id,
                    "storyId": image.story_id,
                    "storagePath": image.storage_path,
                    "publicUrl": image.public_url,
                    "mimeType": image.mime_type,
                    "fileSize": image.file_size,
                    "order": image.order_index,
                    "status": image.status.value,
                    "progress": image.progress,
                    "extractedText": image.extracted_text,
                }
                for image in (self.images or [])
            ],
        }


@dataclass(frozen=True, slots=True)
class CreateUploadResponse:
    upload: UploadDTO

    def to_api(self) -> dict[str, object]:
        return {"upload": self.upload.to_api()}


@dataclass(frozen=True, slots=True)
class UploadError:
    code: str
    message: str

    def to_api(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


@dataclass(frozen=True, slots=True)
class UploadImageCreateRecord:
    upload_id: str
    storage_path: str
    mime_type: str
    order_index: int
    file_size: int | None = None
    status: ProcessingStatus = ProcessingStatus.PENDING
    progress: int = 0
    public_url: str | None = None
    extracted_text: str | None = None

    def to_record(self) -> dict[str, object]:
        record: dict[str, object] = {
            "upload_id": self.upload_id,
            "storage_path": self.storage_path,
            "mime_type": self.mime_type,
            "order_index": self.order_index,
            "status": self.status.value,
            "progress": self.progress,
        }
        if self.file_size is not None:
            record["file_size"] = self.file_size
        if self.public_url is not None:
            record["public_url"] = self.public_url
        if self.extracted_text is not None:
            record["extracted_text"] = self.extracted_text
        return record
