export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_user_details"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_history: {
        Row: {
          created_at: string
          id: string
          last_accessed_at: string
          last_position_seconds: number | null
          progress_percent: number | null
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_accessed_at?: string
          last_position_seconds?: number | null
          progress_percent?: number | null
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_accessed_at?: string
          last_position_seconds?: number | null
          progress_percent?: number | null
          story_id?: string
          user_id?: string
        }
      }
      stories: {
        Row: {
          audio_status: string | null
          audio_url: string | null
          author_id: string
          content: string
          content_type: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          file_path: string | null
          file_type: string | null
          id: string
          is_public: boolean | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          audio_status?: string | null
          audio_url?: string | null
          author_id: string
          content: string
          content_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_public?: boolean | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          audio_status?: string | null
          audio_url?: string | null
          author_id?: string
          content?: string
          content_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_public?: boolean | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
      }
    }
    Views: {
      admin_dashboard_stats: {
        Row: {
          new_stories_this_week: number | null
          new_users_this_week: number | null
          pending_reports: number | null
          total_comments: number | null
          total_draft_stories: number | null
          total_likes: number | null
          total_listens: number | null
          total_profiles: number | null
          total_published_stories: number | null
          total_rejected_stories: number | null
          total_story_views: number | null
          total_tags: number | null
          total_users: number | null
          total_views: number | null
        }
      }
      admin_story_details: {
        Row: {
          audio_status: string | null
          author_email: string | null
          author_id: string | null
          author_name: string | null
          bookmarks_count: number | null
          comments_count: number | null
          content_type: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_public: boolean | null
          likes_count: number | null
          listens_count: number | null
          status: string | null
          tags: Json | null
          title: string | null
          updated_at: string | null
          view_count: number | null
          views_count: number | null
        }
      }
      admin_user_details: {
        Row: {
          avatar_url: string | null
          bookmarks_count: number | null
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          id: string | null
          last_active_at: string | null
          last_sign_in_at: string | null
          likes_count: number | null
          role: Database["public"]["Enums"]["app_role"] | null
          stories_count: number | null
          total_bookmarks: number | null
          total_comments_made: number | null
          total_likes_given: number | null
          total_listening_time_seconds: number | null
          total_reading_time_seconds: number | null
          total_stories_created: number | null
          total_stories_listened: number | null
          total_stories_read: number | null
          user_created_at: string | null
        }
      }
      stories_with_stats: {
        Row: {
          audio_status: string | null
          audio_url: string | null
          author_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          file_path: string | null
          file_type: string | null
          id: string | null
          likes_count: number | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          view_count: number | null
          views_count: number | null
        }
      }
    }
    Functions: {
      admin_get_user_activity: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: Array<{
          activity_id: string
          activity_time: string
          activity_title: string
          activity_type: string
        }>
      }
      admin_update_story_status: {
        Args: { p_new_status: string; p_reason?: string; p_story_id: string }
        Returns: void
      }
      admin_update_user_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: void
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
