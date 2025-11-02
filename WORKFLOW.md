# Workflow Upload Truyện - Hệ Thống Truyện Thông Minh

## Tổng quan
Tài liệu này mô tả chi tiết quy trình upload và xử lý truyện trong hệ thống, từ khi người dùng gửi file cho đến khi truyện được xuất bản với audio.

---

## 🎯 Các Bước Chính

```
[User Upload] → [Client Validation] → [Server Upload] → [Extract Text] → [Create Story] → [Generate Audio] → [Published]
```

---

## 📝 Chi Tiết Workflow

### **Bước 1: User Interface - Chọn File và Điền Thông Tin**
**Location:** `client/src/pages/Upload.tsx`

#### Hành động của User:
1. User truy cập trang `/upload`
2. Hệ thống kiểm tra authentication:
   - Nếu chưa đăng nhập → redirect về `/auth`
   - Nếu đã đăng nhập → hiển thị form upload

#### Form Upload State:
```typescript
{
  contentType: ContentType,      // TEXT, COMIC, hoặc NEWS
  visibility: Visibility,        // PUBLIC hoặc PRIVATE
  title: string,                 // Tiêu đề truyện
  description: string,           // Mô tả (optional)
  contentFile: File,            // File nội dung (bắt buộc)
  thumbnailFile: File | null    // Ảnh thumbnail (optional)
}
```

#### Loại File Được Hỗ Trợ:
- **Text files:** `.txt`
- **Documents:** `.pdf`, `.docx`, `.doc`
- **Images (cần OCR):** `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`

---

### **Bước 2: Client - Gửi Request Upload**
**Location:** `client/src/lib/api/uploadApi.ts` → `submitUpload()`

#### Process:
1. Client tạo `FormData` object chứa:
   ```typescript
   - userId: string
   - contentType: string (TEXT/COMIC/NEWS)
   - visibility: string (PUBLIC/PRIVATE)
   - title: string
   - description?: string
   - contentFile: File
   - thumbnailFile?: File
   ```

2. Gửi POST request đến `/api/uploads`:
   ```typescript
   fetch(`/api/uploads`, {
     method: 'POST',
     body: formData  // multipart/form-data
   })
   ```

3. Nhận response:
   ```typescript
   {
     upload: {
       id: string,
       userId: string,
       contentType: string,
       status: string,        // DRAFT/OCR_IN_PROGRESS/READY/FAILED
       progress: number,      // 0-100
       content?: string,      // extracted text (nếu có)
       contentUrl: string,    // URL file gốc
       thumbnailUrl?: string, // URL ảnh thumbnail
       ...
     }
   }
   ```

4. Client lưu `upload` object vào state và bắt đầu tracking progress

---

### **Bước 3: Server - Nhận và Xử Lý Upload**
**Location:** `server/src/api/routes/uploads.py` → `create_upload()`

#### 3.1. Upload Files lên Supabase Storage:

1. **Upload Content File:**
   ```python
   # Generate unique filename: {userId}/{uuid}_{originalFilename}
   content_filename = f"{userId}/{uuid.uuid4()}_{contentFile.filename}"
   
   # Upload to Supabase Storage bucket "uploads"
   supabase.storage.from_("uploads").upload(
       content_filename,
       content_data,
       {"content-type": contentFile.content_type}
   )
   
   # Get public URL
   content_url = supabase.storage.from_("uploads").get_public_url(content_filename)
   ```

2. **Upload Thumbnail (nếu có):**
   ```python
   thumbnail_filename = f"{userId}/{uuid.uuid4()}_{thumbnailFile.filename}"
   # Similar upload process...
   ```

#### 3.2. Xác Định Loại Xử Lý:

Server phân loại file dựa trên extension:

```python
file_extension = contentFile.filename.lower().split('.')[-1]

# Loại 1: Text files (txt)
text_extensions = ['txt', 'text']

# Loại 2: Documents (pdf, docx)
document_extensions = ['pdf', 'docx', 'doc']

# Loại 3: Images (jpg, png, etc.)
image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
```

#### 3.3. Extract Text Content:

**A. Đối với TEXT/DOCUMENT files:**

**Location:** `server/src/services/document_extractor.py`

```python
from document_extractor import DocumentExtractor

extracted_content = DocumentExtractor.extract_text(content_data, filename)
```

**Xử lý theo loại file:**

1. **TXT files:**
   ```python
   # Decode với multiple encoding fallback
   encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
   # Try each encoding until success
   ```

2. **PDF files:**
   ```python
   from PyPDF2 import PdfReader
   
   # Đọc từng trang và extract text
   pdf_reader = PdfReader(file_bytes)
   for page in pdf_reader.pages:
       text_content.append(page.extract_text())
   ```

3. **DOCX files:**
   ```python
   from docx import Document
   
   # Đọc từng paragraph
   doc = Document(file_bytes)
   for paragraph in doc.paragraphs:
       text_content.append(paragraph.text)
   ```

**Kết quả:**
- Nếu extract thành công → `status = "READY"`, `progress = 100`
- Nếu thất bại → `status = "FAILED"`

**B. Đối với IMAGE files:**

**Location:** `server/src/services/ocr.py`

```python
# Kiểm tra OCR service có enabled không
if file_extension in image_extensions and settings.ocr_service_enabled:
    initial_status = "OCR_IN_PROGRESS"
    initial_progress = 0
    # TODO: Trigger OCR job (sử dụng Vintern-1B model)
```

**OCR Service (đang development):**
- Model: `5CD-AI/Vintern-1B-v3_5`
- Process: Extract Vietnamese text from images
- Status sẽ được update qua background job

#### 3.4. Lưu Upload Record vào Database:

```python
upload_data = {
    "user_id": userId,
    "content_type": contentType,
    "visibility": visibility,
    "title": title,
    "description": description,
    "content_file_id": content_filename,
    "thumbnail_file_id": thumbnail_filename,
    "status": initial_status,        # DRAFT/READY/OCR_IN_PROGRESS/FAILED
    "progress": initial_progress,     # 0-100
    "extracted_text": extracted_content,  # text content (nếu có)
    "created_at": datetime.utcnow(),
    "updated_at": datetime.utcnow()
}

# Insert vào Supabase table "uploads"
response = supabase.table("uploads").insert(upload_data).execute()
```

#### 3.5. Return Response:

Server transform snake_case → camelCase cho frontend:
```python
{
    "upload": {
        "id": "...",
        "userId": "...",
        "status": "READY",
        "progress": 100,
        "content": "extracted text...",  # mapped from extracted_text
        "contentUrl": "https://...",
        "thumbnailUrl": "https://...",
        ...
    }
}
```

---

### **Bước 4: Client - Track OCR Progress (nếu cần)**
**Location:** `client/src/pages/Upload.tsx` → `useEffect` polling

Nếu `upload.status === "OCR_IN_PROGRESS"`:

```typescript
// Poll every 3 seconds
const pollOcr = async () => {
  const result = await trackOcrProgress(upload.contentFileId);
  // result: { progress: number, text?: string }
  
  setOcrProgress(result.progress);
  setOcrText(result.text);
  
  if (result.progress >= 100) {
    // OCR completed
    setUpload(prev => ({
      ...prev,
      status: StoryStatus.READY,
      progress: 100
    }));
  } else {
    // Continue polling
    setTimeout(pollOcr, 3000);
  }
};
```

**API Endpoint:** `GET /api/ocr/progress/{fileId}`

#### Progress States:
- **0-99%**: Đang xử lý OCR
- **100%**: OCR hoàn thành, có text content
- **Failed**: OCR thất bại

---

### **Bước 5: Create Story từ Upload**
**Location:** 
- Client: `client/src/lib/api/uploadApi.ts` → `createStory()`
- Server: `server/src/api/routes/stories.py` → `create_story()`

#### Điều kiện để create story:
```typescript
isReadyToCreateStory = upload.status === "READY" || ocrProgress === 100
```

#### 5.1. Client gửi request:

```typescript
const story = await createStory(upload.id);

// POST /api/stories
// Body: { uploadId: string }
```

#### 5.2. Server xử lý:

**A. Fetch Upload Data:**
```python
upload_response = supabase.table("uploads").select("*").eq("id", uploadId).execute()
upload_data = upload_response.data[0]
```

**B. Prepare Story Data:**
```python
# Map visibility to is_public boolean
is_public = upload_data.get("visibility") == "PUBLIC"

# Get thumbnail URL từ storage
thumbnail_url = supabase.storage.from_("uploads").get_public_url(thumbnail_file_id)

story_insert = {
    "upload_id": uploadId,
    "title": upload_data["title"],
    "description": upload_data["description"],
    "content": upload_data["extracted_text"],  # Text content
    "author_id": upload_data["user_id"],
    "content_type": upload_data["content_type"],
    "is_public": is_public,
    "status": "PUBLISHED",
    "audio_status": "PENDING",  # Audio chưa generate
    "thumbnail_url": thumbnail_url
}
```

**C. Insert Story:**
```python
response = supabase.table("stories").insert(story_insert).execute()
story_data = response.data[0]
```

**D. Auto-Generate TTS Audio (nếu enabled):**
```python
if settings.tts_service_enabled and story_content.strip():
    # Update status to PROCESSING
    supabase.table("stories").update({
        "audio_status": "PROCESSING"
    }).eq("id", story_id).execute()
    
    try:
        # Generate audio
        from services.tts import tts_service
        audio_bytes, duration = await tts_service.synthesize_bytes(story_content)
        
        # Upload to storage
        audio_filename = f"{author_id}/{uuid4()}.wav"
        supabase.storage.from_("audio-files").upload(
            audio_filename,
            audio_bytes,
            {"content-type": "audio/wav"}
        )
        
        # Get public URL
        audio_url = supabase.storage.from_("audio-files").get_public_url(audio_filename)
        
        # Update story with audio URL
        supabase.table("stories").update({
            "audio_url": audio_url,
            "audio_status": "COMPLETED"
        }).eq("id", story_id).execute()
        
    except Exception as e:
        # Mark as FAILED if error
        supabase.table("stories").update({
            "audio_status": "FAILED"
        }).eq("id", story_id).execute()
```

---

### **Bước 6: Generate Audio (Manual trigger nếu cần)**
**Location:** 
- Client: `client/src/lib/api/uploadApi.ts` → `generateStoryAudio()`
- Server: `server/src/api/routes/stories.py` → `generate_audio()`

Nếu audio chưa được generate tự động hoặc thất bại:

#### 6.1. Client Request:
```typescript
const generated = await generateStoryAudio(story.id);
// POST /api/stories/{storyId}/generate-audio
// Body: { speed?: 1.0, voice?: string }
```

#### 6.2. TTS Service Process:

**Location:** `server/src/services/tts.py`

**A. Load Model:**
```python
class TTSService:
    model_name = "sonktx/mms-tts-vie-finetuned"  # MMS VITS Vietnamese model
    
    def load(self):
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = VitsModel.from_pretrained(model_name).eval()
        
        # Use GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
```

**B. Synthesize Speech:**
```python
async def synthesize_bytes(text: str) -> tuple[bytes, float]:
    # Tokenize
    inputs = tokenizer(text, return_tensors="pt")
    
    # Generate speech
    with torch.no_grad():
        output = model(**inputs).waveform
    
    # Convert to numpy array
    audio_array = output.squeeze().cpu().numpy()
    
    # Write to WAV bytes
    # sampling_rate = 22050
    # return (wav_bytes, duration)
```

**C. Upload & Update:**
```python
# Upload audio file to Supabase Storage bucket "audio-files"
audio_filename = f"{author_id}/{uuid4()}.wav"
supabase.storage.from_("audio-files").upload(...)

# Update story record
audio_url = supabase.storage.from_("audio-files").get_public_url(audio_filename)
supabase.table("stories").update({
    "audio_url": audio_url,
    "audio_status": "COMPLETED"
}).execute()
```

---

### **Bước 7: Hoàn Thành và Chuyển Hướng**

```typescript
// Client nhận story với audio
toast.success('Đã tạo truyện và audio thành công');
navigate('/story/' + story.id);
```

User được chuyển đến trang chi tiết truyện để xem và nghe audio.

---

## 📊 State Flow Diagram

### Upload Status Flow:
```
DRAFT 
  ↓
  ├─→ [Text/Doc] → READY (100%)
  ├─→ [Image + OCR] → OCR_IN_PROGRESS → READY (100%)
  └─→ [Error] → FAILED
```

### Story Audio Status Flow:
```
PENDING 
  ↓
PROCESSING 
  ↓
  ├─→ COMPLETED (có audio URL)
  └─→ FAILED (retry hoặc manual fix)
```

---

## 🗄️ Database Schema

### Table: `uploads`
```sql
- id: uuid (PK)
- user_id: uuid (FK → profiles)
- content_type: enum (TEXT, COMIC, NEWS)
- visibility: enum (PUBLIC, PRIVATE)
- title: text
- description: text
- content_file_id: text (storage path)
- thumbnail_file_id: text (storage path)
- status: text (DRAFT, READY, OCR_IN_PROGRESS, FAILED)
- progress: integer (0-100)
- extracted_text: text (nội dung đã extract)
- error_reason: text
- created_at: timestamp
- updated_at: timestamp
```

### Table: `stories`
```sql
- id: uuid (PK)
- upload_id: uuid (FK → uploads)
- author_id: uuid (FK → profiles)
- title: text
- description: text
- content: text (nội dung truyện)
- content_type: enum (TEXT, COMIC, NEWS)
- is_public: boolean
- status: text (DRAFT, PUBLISHED)
- audio_url: text (URL file audio)
- audio_status: text (PENDING, PROCESSING, COMPLETED, FAILED)
- thumbnail_url: text
- cover_image_url: text
- view_count: integer
- created_at: timestamp
- updated_at: timestamp
```

---

## 🔧 Configuration

### Environment Variables

**Server (`server/src/utils/config.py`):**
```python
SUPABASE_URL: str
SUPABASE_ANON_KEY: str
SUPABASE_SERVICE_ROLE_KEY: str
OCR_SERVICE_ENABLED: bool = False  # Enable OCR for images
TTS_SERVICE_ENABLED: bool = True   # Enable auto TTS
```

**Client (`client/.env`):**
```
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

---

## 🚀 Services Dependencies

### Document Extraction:
- **PyPDF2**: Extract text từ PDF
- **python-docx**: Extract text từ DOCX
- Built-in: TXT file decoding

### OCR (Optional):
- **Model**: Vintern-1B-v3_5 (5CD-AI)
- **Dependencies**: torch, transformers, PIL
- **Device**: CUDA preferred, CPU fallback

### TTS (Text-to-Speech):
- **Model**: mms-tts-vie-finetuned (sonktx)
- **Dependencies**: torch, transformers, numpy
- **Output**: WAV audio, 22050 Hz
- **Max input**: 1000 characters (configurable)

---

## ⚠️ Error Handling

### Client Side:
```typescript
try {
  const upload = await submitUpload(...);
  toast.success('Đã gửi yêu cầu xử lý nội dung');
} catch (error) {
  toast.error('Không thể tải lên nội dung');
}
```

### Server Side:
```python
try:
    # Process upload
except Exception as e:
    raise HTTPException(
        status_code=500,
        detail=f"Failed to create upload: {str(e)}"
    )
```

### Common Errors:
1. **File too large**: Storage upload failed
2. **Invalid format**: Unsupported file type
3. **OCR failed**: Image quality issues
4. **TTS failed**: Text too long or invalid characters
5. **Auth failed**: User not authenticated

---

## 🎯 Performance Considerations

### 1. File Upload:
- Max file size: Configured by Supabase Storage (default ~50MB)
- Upload timeout: 30 seconds
- Chunked upload: Not implemented (single request)

### 2. Text Extraction:
- Synchronous: Blocks request until complete
- Timeout: Depends on file size
- Memory: Loaded into RAM during processing

### 3. OCR Processing:
- Asynchronous: Background job (TODO)
- GPU accelerated when available
- Polling interval: 3 seconds

### 4. TTS Generation:
- Synchronous: Can be slow for long text
- GPU accelerated preferred
- Character limit: 1000 chars (to prevent timeout)
- Audio format: WAV (high quality, large file)

---

## 📱 User Experience Flow

### Happy Path Timeline:
```
1. User selects file (TXT/PDF)     : 0s
2. User fills form & submits       : ~5s
3. Client uploads to server        : ~2-5s (depends on file size)
4. Server extracts text            : ~1-3s (depends on format)
5. Server saves to database        : ~0.5s
6. Client receives upload record   : ~0.5s
7. User clicks "Create Story"      : 0s
8. Server creates story            : ~0.5s
9. Server generates TTS audio      : ~10-30s (depends on text length)
10. Client redirects to story page : ~0.5s

Total: ~20-50 seconds
```

### With OCR (Image input):
```
1-6: Same as above
7. Client polls OCR progress       : ~30-120s (depends on image complexity)
8-10: Same as above

Total: ~50-170 seconds
```

---

## 🔮 Future Improvements

### 1. Background Processing:
- [ ] Queue system for OCR jobs (Celery, RQ)
- [ ] Queue system for TTS jobs
- [ ] WebSocket for real-time progress updates

### 2. Optimization:
- [ ] Chunked file upload for large files
- [ ] Streaming TTS for long text
- [ ] Audio compression (WAV → MP3)
- [ ] Thumbnail generation from PDF/Images

### 3. Features:
- [ ] Batch upload multiple files
- [ ] Edit extracted text before creating story
- [ ] Multiple voice options for TTS
- [ ] Audio playback speed control

### 4. Error Recovery:
- [ ] Retry mechanism for failed uploads
- [ ] Resume interrupted uploads
- [ ] Manual OCR retry
- [ ] Manual TTS retry with different settings

---

## 📚 Related Files

### Client:
- `client/src/pages/Upload.tsx` - Main upload page
- `client/src/components/upload/UploadForm.tsx` - Form component
- `client/src/dao/UploadDAO.ts` - Upload data access
- `client/src/lib/api/uploadApi.ts` - API client functions

### Server:
- `server/src/api/routes/uploads.py` - Upload endpoints
- `server/src/api/routes/stories.py` - Story endpoints
- `server/src/services/document_extractor.py` - Text extraction
- `server/src/services/ocr.py` - OCR service (Vintern)
- `server/src/services/tts.py` - TTS service (MMS VITS)

### Database:
- `supabase/migrations/20251030000000_create_uploads_table.sql`

---

## 🤝 Contributing

Khi thêm tính năng mới vào workflow upload:

1. **Update Backend**: Thêm endpoint/service mới
2. **Update Frontend**: Thêm UI và API client
3. **Update Database**: Tạo migration nếu cần
4. **Update Documentation**: Cập nhật file này
5. **Add Tests**: Unit tests cho business logic
6. **Test E2E**: Test toàn bộ workflow từ UI → DB

---

**Last Updated**: November 2, 2025
**Version**: 1.0
**Maintainer**: Development Team
