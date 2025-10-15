from fastapi import APIRouter, File, Form, UploadFile

from ...services.ocr import ocr_service, tts_service

router = APIRouter()


@router.post("/ocr")
async def run_ocr(
    file: UploadFile = File(...),
    question: str = Form("<image>\nMô tả hình ảnh một cách chi tiết trả về dạng markdown."),
):
    return await ocr_service.run(file, question)


@router.post("/tts")
async def run_tts(
    text: str = Form(...),
    gender: str = Form("female"),
    area: str = Form("northern"),
    emotion: str = Form("neutral"),
):
    return await tts_service.synthesize(text, gender, area, emotion)
