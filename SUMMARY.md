# HTTM System Summary

## Backend (FastAPI)

1. **Environment setup**
   - Create a virtual environment inside `backend/`: `python -m venv .venv`.
   - Install dependencies: `.venv/bin/pip install -r backend/requirements.txt`.
   - Install the Vintern OCR and VietVoice TTS dependencies to enable AI features; requests will fail if the models are missing.
2. **Configuration**
   - Optional `.env` keys (sensible defaults are provided for local testing):
     - `API_PREFIX` (default `/api`)
     - `APP_NAME`
     - `CORS_ORIGINS` (comma separated list)
     - `SUPABASE_URL` (defaults to `http://localhost:54321` when unset)
     - `SUPABASE_SERVICE_ROLE_KEY` (defaults to `local-service-role`)
     - `SUPABASE_ANON_KEY`
3. **Running**
   - Start with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` (activate the venv first).
4. **Notable behaviour**
   - `/api/ocr` and `/api/tts` require their respective ML backends; the endpoints return HTTP 500 if the dependencies are absent.

## Frontend (Vite + React)

1. **Dependencies**
   - Requires Node.js 18+ (Node 22 used in CI) and npm.
   - Install packages with `npm install` inside `frontend/` (existing `node_modules/` can be reused offline).
2. **Development server**
   - Run `npm run dev -- --host 0.0.0.0 --port 8080` (default host/port defined in `vite.config.ts`).
   - The Supabase client automatically falls back to an in-memory mock when `VITE_BACKEND_URL` is not defined, enabling local/offline testing.
3. **Build**
   - `npm run build` generates the production bundle into `frontend/dist`.

## Backend API verification

- Start the service with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
- With the server running, the endpoints can be exercised from another shell using standard REST calls. For example:
  ```bash
  python - <<'PY'
  import httpx, io
  from PIL import Image

  base = "http://127.0.0.1:8000"

  # OCR
  img = Image.new("RGB", (10, 10), "red")
  buf = io.BytesIO()
  img.save(buf, format="PNG")
  buf.seek(0)
  ocr = httpx.post(f"{base}/api/ocr", data={"question": "Mô tả hình ảnh?"}, files={"file": ("demo.png", buf.getvalue(), "image/png")})
  print("OCR status:", ocr.status_code, "| response:", ocr.json())

  # TTS
  tts = httpx.post(f"{base}/api/tts", data={"text": "Xin chào hệ thống!"}, timeout=5)
  print("TTS status:", tts.status_code, "| duration header:", tts.headers.get("X-Audio-Duration"), "| bytes:", len(tts.content))
  PY
  ```

## Notes & Caveats

- Heavy ML dependencies (Vintern OCR, VietVoice TTS) must be installed for the AI endpoints to succeed; missing models result in HTTP 500 errors.
- Supabase integration can work through the backend proxy when configured, but for offline development the mock client stores data in-memory and issues a console warning.
- Ensure Pillow (`PIL`) is available for the backend OCR fallback test script.
