import os
import sys
import io
import tempfile
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

# Add local module paths for OCR and TTS utilities
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OCR_DIR = os.path.join(WORKSPACE_ROOT, "code", "OCR")
TTS_DIR = os.path.join(WORKSPACE_ROOT, "code", "TTS", "VietVoice-TTS")

for path in [OCR_DIR, TTS_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

from PIL import Image
import importlib.util

# Lazy imports guarded to allow the API to boot even if heavy deps are missing.
try:
    import torch
except Exception:  # pragma: no cover
    torch = None  # type: ignore

try:
    from transformers import AutoModel, AutoTokenizer  # type: ignore
except Exception:  # pragma: no cover
    AutoModel = None  # type: ignore
    AutoTokenizer = None  # type: ignore

# Import helper wrappers from local scripts
try:
    import vintern_1b as vintern  # from code/OCR/vintern_1b.py
except Exception:
    vintern = None  # type: ignore

try:
    # First try regular import (works when linters/runtime see adjusted sys.path)
    import vietvoice_tts as vietvoice  # type: ignore[import-not-found]
except Exception:
    # Fallback: load the module directly by file path to avoid linter/runtime path issues
    try:
        _vietvoice_path = os.path.join(TTS_DIR, "vietvoice_tts.py")
        _spec = importlib.util.spec_from_file_location("vietvoice_tts", _vietvoice_path)
        if _spec and _spec.loader:
            vietvoice = importlib.util.module_from_spec(_spec)  # type: ignore
            _spec.loader.exec_module(vietvoice)  # type: ignore
        else:
            vietvoice = None  # type: ignore
    except Exception:
        vietvoice = None  # type: ignore


app = FastAPI(title="HTTM Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global state for OCR model
_ocr_model = None
_ocr_tokenizer = None
_ocr_device = None


@app.on_event("startup")
def load_models_on_startup() -> None:
    global _ocr_model, _ocr_tokenizer, _ocr_device

    # Load OCR model (Vintern) if dependencies are available
    if AutoModel is None or AutoTokenizer is None or vintern is None or torch is None:
        return

    model_name = "5CD-AI/Vintern-1B-v3_5"

    # Choose device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    _ocr_device = device

    # Load Vintern model
    try:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=getattr(torch, "bfloat16", None) or getattr(torch, "float16", torch.float32),
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            use_flash_attn=False,
        ).eval()
    except Exception:
        model = AutoModel.from_pretrained(
            model_name,
            torch_dtype=getattr(torch, "bfloat16", None) or getattr(torch, "float16", torch.float32),
            low_cpu_mem_usage=True,
            trust_remote_code=True,
        ).eval()

    if device == "cuda":
        model = model.to("cuda")

    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True, use_fast=False)

    _ocr_model = model
    _ocr_tokenizer = tokenizer


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "ocr_loaded": bool(_ocr_model is not None),
            "tts_available": bool(vietvoice is not None),
        }
    )


@app.post("/ocr")
async def ocr_infer(
    file: UploadFile = File(...),
    question: Optional[str] = Form(
        default="<image>\nMô tả hình ảnh một cách chi tiết trả về dạng markdown.")
):
    if vintern is None or _ocr_model is None or _ocr_tokenizer is None or torch is None:
        return JSONResponse({"error": "OCR model not available"}, status_code=503)

    # Read image bytes
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Use vintern's preprocessing utilities
    input_size = 448
    images = vintern.dynamic_preprocess(image, image_size=input_size, use_thumbnail=True, max_num=6)
    transform = vintern.build_transform(input_size=input_size)
    pixel_values = [transform(im) for im in images]

    pixel_values_tensor = torch.stack(pixel_values)
    dtype = getattr(torch, "bfloat16", None) or getattr(torch, "float16", torch.float32)
    pixel_values_tensor = pixel_values_tensor.to(dtype)

    if _ocr_device == "cuda":
        pixel_values_tensor = pixel_values_tensor.to("cuda")

    generation_config = dict(
        max_new_tokens=512,
        do_sample=False,
        num_beams=3,
        repetition_penalty=3.5,
    )

    try:
        response = _ocr_model.chat(_ocr_tokenizer, pixel_values_tensor, question, generation_config)
    except Exception as exc:  # pragma: no cover
        return JSONResponse({"error": f"OCR inference failed: {exc}"}, status_code=500)

    return {"answer": response}


@app.post("/tts")
async def tts_synthesize(
    text: str = Form(...),
    gender: str = Form("female"),
    area: str = Form("northern"),
    emotion: str = Form("neutral"),
):
    if vietvoice is None:
        return JSONResponse({"error": "TTS module not available"}, status_code=503)

    # Generate to a temporary wav and stream back
    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = os.path.join(tmpdir, "output.wav")
        try:
            duration = vietvoice.synthesize_text_to_wav(
                text=text,
                out_file_path=wav_path,
                gender=gender,
                area=area,
                emotion=emotion,
            )
        except Exception as exc:  # pragma: no cover
            return JSONResponse({"error": f"TTS synthesis failed: {exc}"}, status_code=500)

        headers = {"X-Audio-Duration": f"{duration:.2f}"}
        return FileResponse(
            wav_path,
            media_type="audio/wav",
            filename="speech.wav",
            headers=headers,
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )


