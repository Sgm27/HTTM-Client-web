# HTTM Backend

Ứng dụng FastAPI làm tầng trung gian giữa frontend và Supabase cũng như các dịch vụ ML (OCR/TTS).

## Cấu trúc

- `app/main.py`: khởi tạo FastAPI, cấu hình CORS và gắn router.
- `app/api/routes`: định nghĩa các endpoint (`/api/health`, `/api/ocr`, `/api/tts`, `/api/supabase/*`).
- `app/services/supabase_proxy.py`: proxy HTTP đến Supabase (PostgREST, Auth, Storage...).
- `app/services/ocr.py`: tải model OCR Vintern và wrapper TTS VietVoice.
- `requirements.txt`: các phụ thuộc Python.

## Biến môi trường

Tạo file `.env` trong thư mục `backend`:

```env
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
# Tuỳ chọn: khoá anon nếu cần
SUPABASE_ANON_KEY="<anon-key>"
CORS_ORIGINS="http://localhost:5173"
API_PREFIX="/api"
```

## Chạy phát triển

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Kiến trúc

Frontend chỉ gọi vào các endpoint của backend. Backend chịu trách nhiệm ký xác thực với Supabase và thực thi truy vấn/Storage/Auth thông qua proxy.
