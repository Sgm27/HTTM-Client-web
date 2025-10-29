# Upload Story Module Refactor Summary

## Mapping cũ → mới

| Thành phần cũ | Thành phần mới |
| --- | --- |
| `frontend/` | `client/` |
| `backend/app` | `server/src` |
| `pages/Upload.tsx` xử lý trực tiếp Supabase | `pages/Upload.tsx` sử dụng `lib/api/uploadApi` + `components/upload/*` |
| `pages/uploadService.ts` | Được thay bằng `dao/UploadDAO` & `lib/api/uploadApi.ts` |
| `StoryDetail.tsx` thao tác nội bộ | `StoryDetail.tsx` dùng `AudioPlayer`, `ActionBar`, `CommentList` |

## Checklist khớp UML

- [x] UI phân tách thành `UploadForm`, `ProgressBar`, `AudioPlayer`, `ActionBar`, `CommentList`.
- [x] Tầng DAO: `UploadDAO`, `FileDAO`, `StoryDAO` với chữ ký chuẩn.
- [x] Entities & enums đồng bộ theo UML ở cả client (`client/src/entities`) và server (`server/src/entities`).
- [x] DTOs chia sẻ qua `client/src/dtos` và `server/src/dtos`.
- [x] Đường dẫn REST được chuẩn hoá trong `client/src/lib/api/uploadApi.ts` (adapter cho UI).
- [x] Bổ sung unit test cho DAO theo yêu cầu (Vitest test files trong `client/src/dao/__tests__`).

## Hướng dẫn migrate

1. Cập nhật script start để dùng thư mục mới `client/` và `server/src`.
2. Đảm bảo backend expose các endpoint `/api/uploads`, `/api/stories`, `/api/ocr` tương thích adapter mới.
3. Chạy `npm install` (hoặc tương đương) để cài `vitest` cho bộ test DAO.
4. Sử dụng `npm run test` trong thư mục `client` để kiểm tra các test DAO.

