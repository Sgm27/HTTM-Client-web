# Module Thống Kê Truyện (Story Statistics Module)

## Tổng quan

Module này cung cấp chức năng thống kê và phân tích chi tiết cho các truyện trong hệ thống admin. Module được thiết kế theo kiến trúc 3 lớp (3-layer architecture) để đảm bảo tính module hóa và dễ bảo trì.

## Kiến trúc 3 lớp

### 1. Presentation Layer (Lớp Giao diện)
Các component React TSX hiển thị UI và xử lý tương tác người dùng.

**Files:**
- `src/pages/admin/StoryStats.tsx` - Trang danh sách truyện theo lượt xem
- `src/pages/admin/StoryStatsDetail.tsx` - Trang chi tiết thống kê của một truyện

**Chức năng:**
- Hiển thị danh sách truyện sắp xếp theo lượt xem
- Tìm kiếm truyện theo tên
- Click vào truyện để xem chi tiết thống kê
- Hiển thị 4 tabs thống kê: Lịch sử xem, Top người đọc, Biểu đồ theo ngày, Lịch sử nghe

### 2. DAO Layer (Lớp Truy cập Dữ liệu)
Lớp chịu trách nhiệm tương tác với database và xử lý business logic.

**Files:**
- `src/dao/StoryStatsDAO.ts` - Data Access Object cho thống kê truyện

**Các phương thức chính:**
```typescript
// Lấy danh sách truyện với thống kê cơ bản
static async getStoriesWithStats(limit: number): Promise<Result>

// Lấy top truyện có nhiều lượt xem nhất
static async getTopStoriesByViews(limit: number): Promise<Result>

// Lấy thống kê chi tiết đầy đủ của một truyện
static async getStoryDetailStats(storyId: string): Promise<Result>

// Lấy danh sách bình luận của truyện
static async getStoryComments(storyId: string, limit: number): Promise<Result>

// Lấy lịch sử nghe của truyện
static async getStoryListenHistory(storyId: string, limit: number): Promise<Result>

// Tìm kiếm truyện theo tiêu đề
static async searchStoriesByTitle(searchTerm: string, limit: number): Promise<Result>
```

### 3. Entity Layer (Lớp Thực thể)
Các interface TypeScript định nghĩa cấu trúc dữ liệu.

**Files:**
- `src/types/entities/Story.ts` - Entity cho Story, Author, Tag
- `src/types/entities/StoryStatistics.ts` - Entity cho các loại thống kê

**Các Entity chính:**
- `Story` - Thông tin cơ bản của truyện
- `Author` - Thông tin tác giả
- `Tag` - Thẻ phân loại
- `StoryStats` - Thống kê cơ bản
- `StoryDetailStatistics` - Thống kê chi tiết đầy đủ
- `StoryView` - Lượt xem
- `ReaderActivity` - Hoạt động người đọc
- `ViewsByDate` - Thống kê theo ngày
- `Comment` - Bình luận
- `ListenHistory` - Lịch sử nghe

## Luồng dữ liệu

```
User Interaction (UI)
      ↓
Presentation Layer (React Components)
      ↓
DAO Layer (StoryStatsDAO)
      ↓
Supabase Database (PostgreSQL)
      ↓
Entity Objects
      ↓
UI Rendering
```

## Database Schema

Module sử dụng các bảng và view sau trong Supabase:

**Tables:**
- `stories` - Bảng chính lưu truyện
- `story_views` - Lịch sử xem
- `story_likes` - Lượt thích
- `story_comments` - Bình luận
- `story_listens` - Lượt nghe
- `user_bookmarks` - Bookmark
- `reading_history` - Lịch sử đọc
- `profiles` - Thông tin người dùng
- `tags`, `story_tags` - Thẻ phân loại

**Views:**
- `admin_story_details` - View tổng hợp thống kê chi tiết của truyện

## Tính năng chi tiết

### Trang Thống kê Truyện (StoryStats)
1. **Hiển thị tổng quan:**
   - Tổng số truyện
   - Tổng lượt xem
   - Tổng lượt thích
   - Tổng bình luận

2. **Danh sách truyện:**
   - Sắp xếp theo lượt xem (cao đến thấp)
   - Hiển thị badge trạng thái (Published/Draft/Rejected)
   - Hiển thị thống kê inline: Views, Likes, Comments, Listens, Bookmarks
   - Click vào truyện để xem chi tiết

3. **Tìm kiếm:**
   - Tìm kiếm theo tên truyện
   - Nút tải lại dữ liệu

### Trang Chi tiết Thống kê (StoryStatsDetail)
1. **Thông tin truyện:**
   - Ảnh bìa, tiêu đề, mô tả
   - Tác giả, ngày tạo
   - Trạng thái xuất bản

2. **Thống kê tổng quan:**
   - Tổng lượt xem & lượt xem độc lập
   - Lượt thích
   - Bình luận
   - Lượt nghe
   - Bookmark
   - Tổng thời gian nghe (giờ)

3. **Thẻ tags:**
   - Hiển thị tất cả tags của truyện

4. **Tab Lịch sử xem:**
   - 20 lượt xem gần nhất
   - Thông tin người xem và thời gian

5. **Tab Top người đọc:**
   - Top 10 người đọc nhiều nhất
   - Hiển thị thời gian đọc và số lần xem

6. **Tab Biểu đồ theo ngày:**
   - Thống kê xem theo ngày (7 ngày gần nhất)
   - Progress bar trực quan

7. **Tab Lịch sử nghe:**
   - Danh sách lượt nghe gần đây
   - Thời gian nghe của từng người

## Routing

```typescript
// Trong App.tsx
<Route path="/admin/story-stats" element={<StoryStats />} />
<Route path="/admin/story-stats/:id" element={<StoryStatsDetail />} />
```

## Menu Admin

Module được thêm vào menu sidebar của AdminLayout:
- Icon: TrendingUp
- Label: "Thống kê truyện"
- Path: `/admin/story-stats`

## Sử dụng

### Truy cập module
1. Đăng nhập với tài khoản admin
2. Click vào menu "Thống kê truyện" trên sidebar
3. Xem danh sách truyện và thống kê tổng quan
4. Click vào bất kỳ truyện nào để xem chi tiết

### Tìm kiếm truyện
1. Nhập tên truyện vào ô tìm kiếm
2. Nhấn Enter hoặc click nút "Tìm kiếm"
3. Kết quả sẽ được lọc theo từ khóa

### Xem chi tiết thống kê
1. Click vào một truyện trong danh sách
2. Xem các thống kê tổng quan phía trên
3. Chuyển giữa các tab để xem thống kê chi tiết
4. Click "Quay lại" để về danh sách

## Biểu đồ UML

Xem file `StoryStatsModule.puml` để xem biểu đồ kiến trúc chi tiết dạng PlantUML.

Để render biểu đồ, bạn có thể:
- Sử dụng PlantUML online: http://www.plantuml.com/plantuml/
- Cài extension PlantUML cho VS Code
- Sử dụng công cụ PlantUML local

## Technology Stack

- **React** - UI Framework
- **TypeScript** - Type safety
- **React Router** - Navigation
- **Supabase** - Database & Backend
- **shadcn/ui** - UI Components
- **Lucide Icons** - Icon library
- **Tailwind CSS** - Styling

## Cải tiến trong tương lai

1. **Charts nâng cao:**
   - Thêm chart libraries (Recharts, Chart.js)
   - Biểu đồ line, bar, pie cho nhiều metrics

2. **Export data:**
   - Xuất thống kê ra Excel/CSV
   - Tạo PDF reports

3. **Filters nâng cao:**
   - Filter theo ngày, tháng, năm
   - Filter theo trạng thái, tags
   - Filter theo khoảng lượt xem

4. **Real-time updates:**
   - WebSocket cho cập nhật real-time
   - Auto-refresh statistics

5. **Comparison:**
   - So sánh thống kê giữa các truyện
   - Benchmarking

## Ghi chú

- Module này yêu cầu quyền admin để truy cập
- Dữ liệu được cache và có thể cần refresh để cập nhật
- Performance đã được tối ưu với limit queries
- Hỗ trợ responsive design cho mobile

## Tác giả

Được thiết kế và triển khai cho HTTM-Client-Web Admin System.
