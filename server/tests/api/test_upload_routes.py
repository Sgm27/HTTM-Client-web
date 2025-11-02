from datetime import datetime
from typing import Any

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from src.api.routes import uploads
from src.dtos import CreateUploadResponse, UploadDTO
from src.entities import ContentType, StoryStatus, Visibility
from src.main import app
from src.services.upload_service import UploadServiceError


class StubUploadService:
    def __init__(self) -> None:
        self.create_response: CreateUploadResponse | None = None
        self.get_response: UploadDTO | None = None
        self.raise_error: UploadServiceError | None = None
        self.calls: list[tuple[str, Any]] = []

    async def create_upload(self, request, content_file, thumbnail_file=None):
        self.calls.append(("create", request, content_file, thumbnail_file))
        if self.raise_error:
            raise self.raise_error
        assert self.create_response is not None, "create_response must be set for stub"
        return self.create_response

    async def get_upload(self, upload_id: str):
        self.calls.append(("get", upload_id))
        if self.raise_error:
            raise self.raise_error
        assert self.get_response is not None, "get_response must be set for stub"
        return self.get_response


@pytest.fixture
def client():
    return TestClient(app)


def _override(service: StubUploadService):
    app.dependency_overrides[uploads._get_upload_service] = lambda: service


def _reset_override():
    app.dependency_overrides.pop(uploads._get_upload_service, None)


def _sample_dto() -> UploadDTO:
    now = datetime.utcnow()
    return UploadDTO(
        id="upload-1",
        user_id="user-1",
        content_type=ContentType.TEXT,
        visibility=Visibility.PUBLIC,
        title="Story",
        description=None,
        content_file_id="user-1/story.txt",
        thumbnail_file_id=None,
        status=StoryStatus.READY,
        progress=100,
        extracted_text="hello",
        error_reason=None,
        created_at=now,
        updated_at=now,
        content_url="https://cdn.local/user-1/story.txt",
        thumbnail_url=None,
    )


def test_create_upload_endpoint_returns_payload(client: TestClient) -> None:
    stub = StubUploadService()
    stub.create_response = CreateUploadResponse(upload=_sample_dto())

    _override(stub)
    try:
        response = client.post(
            "/api/uploads",
            data={
                "userId": "user-1",
                "contentType": "TEXT",
                "visibility": "PUBLIC",
                "title": "Story",
            },
            files={"contentFile": ("story.txt", b"hello", "text/plain")},
        )
    finally:
        _reset_override()

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["upload"]["id"] == "upload-1"
    assert body["upload"]["content"] == "hello"
    # Ensure large file support by verifying stub observed payload
    call = stub.calls[0]
    assert call[0] == "create"
    assert call[2].data == b"hello"


def test_create_upload_handles_large_file(client: TestClient) -> None:
    stub = StubUploadService()
    stub.create_response = CreateUploadResponse(upload=_sample_dto())

    _override(stub)
    try:
        big_payload = b"x" * (2 * 1024 * 1024)
        response = client.post(
            "/api/uploads",
            data={
                "userId": "user-1",
                "contentType": "TEXT",
                "visibility": "PUBLIC",
                "title": "Big Story",
            },
            files={"contentFile": ("story.bin", big_payload, "application/octet-stream")},
        )
    finally:
        _reset_override()

    assert response.status_code == status.HTTP_200_OK
    assert stub.calls[0][2].data == big_payload


def test_create_upload_propagates_authorization_error(client: TestClient) -> None:
    stub = StubUploadService()
    stub.raise_error = UploadServiceError("Unauthorized", status.HTTP_401_UNAUTHORIZED)

    _override(stub)
    try:
        response = client.post(
            "/api/uploads",
            data={
                "userId": "user-unauthorized",
                "contentType": "TEXT",
                "visibility": "PUBLIC",
                "title": "Story",
            },
            files={"contentFile": ("story.txt", b"body", "text/plain")},
        )
    finally:
        _reset_override()

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Unauthorized"


def test_get_upload_returns_not_found(client: TestClient) -> None:
    stub = StubUploadService()
    stub.raise_error = UploadServiceError("Not found", status.HTTP_404_NOT_FOUND)

    _override(stub)
    try:
        response = client.get("/api/uploads/missing")
    finally:
        _reset_override()

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["detail"] == "Not found"


def test_create_upload_rejects_invalid_content_type(client: TestClient) -> None:
    stub = StubUploadService()
    stub.create_response = CreateUploadResponse(upload=_sample_dto())

    _override(stub)
    try:
        response = client.post(
            "/api/uploads",
            data={
                "userId": "user-1",
                "contentType": "invalid",
                "visibility": "PUBLIC",
                "title": "Story",
            },
            files={"contentFile": ("story.txt", b"hello", "text/plain")},
        )
    finally:
        _reset_override()

    assert response.status_code == status.HTTP_400_BAD_REQUEST
