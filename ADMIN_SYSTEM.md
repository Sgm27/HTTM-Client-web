# Hệ Thống Quản Trị Admin - HTTM

## Tổng Quan

Hệ thống quản trị admin hoàn chỉnh đã được triển khai với đầy đủ tính năng quản lý người dùng, nội dung, phân tích và cài đặt hệ thống.

## 🗄️ Database Schema

### Bảng Mới Đã Tạo

1. **admin_logs** - Lưu trữ lịch sử hoạt động của admin
   - Theo dõi mọi hành động: thay đổi role, duyệt nội dung, cài đặt hệ thống
   - Bao gồm: action, target_type, target_id, details (JSON), ip_address

2. **system_stats** - Lưu trữ thống kê hệ thống được cache
   - Tối ưu hiệu suất khi truy vấn thống kê lớn
   - stat_type: 'daily_users', 'daily_views', 'total_stories', etc.
   - stat_value: JSON với dữ liệu chi tiết

3. **content_reports** - Quản lý báo cáo vi phạm từ users
   - reporter_id, content_type, content_id, reason, description
   - status: 'pending', 'reviewing', 'resolved', 'rejected'
   - reviewed_by, reviewed_at, resolution_note

4. **user_activity_summary** - Tóm tắt hoạt động của user
   - total_stories_created, total_stories_read, total_stories_listened
   - total_likes_given, total_comments_made, total_bookmarks
   - total_reading_time_seconds, total_listening_time_seconds
   - last_active_at

### Database Views

1. **admin_dashboard_stats** - Thống kê tổng quan cho dashboard
   - Tổng users, stories (published/draft/rejected)
   - Tổng views, likes, listens, comments, tags
   - Pending reports, new users/stories this week

2. **admin_user_details** - Chi tiết users với hoạt động
   - Thông tin user từ auth.users + profiles
   - Role, activity summary, stories count, likes count, bookmarks count

3. **admin_story_details** - Chi tiết stories với statistics
   - Thông tin story với author details
   - Counts: likes, views, listens, comments, bookmarks
   - Tags (JSON array)

### Database Functions

1. **is_admin(user_id)** - Kiểm tra user có phải admin không
2. **log_admin_action(...)** - Ghi log hành động admin
3. **admin_update_user_role(user_id, new_role)** - Thay đổi role user
4. **admin_update_story_status(story_id, new_status, reason)** - Thay đổi status story
5. **admin_get_user_activity(user_id, limit)** - Lấy timeline hoạt động của user

### Row Level Security (RLS)

Tất cả bảng đều có RLS enabled với policies:
- **admin_logs**: Chỉ admin mới xem được
- **system_stats**: Chỉ admin mới xem và cập nhật
- **content_reports**: User xem report của mình, admin xem tất cả
- **user_activity_summary**: User xem của mình, admin xem tất cả

## 🎨 Frontend Components

### Admin Layout
- **AdminLayout.tsx** - Sidebar navigation, user profile, sign out
- Protected routes - Chỉ admin mới truy cập được
- Auto redirect - User thường không thể vào admin panel

### Admin Pages

#### 1. Dashboard (`/admin`)
- Tổng quan hệ thống với 8 stat cards
- Content status breakdown
- Quick stats (new users, new stories trong 7 ngày)
- Pending reports alert

#### 2. User Management (`/admin/users`)
- Danh sách tất cả users với search
- Thông tin: email, full name, role, stories count
- Xem joined date và last sign in
- **Tính năng**:
  - Change user role (admin/user)
  - View user details
  - Search by email or name

#### 3. Content Management (`/admin/content`)
- Danh sách tất cả stories với statistics
- Filter by status: all, published, draft, rejected
- Xem views, likes, comments của mỗi story
- **Tính năng**:
  - Approve stories (change to published)
  - Reject stories with reason
  - Change story status
  - Search by title or author

#### 4. Analytics (`/admin/analytics`)
- Top 10 stories by views
- Content breakdown chart
- Engagement metrics (likes, comments, listens)
- Weekly growth statistics

#### 5. Settings (`/admin/settings`)
- **Tag Management**: Create, delete tags
- **Admin Activity Logs**: Xem lịch sử 20 actions gần nhất
- **System Information**: Database version, platform status

## 🚀 Sử Dụng

### Truy Cập Admin Panel

1. **Login với tài khoản admin**
   - Đảm bảo user có role = 'admin' trong bảng `user_roles`

2. **Auto Redirect**
   - Khi admin login và vào trang chủ `/`, hệ thống tự động redirect đến `/admin`
   - User thường vẫn thấy trang chủ bình thường

3. **Navigation**
   - Sidebar bên trái với các menu items
   - Click vào mỗi item để đi đến trang tương ứng

### Workflow Quản Lý

#### Quản Lý User
```
1. Vào /admin/users
2. Search user cần thay đổi role
3. Click icon UserCog
4. Chọn role mới (admin/user)
5. Click Update Role
```

#### Duyệt Content
```
1. Vào /admin/content
2. Filter by status: draft hoặc all
3. Review story cần duyệt
4. Click "Approve" để publish
5. Click "Reject" nếu vi phạm (kèm lý do)
```

#### Quản Lý Tags
```
1. Vào /admin/settings
2. Nhập tên tag mới
3. Click "Add Tag"
4. Click icon Trash2 để xóa tag không cần
```

## 🔒 Bảo Mật

### Database Level
- **RLS Policies**: Chỉ admin mới truy cập được admin tables/views
- **SECURITY DEFINER**: Functions có kiểm tra role trước khi thực thi
- **Foreign Keys**: Đảm bảo tính toàn vẹn dữ liệu

### Application Level
- **useUserRole Hook**: Kiểm tra role real-time
- **Protected Routes**: AdminLayout check role trước khi render
- **Auto Redirect**: Non-admin không thể access admin routes

### Audit Trail
- **admin_logs**: Mọi hành động đều được log
- Bao gồm: admin_id, action, target, details, timestamp
- Có thể truy vết lại toàn bộ thay đổi

## 📊 Database & Frontend Đồng Bộ 100%

### Type Safety
- TypeScript types được generate từ database schema
- Mọi table, view, function đều có type definition
- Auto-complete và type checking khi dev

### Real-time Updates
- Sử dụng Supabase client để fetch real-time data
- Mọi thay đổi trong database reflect ngay lên UI
- Không có data mismatch

### Validation
- Database constraints (CHECK, UNIQUE, FOREIGN KEY)
- Frontend validation (required fields, formats)
- Error handling ở cả 2 layers

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui (Radix UI)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **Routing**: React Router v6
- **State**: React hooks
- **Icons**: Lucide React

## 📝 Migration Files

Tất cả migrations đã được apply qua MCP Supabase:
1. `create_admin_logs_and_settings` - Tables, indexes, RLS policies
2. `create_admin_functions_and_views` - Functions, views, helper functions

## ✅ Checklist Hoàn Thành

- [x] Tạo 4 bảng mới: admin_logs, system_stats, content_reports, user_activity_summary
- [x] Tạo 3 views: admin_dashboard_stats, admin_user_details, admin_story_details
- [x] Tạo 5 functions: is_admin, log_admin_action, admin_update_user_role, admin_update_story_status, admin_get_user_activity
- [x] Thiết lập RLS policies cho tất cả admin tables
- [x] Tạo AdminLayout với sidebar navigation
- [x] Tạo 5 admin pages: Dashboard, Users, Content, Analytics, Settings
- [x] Setup protected routes trong App.tsx
- [x] Auto redirect admin từ homepage
- [x] TypeScript types đồng bộ với database
- [x] Toast notifications cho user feedback
- [x] Search và filter functionality
- [x] Dialog modals cho actions
- [x] Error handling và loading states

## 🎯 Tính Năng Nổi Bật

1. **Dashboard Realtime** - Statistics cập nhật realtime
2. **Role Management** - Thay đổi role user dễ dàng
3. **Content Moderation** - Approve/Reject stories với lý do
4. **Activity Tracking** - Xem timeline hoạt động của user
5. **Tag System** - Quản lý tags động
6. **Admin Logs** - Audit trail đầy đủ
7. **Search & Filter** - Tìm kiếm nhanh
8. **Responsive Design** - Mobile-friendly

## 🔮 Mở Rộng Trong Tương Lai

- Export analytics data to CSV/Excel
- Email notifications cho admin
- Bulk actions (select multiple users/stories)
- Advanced filters (date range, multiple criteria)
- User suspension/ban system
- Content scheduling
- Report management system
- Charts và graphs cho analytics
- Real-time notifications với Supabase Realtime

---

**Lưu Ý**: Hệ thống admin đã được đồng bộ 100% giữa database và frontend. Mọi thay đổi schema cần regenerate TypeScript types để đảm bảo type safety.
