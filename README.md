# HTTM Client Web

Ứng dụng web đồng bộ truyện/tin tức, xây dựng với Vite + React + TypeScript, Tailwind CSS và shadcn-ui. Tích hợp Supabase cho xác thực và dữ liệu.

Repository: `https://github.com/Sgm27/HTTM-Client-web`

## Yêu cầu hệ thống

- Node.js >= 18 (khuyến nghị quản lý qua nvm)
- npm hoặc pnpm/yarn

## Bắt đầu

```sh
git clone https://github.com/Sgm27/HTTM-Client-web.git
cd HTTM-Client-web
npm install
```

Tạo file `.env` (đã được ignore) trong thư mục gốc với nội dung tương tự:

```sh
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<your-anon-key>"
# Tuỳ chọn: chỉ dùng cho tác vụ CLI/migration, không commit
# SUPABASE_ACCESS_TOKEN="<personal-access-token>"
```

Chạy chế độ phát triển:

```sh
npm run dev
```

Build production và preview:

```sh
npm run build
npm run preview
```

Kiểm tra lint (nếu cần):

```sh
npm run lint
```

## Cấu trúc dự án

- `src/pages`: các trang như `Home`, `Auth`, `Account`, `Upload`, `StoryDetail`
- `src/components`: component dùng chung, `components/ui` từ shadcn-ui
- `src/integrations/supabase`: `client.ts` cấu hình Supabase, `types.ts` kiểu dữ liệu
- `supabase/migrations`: các migration theo dõi dưới dạng SQL
- `public`: tài nguyên tĩnh

## Công nghệ

- Vite, React, TypeScript
- Tailwind CSS, shadcn-ui
- Supabase (Auth, DB)

## Ghi chú bảo mật

- Không commit file `.env`. Các secret (ví dụ Supabase tokens) cần được lưu trữ an toàn và rotate khi cần.
- Nếu trước đây `.env` đã bị commit, hãy xoá khỏi lịch sử và thay thế secret trên Dashboard.

## Đóng góp

Pull Request luôn được hoan nghênh. Vui lòng tạo issue trước nếu thay đổi lớn.

## License

MIT
