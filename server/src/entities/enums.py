from __future__ import annotations

from enum import Enum


class ContentType(str, Enum):
    TEXT = "TEXT"
    COMIC = "COMIC"
    NEWS = "NEWS"


class Visibility(str, Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"
    UNLISTED = "UNLISTED"


class StoryStatus(str, Enum):
    DRAFT = "DRAFT"
    OCR_IN_PROGRESS = "OCR_IN_PROGRESS"
    READY = "READY"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


class FileKind(str, Enum):
    CONTENT = "CONTENT"
    THUMBNAIL = "THUMBNAIL"
    AUDIO = "AUDIO"
