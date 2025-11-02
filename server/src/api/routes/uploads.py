from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from typing import Optional

from ...dtos import UploadFilePayload
from ...services import UploadService, UploadServiceError, make_upload_request
from ...utils.config import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _get_upload_service() -> UploadService:
    settings = get_settings()
    return UploadService(settings)


@router.post("", response_model=None)
async def create_upload(
    userId: str = Form(...),
    contentType: str = Form(...),
    visibility: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    contentFile: UploadFile = File(...),
    thumbnailFile: Optional[UploadFile] = File(None),
    service: UploadService = Depends(_get_upload_service),
):
    """Create a new upload"""
    try:
        request = make_upload_request(
            user_id=userId,
            content_type=contentType,
            visibility=visibility,
            title=title,
            description=description,
        )
    except UploadServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    content_payload = UploadFilePayload(
        filename=contentFile.filename or "upload",
        content_type=contentFile.content_type,
        data=await contentFile.read(),
    )

    thumbnail_payload = None
    if thumbnailFile is not None:
        thumbnail_payload = UploadFilePayload(
            filename=thumbnailFile.filename or "thumbnail",
            content_type=thumbnailFile.content_type,
            data=await thumbnailFile.read(),
        )

    try:
        response = await service.create_upload(request, content_payload, thumbnail_payload)
    except UploadServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return response.to_api()


@router.get("/{upload_id}", response_model=None)
async def get_upload(
    upload_id: str,
    service: UploadService = Depends(_get_upload_service),
):
    """Get upload by ID"""
    try:
        upload = await service.get_upload(upload_id)
    except UploadServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return upload.to_api()
