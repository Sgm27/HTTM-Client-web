from __future__ import annotations

import contextlib
import os
import tempfile
import wave
import threading
import sys
from typing import Optional, Any

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

try:  
    import numpy as np  
except Exception:  
    np = None  

try:  
    import torch  
except Exception:  
    torch = None  

try:  
    from transformers import AutoTokenizer, VitsModel  
except Exception:  
    AutoTokenizer = None  
    VitsModel = None  

try:  
    vietvoice_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../TTS/VietVoice-TTS'))
    if os.path.exists(vietvoice_path) and vietvoice_path not in sys.path:
        sys.path.insert(0, vietvoice_path)
        print(f"Added VietVoice path to sys.path: {vietvoice_path}")
    
    from vietvoice_api import synthesize_vietvoictts
    e  # type: ignore
    VIETVOICE_AVAILABLE = True
    print("VietVoice TTS loaded successfully")
except Exception as e:  
    synthesize_vietvoice = None  
    VIETVOICE_AVAILABLE = False
    print(f"VietVoice TTS not available: {e}")
    import traceback
    traceback.print_exc()


class TTSService:
    """Synthesize Vietnamese speech using VietVoice TTS with fallback to MMS VITS model."""

    def __init__(
        self,
        model_name: str = "sonktx/mms-tts-vie-finetuned",
        prefer_gpu: bool = True,
        fallback_on_oom: bool = False,
        cuda_device: str = "cuda", 
        max_chars: int = 10000000,    
        use_vietvoice: bool = True,     
        vietvoice_gender: str = "female",   
        vietvoice_area: str = "central",
        vietvoice_emotion: str = "neutral",
    ) -> None:
        self._model_name = model_name
        self._model: Optional[Any] = None
        self._tokenizer: Optional[Any] = None
        self._device: Optional[str] = None
        self._sampling_rate: int = 22050
        self._initialized = False

        self._prefer_gpu = prefer_gpu
        self._fallback_on_oom = fallback_on_oom
        self._cuda_device = cuda_device
        self._max_chars = max_chars

        self._use_vietvoice = use_vietvoice and VIETVOICE_AVAILABLE
        self._vietvoice_gender = vietvoice_gender
        self._vietvoice_area = vietvoice_area
        self._vietvoice_emotion = vietvoice_emotion

        self._load_lock = threading.Lock()

    def load(self) -> None:
        """Load the TTS model preferably on GPU. failback to CPU if OOM and configured."""
        if self._initialized:
            return

        if torch is None or AutoTokenizer is None or VitsModel is None or np is None:
            raise RuntimeError("Missing TTS dependencies (torch, transformers, numpy)")

        with self._load_lock:
            if self._initialized:
                return

            use_cuda = bool(self._prefer_gpu and torch.cuda.is_available())
            device = self._cuda_device if use_cuda else "cpu"

            try: 
                tokenizer = AutoTokenizer.from_pretrained(self._model_name)
                model = VitsModel.from_pretrained(self._model_name).eval()
            except Exception as exc: 
                raise RuntimeError(f"Unable to load TTS model: {exc}") from exc

            if device.startswith("cuda"):
                try:
                    model = model.to(device)  
                except RuntimeError as e:
                    if self._fallback_on_oom and "out of memory" in str(e).lower():
                        device = "cpu"
                    else:
                        raise

            self._tokenizer = tokenizer
            self._model = model
            self._device = device
            self._sampling_rate = int(getattr(model.config, "sampling_rate", self._sampling_rate))
            self._initialized = True

    async def _synthesize_to_file(self, text: str) -> tuple[str, float]:
        """Synthesize speech and save to a temporary WAV file."""
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text is required for synthesis")

        text = " ".join(text.split())
        if self._max_chars and len(text) > self._max_chars:
            raise HTTPException(status_code=413, detail=f"Text too long (>{self._max_chars} chars)")

        # Try VietVoice first if enabled
        if self._use_vietvoice:
            try:
                print("Attempting to use VietVoice TTS...")
                return await self._synthesize_with_vietvoice(text)
            except Exception as e:
                print(f"VietVoice TTS failed: {e}. Falling back to MMS...")
                # Continue to MMS fallback

        # Use MMS as fallback or primary
        print("Using MMS TTS...")
        return await self._synthesize_with_mms(text)

    async def _synthesize_with_vietvoice(self, text: str) -> tuple[str, float]:
        """Sử dụng VietVoice TTS để tổng hợp giọng nói."""
        if not VIETVOICE_AVAILABLE or synthesize_vietvoice is None:
            raise RuntimeError("VietVoice TTS is not available")
            
        def _vietvoice_infer() -> tuple[str, float]:
            fd, wav_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            
            try:
                duration = synthesize_vietvoice(
                    text=text,
                    output_path=wav_path,
                    gender=self._vietvoice_gender,
                    area=self._vietvoice_area,
                    emotion=self._vietvoice_emotion
                )
                return wav_path, duration
            except Exception as e:
                with contextlib.suppress(OSError):
                    os.remove(wav_path)
                # Re-raise để trigger fallback
                raise RuntimeError(f"VietVoice synthesis failed: {e}") from e

        return await run_in_threadpool(_vietvoice_infer)

    async def _synthesize_with_mms(self, text: str) -> tuple[str, float]:
        """Use MMS VITS model to synthesize speech (fallback)."""
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
            inputs = tokenizer(text, return_tensors="pt")
            if device.startswith("cuda"):
                inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.inference_mode():
                out = model(**inputs)
                waveform_tensor = getattr(out, "waveform", None)
                if waveform_tensor is None:
                    raise RuntimeError("Model did not return 'waveform'")

            waveform = waveform_tensor.squeeze().detach().cpu().numpy().astype(np.float32)
            if waveform.ndim == 0:
                waveform = np.expand_dims(waveform, axis=0)

            peak = float(np.max(np.abs(waveform))) if waveform.size else 0.0
            if peak > 1.0:
                waveform = waveform / peak

            pcm16 = (waveform * 32767.0).clip(-32768, 32767).astype(np.int16)

            fd, wav_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd) 
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

        try:
            return await run_in_threadpool(_infer_and_write)
        except Exception as exc:  
            raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc

    async def synthesize(self, text: str) -> FileResponse:
        """Generate speech and return FileResponse (.wav)."""
        wav_path, duration_seconds = await self._synthesize_to_file(text)

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

    async def synthesize_bytes(self, text: str) -> tuple[bytes, float]:
        """Generate speech and return bytes content along with duration."""
        try:
            wav_path, duration_seconds = await self._synthesize_to_file(text)
        except HTTPException:
            raise  # Re-raise HTTPExceptions as-is
        except Exception as exc:
            raise HTTPException(
                status_code=500, 
                detail=f"TTS synthesis failed: {exc}"
            ) from exc

        try:
            with open(wav_path, "rb") as wav_file:
                data = wav_file.read()
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read audio file: {exc}"
            ) from exc
        finally:
            with contextlib.suppress(OSError):
                os.remove(wav_path)

        return data, duration_seconds


tts_service = TTSService(
    model_name="sonktx/mms-tts-vie-finetuned",
    prefer_gpu=True,        
    fallback_on_oom=True,     
    cuda_device="cuda",   
    max_chars=10000000,
    use_vietvoice=True,       
    vietvoice_gender="female",
    vietvoice_area="central",
    vietvoice_emotion="neutral",
)


def on_startup() -> None:
    """Attempt to warm the TTS model on application startup."""
    with contextlib.suppress(RuntimeError):
        tts_service.load()
