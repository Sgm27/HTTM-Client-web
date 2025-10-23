from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ...core.config import get_settings

router = APIRouter()


def _require_ocr_enabled(settings=Depends(get_settings)) -> None:
    if not getattr(settings, "ocr_service_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR service is disabled",
        )


def _require_tts_enabled(settings=Depends(get_settings)) -> None:
    if not getattr(settings, "tts_service_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TTS service is disabled",
        )


@router.post("/ocr")
async def run_ocr(
    _: None = Depends(_require_ocr_enabled),
    file: UploadFile = File(...),
    question: str = Form("<image>\nMô tả hình ảnh một cách chi tiết trả về dạng markdown."),
):
    from ...services.ocr import ocr_service

    return await ocr_service.run(file, question)


@router.post("/tts")
async def run_tts(
    _: None = Depends(_require_tts_enabled),
    text: str = Form(...),
    gender: str = Form("female"),
    area: str = Form("northern"),
    emotion: str = Form("neutral"),
):
    from ...services.tts import tts_service

    return await tts_service.synthesize(text, gender, area, emotion)
