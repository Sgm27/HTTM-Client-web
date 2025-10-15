/**
 * Entity class đại diện cho một truyện trong hệ thống
 */
export interface Story {
  id: string;
  title: string;
  description: string | null;
  content: string;
  author_id: string;
  cover_image_url: string | null;
  file_path: string | null;
  file_type: string | null;
  audio_url: string | null;
  audio_status: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
  content_type: string | null;
  status: 'draft' | 'published' | 'rejected';
  is_public: boolean;
}

/**
 * Entity class đại diện cho thông tin tác giả
 */
export interface Author {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * Entity class đại diện cho thẻ tag
 */
export interface Tag {
  id: string;
  name: string;
  slug: string;
}
