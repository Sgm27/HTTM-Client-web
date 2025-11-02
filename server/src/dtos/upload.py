from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..entities import ContentType, StoryStatus, Upload, Visibility


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
    progress: int
    extracted_text: str | None
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
            "progress": self.progress,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if self.extracted_text is not None:
            record["extracted_text"] = self.extracted_text

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
    progress: int | None
    extracted_text: str | None
    error_reason: str | None
    created_at: datetime
    updated_at: datetime
    content_url: str | None = None
    thumbnail_url: str | None = None

    @classmethod
    def from_entity(
        cls,
        upload: Upload,
        *,
        content_url: str | None = None,
        thumbnail_url: str | None = None,
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
            progress=upload.progress,
            extracted_text=upload.extracted_text,
            error_reason=upload.error_reason,
            created_at=upload.created_at,
            updated_at=upload.updated_at,
            content_url=content_url,
            thumbnail_url=thumbnail_url,
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
            "progress": self.progress,
            "content": self.extracted_text,
            "errorReason": self.error_reason,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "contentUrl": self.content_url,
            "thumbnailUrl": self.thumbnail_url,
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
