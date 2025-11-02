from datetime import datetime

from src.dtos.upload import UploadDTO
from src.entities import ContentType, StoryStatus, Upload, Visibility


def test_upload_dto_to_api_includes_expected_fields() -> None:
    now = datetime.utcnow()
    entity = Upload(
        id="upload-1",
        user_id="user-42",
        content_type=ContentType.TEXT,
        visibility=Visibility.PUBLIC,
        title="Sample",
        description="Desc",
        content_file_id="user-42/file.txt",
        thumbnail_file_id=None,
        status=StoryStatus.READY,
        progress=100,
        error_reason=None,
        extracted_text="Hello World",
        created_at=now,
        updated_at=now,
    )

    dto = UploadDTO.from_entity(entity, content_url="https://cdn/files/content", thumbnail_url=None)
    payload = dto.to_api()

    assert payload["id"] == "upload-1"
    assert payload["userId"] == "user-42"
    assert payload["contentType"] == "TEXT"
    assert payload["visibility"] == "PUBLIC"
    assert payload["status"] == "READY"
    assert payload["content"] == "Hello World"
    assert payload["contentUrl"] == "https://cdn/files/content"
    assert payload["thumbnailUrl"] is None
