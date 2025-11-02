from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ...utils.config import get_settings

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
    question: str = Form("""<image>\nExtract only the exact text visible in this comic/manga page.
    No descriptions, no summaries, no JSON, no quotes, no translation.
    Preserve original casing, punctuation, and line breaks.
    Reading direction = RTL (panel order as specified).
    Order: speech balloons → narration → SFX. Illegible → [illegible].
    If no text → EMPTY.
    Output only between:
    <RAW_TEXT_ONLY>
    ...transcription...
    </RAW_TEXT_ONLY>"""),
):
    from ...services.ocr import ocr_service

    return await ocr_service.run(file, question)


@router.post("/tts")
async def run_tts(
    _: None = Depends(_require_tts_enabled),
    text: str = Form(...),
):
    from ...services.tts import tts_service

    return await tts_service.synthesize(text)
