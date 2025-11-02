from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from src.dao.upload_dao import UploadDAO
from src.dtos import UploadCreateRecord
from src.entities import ContentType, StoryStatus, Visibility


def _sample_record() -> dict[str, object]:
    now = datetime.utcnow().isoformat()
    return {
        "id": "upload-123",
        "user_id": "user-1",
        "content_type": "TEXT",
        "visibility": "PUBLIC",
        "title": "Story",
        "description": "Desc",
        "content_file_id": "user-1/content.txt",
        "thumbnail_file_id": None,
        "status": "READY",
        "progress": 100,
        "extracted_text": "hello",
        "error_reason": None,
        "created_at": now,
        "updated_at": now,
    }


@pytest.mark.anyio("asyncio")
async def test_create_inserts_and_returns_upload() -> None:
    record = UploadCreateRecord(
        user_id="user-1",
        content_type=ContentType.TEXT,
        visibility=Visibility.PUBLIC,
        title="Story",
        description="Desc",
        content_file_id="user-1/content.txt",
        thumbnail_file_id=None,
        status=StoryStatus.READY,
        progress=100,
        extracted_text="hello",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    table_mock = MagicMock()
    insert_mock = MagicMock()
    insert_mock.execute.return_value = SimpleNamespace(data=[_sample_record()])
    table_mock.insert.return_value = insert_mock

    connection = MagicMock()
    connection.table.return_value = table_mock

    dao = UploadDAO(connection)
    upload = await dao.create(record)

    table_mock.insert.assert_called_once_with(record.to_record())
    assert upload.id == "upload-123"
    assert upload.content_type == ContentType.TEXT
    assert upload.visibility == Visibility.PUBLIC
    assert upload.extracted_text == "hello"


@pytest.mark.anyio("asyncio")
async def test_find_by_id_returns_none_when_missing() -> None:
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.limit.return_value = table_mock
    table_mock.execute.return_value = SimpleNamespace(data=[])

    connection = MagicMock()
    connection.table.return_value = table_mock

    dao = UploadDAO(connection)
    result = await dao.find_by_id("missing")

    assert result is None


@pytest.mark.anyio("asyncio")
async def test_mark_completed_updates_record() -> None:
    update_mock = MagicMock()
    eq_mock = MagicMock()
    eq_mock.execute.return_value = SimpleNamespace(data=[])
    update_mock.eq.return_value = eq_mock

    table_mock = MagicMock()
    table_mock.update.return_value = update_mock

    connection = MagicMock()
    connection.table.return_value = table_mock

    dao = UploadDAO(connection)
    await dao.mark_completed("upload-1")

    args, _ = table_mock.update.call_args
    payload = args[0]
    assert payload["status"] == StoryStatus.READY.value
    assert payload["progress"] == 100
    assert payload["error_reason"] is None
    update_mock.eq.assert_called_once_with("id", "upload-1")
    eq_mock.execute.assert_called_once()


@pytest.mark.anyio("asyncio")
async def test_mark_failed_updates_record() -> None:
    update_mock = MagicMock()
    eq_mock = MagicMock()
    eq_mock.execute.return_value = SimpleNamespace(data=[])
    update_mock.eq.return_value = eq_mock

    table_mock = MagicMock()
    table_mock.update.return_value = update_mock

    connection = MagicMock()
    connection.table.return_value = table_mock

    dao = UploadDAO(connection)
    await dao.mark_failed("upload-1", "bad-file")

    args, _ = table_mock.update.call_args
    payload = args[0]
    assert payload["status"] == StoryStatus.FAILED.value
    assert payload["error_reason"] == "bad-file"
    update_mock.eq.assert_called_once_with("id", "upload-1")
    eq_mock.execute.assert_called_once()
