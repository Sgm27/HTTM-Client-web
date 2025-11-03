from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from typing import List, Optional

from ...dtos import UploadFilePayload
from ...services import UploadService, UploadServiceError, make_upload_request
from ...utils.config import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _get_upload_service() -> UploadService:
    settings = get_settings()
    return UploadService(settings)


@router.post("", response_model=None)
async def create_upload(
    background_tasks: BackgroundTasks,
    userId: str = Form(...),
    contentType: str = Form(...),
    visibility: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    contentFile: Optional[UploadFile] = File(None),
    contentFiles: Optional[List[UploadFile]] = File(None),
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

    files: List[UploadFile] = []
    if contentFiles:
        files.extend(contentFiles)
    elif contentFile is not None:
        files.append(contentFile)

    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Vui lòng chọn ít nhất một file nội dung.")

    content_payloads: List[UploadFilePayload] = []
    for file in files:
        content_payloads.append(
            UploadFilePayload(
                filename=file.filename or "upload",
                content_type=file.content_type,
                data=await file.read(),
            )
        )

    thumbnail_payload = None
    if thumbnailFile is not None:
        thumbnail_payload = UploadFilePayload(
            filename=thumbnailFile.filename or "thumbnail",
            content_type=thumbnailFile.content_type,
            data=await thumbnailFile.read(),
        )

    try:
        response = await service.create_upload(
            request,
            content_payloads,
            thumbnail_payload,
            background_tasks=background_tasks,
        )
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


@router.get("/{upload_id}/ocr-progress", response_model=None)
async def get_upload_ocr_progress(
    upload_id: str,
    service: UploadService = Depends(_get_upload_service),
):
    """Get aggregated OCR progress for an upload"""
    try:
        progress = await service.get_ocr_progress(upload_id)
    except UploadServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return progress
