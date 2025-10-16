from __future__ import annotations

import contextlib
import os
import sys
import tempfile

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TTS_DIR = os.path.join(WORKSPACE_ROOT, "TTS", "VietVoice-TTS")

if TTS_DIR not in sys.path:
    sys.path.insert(0, TTS_DIR)

try:  # pragma: no cover - optional dependency wrapper
    import vietvoice_tts as vietvoice  # type: ignore
except Exception:  # pragma: no cover
    vietvoice = None  # type: ignore


class TTSService:
    def __init__(self) -> None:
        if vietvoice is not None and hasattr(vietvoice, "synthesize_text_to_wav"):
            self._backend = vietvoice  # type: ignore[assignment]
        else:
            self._backend = None

    async def synthesize(self, text: str, gender: str, area: str, emotion: str) -> FileResponse:
        if self._backend is None:
            raise HTTPException(status_code=500, detail="VietVoice TTS backend is unavailable")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            wav_path = tmp_file.name

        try:  # pragma: no cover - heavy inference
            duration = float(
                self._backend.synthesize_text_to_wav(  # type: ignore[operator]
                    text=text,
                    out_file_path=wav_path,
                    gender=gender,
                    area=area,
                    emotion=emotion,
                )
            )
        except Exception as exc:  # pragma: no cover
            with contextlib.suppress(OSError):
                os.remove(wav_path)
            raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc

        headers = {"X-Audio-Duration": f"{duration:.2f}"}

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
