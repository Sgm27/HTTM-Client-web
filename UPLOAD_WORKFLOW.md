# Quy trình upload nội dung

Tài liệu này mô tả chi tiết luồng xử lý khi người dùng tải nội dung lên hệ thống, từ giao diện web cho tới các dịch vụ backend, kèm theo tham chiếu mã nguồn cụ thể.

<!-- Step Upload - 1 -->
## Step Upload - 1. Khởi tạo trang upload trên frontend
- Component `Upload` kiểm tra trạng thái đăng nhập và khởi tạo toàn bộ state cần thiết (`formState`, `upload`, theo dõi OCR...) tại `client/src/pages/Upload.tsx:13-95`. Nếu người dùng chưa đăng nhập, hệ thống chuyển hướng về trang `auth`.
- Thành phần kết xuất trước khi upload (preview ảnh, nhãn trạng thái xử lý) được suy luận bằng các `useMemo` và `useEffect` trong cùng file (`client/src/pages/Upload.tsx:46-170`), nhằm chuẩn bị dữ liệu hiển thị khi backend trả về tiến độ.

```tsx
// client/src/pages/Upload.tsx
const Upload = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserRole();
  const [formState, setFormState] = useState<UploadFormState>({
    contentType: ContentType.TEXT,
    visibility: Visibility.PUBLIC,
    title: '',
    description: '',
    contentFiles: [],
    thumbnailFile: null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Vui lòng đăng nhập để đăng nội dung');
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const urls = formState.contentFiles
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [formState.contentFiles]);
```

<!-- Step Upload - 2 -->
## Step Upload - 2. Thu thập dữ liệu từ biểu mẫu
- Form upload hiển thị các trường loại nội dung, chế độ hiển thị, tiêu đề, mô tả, danh sách file nội dung và ảnh thumbnail ở `client/src/components/upload/UploadForm.tsx:26-137`.
- Các handler `handleFileChange` và `handleThumbnailChange` chuyển đổi `FileList` của trình duyệt thành `Array<File>` để lưu vào state (`client/src/components/upload/UploadForm.tsx:27-35`).

```tsx
// client/src/components/upload/UploadForm.tsx
export const UploadForm = ({ state, onStateChange, onSubmit, loading }: UploadFormProps) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    onStateChange({ contentFiles: files });
  };

  const handleThumbnailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onStateChange({ thumbnailFile: file });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Các trường chọn ContentType, Visibility, Title, Description */}
      <Input id="contentFiles" type="file" multiple onChange={handleFileChange} required />
      <Input id="thumbnailFile" type="file" accept="image/*" onChange={handleThumbnailChange} />
      <Button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : 'Tải lên'}</Button>
    </form>
  );
};
```

<!-- Step Upload - 3 -->
## Step Upload - 3. Gửi yêu cầu tạo upload
- Khi người dùng bấm nút “Tải lên”, `handleSubmit` gom toàn bộ state và gọi API `submitUpload` (sau khi kiểm tra đăng nhập và rằng có ít nhất một file) tại `client/src/pages/Upload.tsx:176-211`.
- Hàm `submitUpload` dựng `FormData`, gắn các trường text và danh sách file trước khi `fetch POST /api/uploads` (`client/src/lib/api/uploadApi.ts:44-68`). Toàn bộ phản hồi được validate bằng `zod` rồi ánh xạ về entity `Upload`.

```tsx
// client/src/pages/Upload.tsx
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!user) {
    toast.error('Vui lòng đăng nhập để đăng nội dung');
    return;
  }
  if (formState.contentFiles.length === 0) {
    toast.error('Vui lòng chọn ít nhất một file nội dung');
    return;
  }
  setLoading(true);
  try {
    const createdUpload = await submitUpload({
      userId: user.id,
      contentType: formState.contentType,
      visibility: formState.visibility,
      title: formState.title,
      description: formState.description,
      contentFiles: formState.contentFiles,
      thumbnailFile: formState.thumbnailFile ?? undefined,
    });
    setUpload(createdUpload);
  } finally {
    setLoading(false);
  }
};

// client/src/lib/api/uploadApi.ts
export async function submitUpload(params: SubmitUploadParams): Promise<Upload> {
  const formData = new FormData();
  formData.append('userId', params.userId);
  formData.append('contentType', params.contentType);
  formData.append('visibility', params.visibility);
  formData.append('title', params.title);
  params.contentFiles.forEach((file) => formData.append('contentFiles', file));
  if (params.thumbnailFile) formData.append('thumbnailFile', params.thumbnailFile);

  const response = await fetch(`${API_BASE}/uploads`, { method: 'POST', body: formData });
  const data = await handleJsonResponse(response, createUploadResponseSchema);
  return new Upload(data.upload);
}
```

<!-- Step Upload - 4 -->
## Step Upload - 4. Backend tiếp nhận yêu cầu `/api/uploads`
- FastAPI router `create_upload` nhận multipart form, hợp nhất `contentFile` đơn lẻ và `contentFiles` dạng danh sách, rồi chuyển thành `UploadFilePayload` tại `server/src/api/routes/uploads.py:16-78`.
- Các tham số text được chuẩn hóa thành `UploadRequest` thông qua `make_upload_request`, bảo đảm giá trị `content_type` và `visibility` hợp lệ (`server/src/services/upload_service.py:445-473`).

```python
# server/src/api/routes/uploads.py
@router.post("", response_model=None)
async def create_upload(
    background_tasks: BackgroundTasks,
    userId: str = Form(...),
    contentType: str = Form(...),
    visibility: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    contentFile: Optional[UploadFile] = File(None),
    contentFiles: Optional[List[UploadFile]] = File(None),
    thumbnailFile: Optional[UploadFile] = File(None),
    service: UploadService = Depends(_get_upload_service),
):
    request = make_upload_request(
        user_id=userId,
        content_type=contentType,
        visibility=visibility,
        title=title,
        description=description,
    )
    files: List[UploadFile] = []
    if contentFiles:
        files.extend(contentFiles)
    elif contentFile is not None:
        files.append(contentFile)
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Vui lòng chọn ít nhất một file nội dung.")
    content_payloads = [
        UploadFilePayload(filename=file.filename or "upload", content_type=file.content_type, data=await file.read())
        for file in files
    ]
    thumbnail_payload = (
        UploadFilePayload(filename=thumbnailFile.filename or "thumbnail",
                          content_type=thumbnailFile.content_type,
                          data=await thumbnailFile.read())
        if thumbnailFile is not None else None
    )
    response = await service.create_upload(request, content_payloads, thumbnail_payload, background_tasks=background_tasks)
    return response.to_api()
```

<!-- Step Upload - 5 -->
## Step Upload - 5. `UploadService` xử lý tệp và ghi nhận vào Supabase
- Phương thức `create_upload` chịu trách nhiệm toàn bộ nghiệp vụ tại `server/src/services/upload_service.py:47-175`.
  - Mỗi file được tải lên bucket Supabase Storage “uploads” với đường dẫn định danh theo người dùng (`server/src/services/upload_service.py:80-113`).
  - Trạng thái ban đầu của upload được quyết định bởi `_derive_initial_state` (`server/src/services/upload_service.py:260-324`):
    - Nếu là tài liệu đơn (pdf/doc/txt), hệ thống trích xuất văn bản bằng `DocumentExtractor` (`server/src/services/document_extractor.py:6-58`) để đặt `StoryStatus.READY` và `ProcessingStatus.COMPLETED`.
    - Nếu là tập ảnh, upload chuyển sang `StoryStatus.OCR_IN_PROGRESS`, `ProcessingStatus.PROCESSING` để chờ OCR.
    - TH hỗn hợp ảnh + tài liệu hoặc định dạng không hỗ trợ sẽ bị từ chối với HTTP lỗi phù hợp.
  - Bản ghi upload chính được thêm vào bảng `uploads` qua `UploadDAO.create` (`server/src/dao/upload_dao.py:68-78`), kèm các trường tiến độ, văn bản đã trích xuất nếu có.
  - Với ảnh, hệ thống tạo nhiều bản ghi `upload_images` bằng `UploadImageDAO.create_many` (`server/src/dao/upload_image_dao.py:37-52`) và gán trạng thái ban đầu phù hợp (`server/src/services/upload_service.py:140-165`).
  - Nếu OCR được bật, từng ảnh được đẩy vào background task `_process_image_ocr` (`server/src/services/upload_service.py:348-379`), ở đó ảnh được chạy qua `ocr_service.run_bytes` (`server/src/services/upload_service.py:412-421`) sử dụng mô hình định nghĩa trong `server/src/services/ocr.py:46-130`.
  - Sau mỗi lần OCR hoàn tất hoặc thất bại, `_refresh_upload_progress` tổng hợp tiến độ và cập nhật bảng `uploads` qua `UploadDAO.update_processing`, bao gồm cả văn bản OCR ghép lại (`server/src/services/upload_service.py:381-410` + `server/src/dao/upload_dao.py:103-126` + `server/src/services/upload_service.py:424-428`).
  - Mọi lỗi phát sinh sẽ rollback file trên Storage (`server/src/services/upload_service.py:430-442`) trước khi ném `UploadServiceError`.
- Response cuối cùng được đóng gói dưới dạng `CreateUploadResponse` → JSON camelCase (`server/src/dtos/upload.py:124-178`).

```python
# server/src/services/upload_service.py
prepared_files: list[_PreparedFile] = []
for index, payload in enumerate(content_files):
    content_path = self._build_object_path(request.user_id, payload.filename)
    bucket.upload(
        content_path,
        payload.data,
        {"content-type": payload.content_type or "application/octet-stream"},
    )
    prepared_files.append(
        _PreparedFile(
            payload=payload,
            storage_path=content_path,
            public_url=self._resolve_public_url(content_path),
            is_image=self._is_image_file(payload),
            order_index=index,
        )
    )

story_status, processing_status, progress, extracted_text, ocr_text = self._derive_initial_state(
    prepared_files=prepared_files,
    user_id=request.user_id,
)

record = UploadCreateRecord(
    user_id=request.user_id,
    content_type=request.content_type,
    visibility=request.visibility,
    title=request.title,
    description=request.description,
    content_file_id=primary_path,
    thumbnail_file_id=thumbnail_path,
    status=story_status,
    processing_status=processing_status,
    progress=progress,
    extracted_text=extracted_text,
    ocr_text=ocr_text,
    created_at=now,
    updated_at=now,
)
upload = await self._upload_dao.create(record)
```

<!-- Step Upload - 6 -->
## Step Upload - 6. Frontend nhận phản hồi và theo dõi OCR
- Sau khi upload thành công, state `upload`, `ocrProgress`, `ocrText` được cập nhật để hiển thị ngay nội dung trích xuất (`client/src/pages/Upload.tsx:202-205`).
- Một `useEffect` bắt đầu vòng polling mỗi 10 giây, gọi `trackOcrProgress` để lấy tiến độ mới nhất (`client/src/pages/Upload.tsx:96-170`). API client tương ứng nằm tại `client/src/lib/api/uploadApi.ts:70-72`.
- Endpoint `GET /api/uploads/{id}/ocr-progress` trả về trạng thái OCR, nội dung đã trích xuất và danh sách ảnh bằng cách đọc dữ liệu từ Supabase (`server/src/api/routes/uploads.py:95-106` + `server/src/services/upload_service.py:197-226`).
- Thành phần `ProgressBar` (`client/src/components/upload/ProgressBar.tsx:1-13`) và vùng hiển thị văn bản/ảnh được cập nhật theo `ProcessingStatus` và nội dung trong state (`client/src/pages/Upload.tsx:325-405`).

```tsx
// client/src/pages/Upload.tsx
useEffect(() => {
  if (!upload) return;
  let timeoutId: number | undefined;
  const pollOcr = async () => {
    try {
      const result = await trackOcrProgress(upload.id);
      setOcrProgress(result.progress);
      const combinedText = result.ocrText ?? result.extractedText ?? result.text;
      if (combinedText) setOcrText(combinedText);
      setUpload((prev) => prev ? new UploadEntity({ ...prev, progress: result.progress, processingStatus: result.status }) : prev);
      if (result.status === ProcessingStatus.PROCESSING) {
        timeoutId = window.setTimeout(pollOcr, 10000);
      }
    } catch (error) {
      toast.error('Không thể cập nhật tiến độ OCR');
      timeoutId = window.setTimeout(pollOcr, 10000);
    }
  };
  pollOcr();
  return () => timeoutId && window.clearTimeout(timeoutId);
}, [upload]);

// server/src/services/upload_service.py
return {
    "status": upload.processing_status.value,
    "storyStatus": upload.status.value,
    "progress": upload.progress or 0,
    "ocrText": upload.ocr_text,
    "extractedText": upload.extracted_text,
    "images": [
        {
            "id": image.id,
            "uploadId": image.upload_id,
            "status": image.status.value,
            "progress": image.progress,
            "publicUrl": image.public_url,
            "storagePath": image.storage_path,
            "order": image.order_index,
            "extractedText": image.extracted_text,
        }
        for image in images
    ],
}
```

<!-- Step Upload - 7 -->
## Step Upload - 7. Tạo Story sau khi upload sẵn sàng
- Nút “Tạo Story” chỉ bật khi upload đã `READY` hoặc OCR hoàn tất (`client/src/pages/Upload.tsx:58-95` & `391-405`). Khi người dùng bấm, `handleCreateStory` gọi API `createStory` và chuyển sang trạng thái chờ (`client/src/pages/Upload.tsx:214-273`).
- Hàm `createStory` gửi `POST /api/stories` với `uploadId` kèm JSON (`client/src/lib/api/uploadApi.ts:75-85`).
- Router `create_story` lấy dữ liệu từ bảng `uploads`, dựng bản ghi `stories`, và chèn vào Supabase (`server/src/api/routes/stories.py:234-316`). Văn bản chính ưu tiên `ocr_text` rồi `extracted_text` (`server/src/api/routes/stories.py:261-306`).
- Sau khi có story:
  - Hệ thống gán lại `upload_images.story_id` để story có thể hiển thị ảnh (`server/src/api/routes/stories.py:339-358`).
  - Dữ liệu trả về bao gồm thông tin story, trạng thái audio, thumbnail, danh sách ảnh... (`server/src/api/routes/stories.py:360-414`).

```tsx
// client/src/pages/Upload.tsx
const handleCreateStory = async () => {
  if (!upload) return;
  setCreateStoryStage('creating');
  try {
    const story = await createStory(upload.id);
    if (story.audioStatus === 'PENDING' || story.audioStatus === 'PROCESSING') {
      setCreateStoryStage('generatingAudio');
      await pollAudioStatus(story.id);
    }
    navigate('/story/' + story.id);
  } finally {
    setCreateStoryStage('idle');
  }
};

// server/src/api/routes/stories.py
story_insert = {
    "upload_id": request.uploadId,
    "title": upload_data.get("title", ""),
    "description": upload_data.get("description"),
    "content": combined_text,
    "author_id": upload_data.get("user_id"),
    "content_type": upload_data.get("content_type", "TEXT"),
    "is_public": is_public,
    "status": "PUBLISHED",
    "audio_status": initial_audio_status,
    "thumbnail_url": thumbnail_url,
}
response = supabase.table("stories").insert(story_insert).execute()
supabase.table("upload_images").update({"story_id": story_id}).eq("upload_id", request.uploadId).execute()
```

<!-- Step Upload - 8 -->
## Step Upload - 8. Sinh audio và polling trạng thái trên frontend
- Nếu TTS được bật, background task `generate_audio_background` được nối vào `BackgroundTasks`, ngay sau khi tạo story (`server/src/api/routes/stories.py:319-335`). Task này sinh file audio, lưu lên bucket `audio-files`, rồi cập nhật `audio_url` và `audio_status` (`server/src/api/routes/stories.py:10-45`).
- Trong lúc đó, `handleCreateStory` liên tục gọi `getAudioStatus` mỗi 10 giây cho tới khi trạng thái chuyển sang `COMPLETED/FAILED`, hoặc tới giới hạn thời gian (`client/src/pages/Upload.tsx:223-264`). Client helper `getAudioStatus` nằm ở `client/src/lib/api/uploadApi.ts:108-127`.
- Endpoint `GET /api/stories/{id}/audio-status` đọc trạng thái từ bảng `stories` và trả về JSON (`server/src/api/routes/stories.py:427-454`). Người dùng cũng có thể kích hoạt lại việc tạo audio thủ công qua `POST /api/stories/{id}/generate-audio` nếu cần (`server/src/api/routes/stories.py:465-520`).

```tsx
// client/src/pages/Upload.tsx
const pollAudioStatus = async (storyId: string) => {
  const pollInterval = 10000;
  const maxAttempts = 600;
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const statusResponse = await getAudioStatus(storyId);
    if (statusResponse.audioStatus === 'COMPLETED' || statusResponse.audioStatus === 'FAILED') {
      return statusResponse;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  throw new Error('Audio generation timeout');
};

// server/src/api/routes/stories.py
async def generate_audio_background(story_id: str, story_content: str, author_id: str, supabase_url: str, service_role_key: str):
    supabase: Client = create_client(supabase_url, service_role_key)
    supabase.table("stories").update({"audio_status": "PROCESSING"}).eq("id", story_id).execute()
    audio_bytes, _ = await tts_service.synthesize_bytes(story_content)
    audio_filename = f"{author_id}/{uuid4()}.wav"
    supabase.storage.from_("audio-files").upload(audio_filename, audio_bytes, {"content-type": "audio/wav"})
    audio_url = supabase.storage.from_("audio-files").get_public_url(audio_filename)
    supabase.table("stories").update({
        "audio_url": audio_url,
        "audio_status": "COMPLETED",
    }).eq("id", story_id).execute()
```

## 9. Định nghĩa chung và hạ tầng liên quan
- Các enum thống nhất giữa frontend và backend (ví dụ `ContentType`, `StoryStatus`, `ProcessingStatus`) nằm tại `client/src/entities/enums.ts:1-25` và `server/src/entities/enums.py:6-36`, đảm bảo giá trị trạng thái đồng bộ.
- Entity `Upload` trên frontend ánh xạ JSON trả về thành class có phương thức tiện ích (`client/src/entities/Upload.ts:4-64`), giúp đồng bộ hiển thị.
- Ứng dụng FastAPI tự động mount router dưới prefix `/api`, khớp với `API_BASE` của frontend (`server/src/main.py:30-36` và `client/src/lib/api/uploadApi.ts:13`).
- Kết nối cơ sở dữ liệu và Storage đều thông qua Supabase client với Service Role để có quyền ghi tệp và bảng (`server/src/services/upload_service.py:47-65`).

```ts
// client/src/entities/enums.ts
export enum ContentType {
  TEXT = 'TEXT',
  COMIC = 'COMIC',
  NEWS = 'NEWS',
}
export enum Visibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}
export enum StoryStatus {
  DRAFT = 'DRAFT',
  OCR_IN_PROGRESS = 'OCR_IN_PROGRESS',
  READY = 'READY',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

# server/src/main.py
def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.backend_app_name)
    api_prefix = settings.backend_api_prefix.rstrip("/")
    app.include_router(stories.router, prefix=api_prefix)
    app.include_router(uploads.router, prefix=api_prefix)
    return app
```

Như vậy, luồng upload bao trùm từ việc thu thập input trên trình duyệt, truyền tải multi-part tới backend, lưu trữ tệp và metadata trên Supabase, xử lý OCR/TT S không đồng bộ, rồi cuối cùng tạo story hoàn chỉnh để người dùng truy cập.
