import { Story, Author, Tag } from './Story';

/**
 * Entity class đại diện cho thống kê cơ bản của một truyện
 */
export interface StoryStats {
  story_id: string;
  view_count: number;
  views_count: number;        // Số lượt xem từ bảng story_views
  likes_count: number;
  comments_count: number;
  listens_count: number;
  bookmarks_count: number;
}

/**
 * Entity class đại diện cho thống kê chi tiết đầy đủ của một truyện
 */
export interface StoryDetailStatistics {
  // Thông tin cơ bản của truyện
  story: Story;
  author: Author;
  
  // Thống kê tổng quan
  stats: {
    total_views: number;           // Tổng lượt xem từ view_count
    unique_views: number;          // Lượt xem độc lập từ story_views
    total_likes: number;
    total_comments: number;
    total_listens: number;
    total_bookmarks: number;
    total_listening_time: number;  // Tổng thời gian nghe (giây)
  };
  
  // Danh sách tags
  tags: Tag[];
  
  // Lịch sử xem gần đây
  recent_views: StoryView[];
  
  // Top người đọc
  top_readers: ReaderActivity[];
  
  // Thống kê theo thời gian
  views_by_date: ViewsByDate[];
}

/**
 * Entity class đại diện cho một lượt xem truyện
 */
export interface StoryView {
  id: string;
  user_id: string | null;
  story_id: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

/**
 * Entity class đại diện cho hoạt động của người đọc
 */
export interface ReaderActivity {
  user_id: string;
  user_name: string | null;
  user_email: string;
  total_views: number;
  total_reading_time: number;  // Giây
  last_accessed: string;
}

/**
 * Entity class đại diện cho thống kê xem theo ngày
 */
export interface ViewsByDate {
  date: string;
  views_count: number;
}

/**
 * Entity class đại diện cho bình luận
 */
export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string | null;
  user_email: string;
}

/**
 * Entity class đại diện cho lịch sử nghe
 */
export interface ListenHistory {
  id: string;
  user_id: string | null;
  story_id: string;
  listened_seconds: number;
  created_at: string;
  user_name?: string | null;
  user_email?: string;
}
