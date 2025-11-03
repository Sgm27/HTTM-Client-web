from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .enums import ProcessingStatus


@dataclass
class UploadImage:
    id: str
    upload_id: str
    storage_path: str
    mime_type: str
    order_index: int
    status: ProcessingStatus
    progress: int
    story_id: str | None = None
    public_url: str | None = None
    file_size: int | None = None
    extracted_text: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def mark_processing(self) -> None:
        self.status = ProcessingStatus.PROCESSING
        self.updated_at = datetime.utcnow()

    def mark_completed(self, text: str | None, public_url: str | None = None) -> None:
        self.status = ProcessingStatus.COMPLETED
        self.extracted_text = text
        if public_url is not None:
            self.public_url = public_url
        self.progress = 100
        self.updated_at = datetime.utcnow()

    def mark_failed(self) -> None:
        self.status = ProcessingStatus.FAILED
        self.progress = 0
        self.updated_at = datetime.utcnow()
