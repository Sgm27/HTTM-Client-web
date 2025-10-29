from __future__ import annotations

import contextlib
import os
import tempfile
import wave
import threading
from typing import Optional, Any

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

# ---- Optional dependency wrappers (giữ nguyên phong cách from your code) ----
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
    """Synthesize Vietnamese speech using an MMS VITS model."""

    def __init__(
        self,
        model_name: str = "sonktx/mms-tts-vie-finetuned",
        prefer_gpu: bool = True,
        fallback_on_oom: bool = False,
        cuda_device: str = "cuda",  # "cuda" hoặc "cuda:0"
        max_chars: int = 1000,      # giới hạn input để tránh DoS
    ) -> None:
        self._model_name = model_name
        self._model: Optional[Any] = None
        self._tokenizer: Optional[Any] = None
        self._device: Optional[str] = None
        self._sampling_rate: int = 22050
        self._initialized = False

        # cấu hình hành vi thiết bị
        self._prefer_gpu = prefer_gpu
        self._fallback_on_oom = fallback_on_oom
        self._cuda_device = cuda_device
        self._max_chars = max_chars

        # tránh race khi nhiều request cùng load model
        self._load_lock = threading.Lock()

    def load(self) -> None:
        """Load tokenizer & model; ưu tiên GPU. Không fallback CPU khi GPU OOM trừ khi bật fallback_on_oom."""
        if self._initialized:
            return

        if torch is None or AutoTokenizer is None or VitsModel is None or np is None:
            raise RuntimeError("Missing TTS dependencies (torch, transformers, numpy)")

        with self._load_lock:
            if self._initialized:
                return

            # ƯU TIÊN GPU: dùng GPU nếu có; nếu không có GPU thì dùng CPU.
            use_cuda = bool(self._prefer_gpu and torch.cuda.is_available())
            device = self._cuda_device if use_cuda else "cpu"

            try:  # pragma: no cover - heavyweight model load
                tokenizer = AutoTokenizer.from_pretrained(self._model_name)
                model = VitsModel.from_pretrained(self._model_name).eval()
            except Exception as exc:  # pragma: no cover
                raise RuntimeError(f"Unable to load TTS model: {exc}") from exc

            if device.startswith("cuda"):
                try:
                    model = model.to(device)  # có thể gây OOM
                except RuntimeError as e:
                    # Mặc định KHÔNG fallback nếu GPU có nhưng OOM
                    if self._fallback_on_oom and "out of memory" in str(e).lower():
                        device = "cpu"
                    else:
                        raise

            self._tokenizer = tokenizer
            self._model = model
            self._device = device
            self._sampling_rate = int(getattr(model.config, "sampling_rate", self._sampling_rate))
            self._initialized = True

    async def synthesize(self, text: str) -> FileResponse:
        """Sinh tiếng nói và trả về FileResponse (.wav)."""
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text is required for synthesis")

        # Chuẩn hóa khoảng trắng & giới hạn độ dài
        text = " ".join(text.split())
        if self._max_chars and len(text) > self._max_chars:
            raise HTTPException(status_code=413, detail=f"Text too long (>{self._max_chars} chars)")

        # load có thể nặng → offload để không block event loop
        try:
            await run_in_threadpool(self.load)
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if (self._model is None or self._tokenizer is None or torch is None or np is None):
            raise HTTPException(status_code=500, detail="TTS backend is unavailable")

        tokenizer = self._tokenizer
        model = self._model
        device = self._device or "cpu"

        def _infer_and_write() -> tuple[str, float]:
            # Tokenize
            inputs = tokenizer(text, return_tensors="pt")
            if device.startswith("cuda"):
                inputs = {k: v.to(device) for k, v in inputs.items()}

            # Inference (không gradient)
            with torch.inference_mode():
                out = model(**inputs)
                waveform_tensor = getattr(out, "waveform", None)
                if waveform_tensor is None:
                    raise RuntimeError("Model did not return 'waveform'")

            # Tensor -> PCM16
            waveform = waveform_tensor.squeeze().detach().cpu().numpy().astype(np.float32)
            if waveform.ndim == 0:
                waveform = np.expand_dims(waveform, axis=0)

            peak = float(np.max(np.abs(waveform))) if waveform.size else 0.0
            if peak > 1.0:
                waveform = waveform / peak

            pcm16 = (waveform * 32767.0).clip(-32768, 32767).astype(np.int16)

            # Ghi WAV vào file tạm
            fd, wav_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)  # đóng fd thô trước khi wave.open
            try:
                with wave.open(wav_path, "wb") as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(self._sampling_rate)
                    wav_file.writeframes(pcm16.tobytes())
            except Exception:
                with contextlib.suppress(OSError):
                    os.remove(wav_path)
                raise

            duration_seconds = pcm16.size / float(self._sampling_rate)
            return wav_path, duration_seconds

        # Offload inference + ghi file
        try:
            wav_path, duration_seconds = await run_in_threadpool(_infer_and_write)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc

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


# ---- Public instance + startup helper (giữ API tương tự) ----
tts_service = TTSService(
    model_name="sonktx/mms-tts-vie-finetuned",
    prefer_gpu=True,          # ưu tiên GPU
    fallback_on_oom=False,    # KHÔNG tự fallback CPU khi OOM
    cuda_device="cuda",       # hoặc "cuda:0"
    max_chars=1000,
)


def on_startup() -> None:
    """Attempt to warm the TTS model on application startup."""
    with contextlib.suppress(RuntimeError):
        tts_service.load()
