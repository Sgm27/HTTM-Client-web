from __future__ import annotations

import io
import os
import sys
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OCR_DIR = os.path.join(WORKSPACE_ROOT, "OCR")

if OCR_DIR not in sys.path:
    sys.path.insert(0, OCR_DIR)

try:
    import torch
except Exception:  
    torch = None

try:
    from transformers import AutoModel, AutoTokenizer  
except Exception:
    AutoModel = None
    AutoTokenizer = None

try:  
    import vintern_1b as vintern  
except Exception:  # pragma: no cover
    vintern = None  # type: ignore

DEFAULT_OCR_PROMPT = """<image>
Extract only the exact text visible in this comic/manga page.
No descriptions, no summaries, no JSON, no quotes, no translation.
Preserve original casing, punctuation, and line breaks.
Reading direction = RTL (panel order as specified).
Order: speech balloons → narration → SFX. Illegible → [illegible].
If no text → EMPTY.
Output only between:
<RAW_TEXT_ONLY>
...transcription...
</RAW_TEXT_ONLY>"""


class OCRService:
    def __init__(self) -> None:
        self._ocr_model = None
        self._ocr_tokenizer = None
        self._ocr_device: Optional[str] = None
        self._initialized = False

    def load(self) -> None:
        if self._initialized:
            return

        if AutoModel is None or AutoTokenizer is None or vintern is None or torch is None:
            raise RuntimeError("Missing OCR dependencies")

        model_name = "5CD-AI/Vintern-1B-v3_5"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self._ocr_device = device

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

        self._ocr_model = model
        self._ocr_tokenizer = tokenizer
        self._initialized = True
    async def run(self, file: UploadFile, question: str) -> dict[str, str]:
        image_bytes = await file.read()
        answer = await self.run_bytes(image_bytes, question)
        return {"answer": answer}

    async def run_bytes(self, image_bytes: bytes, question: Optional[str] = None) -> str:
        try:
            self.load()
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if vintern is None or self._ocr_model is None or self._ocr_tokenizer is None or torch is None:
            raise HTTPException(status_code=500, detail="OCR model not available")

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        input_size = 448
        images = vintern.dynamic_preprocess(image, image_size=input_size, use_thumbnail=True, max_num=6)
        transform = vintern.build_transform(input_size=input_size)
        pixel_values = [transform(im) for im in images]

        pixel_values_tensor = torch.stack(pixel_values)
        dtype = getattr(torch, "bfloat16", None) or getattr(torch, "float16", torch.float32)
        pixel_values_tensor = pixel_values_tensor.to(dtype)

        if self._ocr_device == "cuda":
            pixel_values_tensor = pixel_values_tensor.to("cuda")

        generation_config = dict(
            max_new_tokens=512,
            do_sample=False,
            num_beams=3,
            repetition_penalty=3.5,
        )

        prompt = question or DEFAULT_OCR_PROMPT

        try:  
            response = self._ocr_model.chat(self._ocr_tokenizer, pixel_values_tensor, prompt, generation_config)
        except Exception as exc:  
            raise HTTPException(status_code=500, detail=f"OCR inference failed: {exc}") from exc

        return response


ocr_service = OCRService()


def on_startup() -> None:
    """Load OCR service on startup - only called when OCR_SERVICE is enabled"""
    ocr_service.load()
