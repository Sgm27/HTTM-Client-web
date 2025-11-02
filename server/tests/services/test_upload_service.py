import os
from dataclasses import dataclass

import pytest

from src.dtos import UploadFilePayload
from src.entities import StoryStatus, Upload, Visibility
from src.services.upload_service import (
    UploadService,
    UploadServiceError,
    make_upload_request,
)


@dataclass
class DummySettings:
    supabase_url: str = "https://supabase.local"
    supabase_service_role_key: str = "service"
    supabase_anon_key: str = "anon"
    ocr_service_enabled: bool = True


class FakeBucket:
    def __init__(self, fail_on_second: bool = False) -> None:
        self.fail_on_second = fail_on_second
        self.uploads: dict[str, bytes] = {}
        self.removed: list[str] = []
        self._upload_count = 0

    def upload(self, path: str, data: bytes, _options: dict[str, str]) -> None:
        self._upload_count += 1
        if self.fail_on_second and self._upload_count > 1:
            raise RuntimeError("duplicate file")
        if path in self.uploads:
            raise RuntimeError("duplicate file")
        self.uploads[path] = data

    def get_public_url(self, path: str):
        return {"data": {"publicUrl": f"https://cdn.local/{path}"}}

    def remove(self, paths: list[str]) -> None:
        self.removed.extend(paths)
        for path in paths:
            self.uploads.pop(path, None)


class FakeStorage:
    def __init__(self, bucket: FakeBucket) -> None:
        self._bucket = bucket

    def from_(self, name: str) -> FakeBucket:
        assert name == "uploads"
        return self._bucket


class FakeClient:
    def __init__(self, bucket: FakeBucket) -> None:
        self.storage = FakeStorage(bucket)


class StubUploadDAO:
    def __init__(self) -> None:
        self.created_records = []
        self.should_fail = False
        self._uploads: dict[str, Upload] = {}

    async def create(self, record):
        if self.should_fail:
            raise RuntimeError("db failure")
        self.created_records.append(record)
        upload = Upload(
            id=f"upload-{len(self.created_records)}",
            user_id=record.user_id,
            content_type=record.content_type,
            visibility=record.visibility,
            title=record.title,
            description=record.description,
            content_file_id=record.content_file_id,
            thumbnail_file_id=record.thumbnail_file_id,
            status=record.status,
            progress=record.progress,
            error_reason=record.error_reason,
            extracted_text=record.extracted_text,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )
        self._uploads[upload.id] = upload
        return upload

    async def find_by_id(self, upload_id: str):
        return self._uploads.get(upload_id)


def _service(
    dao: StubUploadDAO,
    service_bucket: FakeBucket | None = None,
    public_bucket: FakeBucket | None = None,
) -> UploadService:
    service_bucket = service_bucket or FakeBucket()
    public_bucket = public_bucket or service_bucket
    service_client = FakeClient(service_bucket)
    public_client = FakeClient(public_bucket)
    return UploadService(
        settings=DummySettings(),
        upload_dao=dao,
        service_client=service_client,
        public_client=public_client,
    )


def _text_payload(content: str, filename: str = "story.txt") -> UploadFilePayload:
    return UploadFilePayload(
        filename=filename,
        content_type="text/plain",
        data=content.encode("utf-8"),
    )


def _binary_payload(size: int, filename: str = "blob.bin") -> UploadFilePayload:
    return UploadFilePayload(
        filename=filename,
        content_type="application/octet-stream",
        data=os.urandom(size),
    )


@pytest.mark.anyio("asyncio")
async def test_create_upload_text_file_sets_ready_status() -> None:
    dao = StubUploadDAO()
    service = _service(dao)

    request = make_upload_request(
        user_id="user-1",
        content_type="TEXT",
        visibility="PUBLIC",
        title="My Story",
        description="Desc",
    )

    response = await service.create_upload(request, _text_payload("hello world"))

    assert response.upload.status == StoryStatus.READY
    assert response.upload.progress == 100
    assert response.upload.extracted_text == "hello world"
    assert response.upload.content_url is not None


@pytest.mark.anyio("asyncio")
async def test_create_upload_large_binary_defaults_to_draft() -> None:
    dao = StubUploadDAO()
    service = _service(dao)
    request = make_upload_request(
        user_id="user-2",
        content_type="TEXT",
        visibility="PUBLIC",
        title="Binary Story",
        description=None,
    )

    payload = _binary_payload(1_000_000, filename="big.bin")
    response = await service.create_upload(request, payload)

    assert response.upload.status == StoryStatus.DRAFT
    assert response.upload.progress == 0


@pytest.mark.anyio("asyncio")
async def test_create_upload_thumbnail_failure_rolls_back() -> None:
    dao = StubUploadDAO()
    service_bucket = FakeBucket(fail_on_second=True)
    service = _service(dao, service_bucket=service_bucket)

    request = make_upload_request(
        user_id="user-3",
        content_type="TEXT",
        visibility="PUBLIC",
        title="Story",
        description=None,
    )

    with pytest.raises(UploadServiceError):
        await service.create_upload(
            request,
            _text_payload("hello"),
            thumbnail_file=_binary_payload(10, filename="thumb.png"),
        )

    assert service_bucket.removed, "Expected rollback to clean uploaded files"


@pytest.mark.anyio("asyncio")
async def test_create_upload_dao_failure_rolls_back_uploads() -> None:
    dao = StubUploadDAO()
    dao.should_fail = True
    bucket = FakeBucket()
    service = _service(dao, service_bucket=bucket)

    request = make_upload_request(
        user_id="user-4",
        content_type="TEXT",
        visibility="PUBLIC",
        title="Story",
        description=None,
    )

    with pytest.raises(UploadServiceError):
        await service.create_upload(request, _text_payload("rollback me"))

    assert bucket.removed, "Uploaded file should be removed on DAO failure"


@pytest.mark.anyio("asyncio")
async def test_get_upload_not_found_raises() -> None:
    dao = StubUploadDAO()
    service = _service(dao)

    with pytest.raises(UploadServiceError) as exc:
        await service.get_upload("missing")

    assert exc.value.status_code == 404


@pytest.mark.anyio("asyncio")
async def test_get_upload_returns_resolved_urls() -> None:
    dao = StubUploadDAO()
    service_bucket = FakeBucket()
    public_bucket = FakeBucket()
    service = _service(dao, service_bucket=service_bucket, public_bucket=public_bucket)

    request = make_upload_request(
        user_id="user-5",
        content_type="TEXT",
        visibility="PUBLIC",
        title="Story",
        description=None,
    )

    response = await service.create_upload(request, _text_payload("content"))

    fetched = await service.get_upload(response.upload.id)

    assert fetched.content_url.startswith("https://cdn.local/")
    assert fetched.thumbnail_url is None


def test_make_upload_request_rejects_invalid_enum() -> None:
    with pytest.raises(UploadServiceError) as exc:
        make_upload_request(
            user_id="user-6",
            content_type="invalid",
            visibility="PUBLIC",
            title="Story",
            description=None,
        )

    assert exc.value.status_code == 400
