from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .enums import FileKind


@dataclass
class File:
    id: str
    file_path: str
    kind: FileKind
    mime: str
    size: int
    hash: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
