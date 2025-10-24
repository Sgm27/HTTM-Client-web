from __future__ import annotations

import contextlib
import os
import tempfile
import wave
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

try:  # pragma: no cover - optional dependency wrapper
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # type: ignore

try:  # pragma: no cover
    import torch  # type: ignore
except Exception:  # pragma: no cover
    torch = None  # type: ignore

try:  # pragma: no cover
    from transformers import AutoTokenizer, VitsModel  # type: ignore
except Exception:  # pragma: no cover
    AutoTokenizer = None  # type: ignore
    VitsModel = None  # type: ignore


class TTSService:
    """Synthesize Vietnamese speech using the MMS VITS model."""

    def __init__(self, model_name: str = "sonktx/mms-tts-vie-finetuned") -> None:
        self._model_name = model_name
        self._model: Optional[object] = None
        self._tokenizer: Optional[object] = None
        self._device: Optional[str] = None
        self._sampling_rate: int = 22050
        self._initialized = False

    def load(self) -> None:
        if self._initialized:
            return

        if torch is None or AutoTokenizer is None or VitsModel is None or np is None:
            raise RuntimeError("Missing TTS dependencies (torch, transformers, numpy)")

        device = "cuda" if torch.cuda.is_available() else "cpu"

        try:  # pragma: no cover - heavyweight model load
            tokenizer = AutoTokenizer.from_pretrained(self._model_name)
            model = VitsModel.from_pretrained(self._model_name).eval()
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(f"Unable to load TTS model: {exc}") from exc

        if device == "cuda":
            model = model.to("cuda")

        self._tokenizer = tokenizer
        self._model = model
        self._device = device
        self._sampling_rate = int(getattr(model.config, "sampling_rate", self._sampling_rate))
        self._initialized = True

    async def synthesize(self, text: str) -> FileResponse:
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text is required for synthesis")

        try:
            self.load()
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if (self._model is None or self._tokenizer is None or torch is None or np is None):
            raise HTTPException(status_code=500, detail="TTS backend is unavailable")

        tokenizer = self._tokenizer
        model = self._model
        device = self._device or "cpu"

        try:  # pragma: no cover - heavy inference
            inputs = tokenizer(text, return_tensors="pt").to(device)
            with torch.no_grad():
                waveform_tensor = model(**inputs).waveform
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc

        waveform = waveform_tensor.squeeze().detach().cpu().numpy().astype(np.float32)
        if waveform.ndim == 0:
            waveform = np.expand_dims(waveform, axis=0)

        peak = float(np.max(np.abs(waveform))) if waveform.size else 0.0
        if peak > 1.0:
            waveform = waveform / peak

        pcm16 = (waveform * 32767.0).clip(-32768, 32767).astype(np.int16)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            wav_path = tmp_file.name

        try:
            with wave.open(wav_path, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(self._sampling_rate)
                wav_file.writeframes(pcm16.tobytes())
        except Exception as exc:  # pragma: no cover
            with contextlib.suppress(OSError):
                os.remove(wav_path)
            raise HTTPException(status_code=500, detail=f"Failed to write WAV file: {exc}") from exc

        duration_seconds = pcm16.size / float(self._sampling_rate)
        headers = {"X-Audio-Duration": f"{duration_seconds:.2f}"}

        def _cleanup(path: str) -> None:
            with contextlib.suppress(OSError):
                os.remove(path)

        background = BackgroundTask(_cleanup, wav_path)

        return FileResponse(
            wav_path,
            media_type="audio/wav",
            filename="speech.wav",
            headers=headers,
            background=background,
        )


tts_service = TTSService()


def on_startup() -> None:
    """Attempt to warm the TTS model on application startup."""

    with contextlib.suppress(RuntimeError):
        tts_service.load()
