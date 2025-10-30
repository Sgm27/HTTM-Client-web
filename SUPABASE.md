# Supabase Schema

This document captures the current Supabase database structure for the project. All tables live in the `public` schema unless noted otherwise, and row level security (RLS) is enabled across the schema to control access through policies.

## Table Reference

### `public.profiles`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `profiles.id → auth.users.id`
- Stores additional profile metadata for authenticated users.

| Column      | Type                       | Nullable | Default | Notes    |
|-------------|----------------------------|----------|---------|----------|
| `created_at` | `timestamptz`              | no       | `now()` |          |
| `updated_at` | `timestamptz`              | no       | `now()` |          |
| `id`        | `uuid`                     | no       |         |          |
| `full_name` | `text`                     | yes      |         |          |
| `avatar_url` | `text`                    | yes      |         |          |

### `public.user_roles`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Unique Constraints**: `user_roles_user_id_key` (`user_id`)
- **Foreign Keys**:
  - `user_roles.user_id → auth.users.id`
- Maintains per-user authorization roles. Uses the enum type `app_role` (`admin`, `user`).

| Column       | Type           | Nullable | Default           | Notes                       |
|--------------|----------------|----------|-------------------|-----------------------------|
| `user_id`    | `uuid`         | no       |                   | unique                      |
| `role`       | `app_role` enum| no       |                   | values: `admin`, `user`     |
| `id`         | `uuid`         | no       | `gen_random_uuid()` |                             |
| `created_at` | `timestamptz`  | no       | `now()`           |                             |

### `public.stories`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `stories.author_id → auth.users.id`
  - `stories.upload_id → public.uploads.id`
  - Referenced by many child tables: `audios`, `content_reports`, `extracted_texts`, `files`, `reading_history`, `story_comments`, `story_likes`, `story_listens`, `story_tags`, `story_views`, `uploads`, `user_bookmarks`
- Represents published and draft stories, including text content, derived media, and publication status.

| Column           | Type        | Nullable | Default              | Notes                                                                                                                                      |
|------------------|-------------|----------|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `upload_id`       | `uuid`      | yes      |                       | links to originating upload                                                                                                                |
| `title`          | `text`      | no       |                       |                                                                                                                                            |
| `description`    | `text`      | yes      |                       |                                                                                                                                            |
| `content`        | `text`      | no       |                       | main story body                                                                                                                            |
| `author_id`      | `uuid`      | no       |                       |                                                                                                                                            |
| `cover_image_url`| `text`      | yes      |                       |                                                                                                                                            |
| `file_path`      | `text`      | yes      |                       |                                                                                                                                            |
| `file_type`      | `text`      | yes      |                       |                                                                                                                                            |
| `audio_url`      | `text`      | yes      |                       |                                                                                                                                            |
| `id`             | `uuid`      | no       | `gen_random_uuid()`   |                                                                                                                                            |
| `view_count`     | `int4`      | yes      | `0`                   |                                                                                                                                            |
| `created_at`     | `timestamptz` | no     | `now()`               |                                                                                                                                            |
| `updated_at`     | `timestamptz` | no     | `now()`               |                                                                                                                                            |
| `audio_status`   | `text`      | yes      | `'PENDING'::text`     | check: value must be one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`                                                                 |
| `thumbnail_url`  | `text`      | yes      |                       |                                                                                                                                            |
| `status`         | `text`      | yes      | `'DRAFT'::text`       | check: value must be one of `DRAFT`, `PUBLISHED`, `REJECTED`, `OCR_IN_PROGRESS`, `READY`, `FAILED`                                         |
| `is_public`      | `boolean`   | yes      | `true`                | controls visibility                                                                                                                        |
| `content_type`   | `text`      | yes      | `'TEXT'::text`        | check: value must be one of `TEXT`, `COMIC`, `NEWS`                                                                                        |

### `public.story_likes`

- **Row Level Security**: enabled
- **Primary Key**: composite (`user_id`, `story_id`)
- **Foreign Keys**:
  - `story_likes.user_id → auth.users.id`
  - `story_likes.story_id → public.stories.id`
- Join table tracking which users have liked which stories.

| Column       | Type          | Nullable | Default | Notes |
|--------------|---------------|----------|---------|-------|
| `user_id`    | `uuid`        | no       |         |       |
| `story_id`   | `uuid`        | no       |         |       |
| `created_at` | `timestamptz` | no       | `now()` |       |

### `public.story_views`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `story_views.user_id → auth.users.id`
  - `story_views.story_id → public.stories.id`
- Captures view events for stories, including optional viewer identity.

| Column       | Type          | Nullable | Default             | Notes |
|--------------|---------------|----------|---------------------|-------|
| `user_id`    | `uuid`        | yes      |                     |       |
| `story_id`   | `uuid`        | no       |                     |       |
| `id`         | `uuid`        | no       | `gen_random_uuid()` |       |
| `created_at` | `timestamptz` | no       | `now()`             |       |

### `public.story_listens`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `story_listens.user_id → auth.users.id`
  - `story_listens.story_id → public.stories.id`
- Tracks audio playback progress for stories with generated narration.

| Column            | Type          | Nullable | Default             | Notes |
|-------------------|---------------|----------|---------------------|-------|
| `user_id`         | `uuid`        | yes      |                     |       |
| `story_id`        | `uuid`        | no       |                     |       |
| `id`              | `uuid`        | no       | `gen_random_uuid()` |       |
| `listened_seconds`| `int4`        | yes      | `0`                 |       |
| `created_at`      | `timestamptz` | no       | `now()`             |       |

### `public.tags`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Unique Constraints**: `tags_name_key` (`name`), `tags_slug_key` (`slug`)
- **Foreign Keys**:
  - Referenced by `story_tags.tag_id`
- Controlled vocabulary for tagging stories.

| Column       | Type          | Nullable | Default             | Notes            |
|--------------|---------------|----------|---------------------|------------------|
| `name`       | `text`        | no       |                     | unique           |
| `slug`       | `text`        | no       |                     | unique           |
| `id`         | `uuid`        | no       | `gen_random_uuid()` |                  |
| `created_at` | `timestamptz` | no       | `now()`             |                  |

### `public.story_tags`

- **Row Level Security**: enabled
- **Primary Key**: none (acts as a pure join table)
- **Foreign Keys**:
  - `story_tags.story_id → public.stories.id`
  - `story_tags.tag_id → public.tags.id`
- Bridge table linking stories and tags with timestamped entries.

| Column       | Type          | Nullable | Default | Notes |
|--------------|---------------|----------|---------|-------|
| `story_id`   | `uuid`        | no       |         |       |
| `tag_id`     | `uuid`        | no       |         |       |
| `created_at` | `timestamptz` | no       | `now()` |       |

### `public.uploads`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `uploads.user_id → auth.users.id`
  - `uploads.story_id → public.stories.id`
  - Referenced by `stories.upload_id`
- Represents user-submitted content awaiting processing, OCR, and publishing flows.

| Column              | Type        | Nullable | Default               | Notes                                                                                                               |
|---------------------|-------------|----------|------------------------|---------------------------------------------------------------------------------------------------------------------|
| `title`             | `text`      | no       | `''::text`             |                                                                                                                     |
| `description`       | `text`      | yes      |                        |                                                                                                                     |
| `content_file_id`   | `text`      | yes      |                        | storage file identifier                                                                                             |
| `thumbnail_file_id` | `text`      | yes      |                        | storage file identifier                                                                                             |
| `progress`          | `int4`      | yes      | `0`                    | check: `progress >= 0 AND progress <= 100`                                                                          |
| `error_reason`      | `text`      | yes      |                        |                                                                                                                     |
| `content_type`      | `text`      | no       | `'TEXT'::text`         | check: value must be one of `TEXT`, `COMIC`, `NEWS`                                                                  |
| `visibility`        | `text`      | no       | `'PUBLIC'::text`       | check: value must be one of `PUBLIC`, `PRIVATE`, `UNLISTED`                                                         |
| `status`            | `text`      | no       | `'PENDING'::text`      | check: value must be one of `PENDING`, `OCR_IN_PROGRESS`, `READY`, `FAILED`                                         |
| `story_id`          | `uuid`      | yes      |                        |                                                                                                                     |
| `user_id`           | `uuid`      | no       |                        |                                                                                                                     |
| `original_file_path`| `text`      | yes      |                        |                                                                                                                     |
| `original_mime`     | `text`      | yes      |                        |                                                                                                                     |
| `extracted_text`    | `text`      | yes      |                        |                                                                                                                     |
| `ocr_text`          | `text`      | yes      |                        |                                                                                                                     |
| `processing_error`  | `text`      | yes      |                        |                                                                                                                     |
| `id`                | `uuid`      | no       | `gen_random_uuid()`    |                                                                                                                     |
| `created_at`        | `timestamptz` | no     | `now()`                |                                                                                                                     |
| `updated_at`        | `timestamptz` | no     | `now()`                |                                                                                                                     |
| `processing_status` | `text`      | no       | `'PENDING'::text`      | check: value must be one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`                                          |

### `public.reading_history`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `reading_history.user_id → auth.users.id`
  - `reading_history.story_id → public.stories.id`
- Tracks per-user reading progress for each story.

| Column                 | Type          | Nullable | Default             | Notes |
|------------------------|---------------|----------|---------------------|-------|
| `user_id`              | `uuid`        | no       |                     |       |
| `story_id`             | `uuid`        | no       |                     |       |
| `id`                   | `uuid`        | no       | `gen_random_uuid()` |       |
| `last_position_seconds`| `int4`        | yes      | `0`                 |       |
| `progress_percent`     | `numeric`     | yes      | `0`                 |       |
| `last_accessed_at`     | `timestamptz` | no       | `now()`             |       |
| `created_at`           | `timestamptz` | no       | `now()`             |       |

### `public.user_bookmarks`

- **Row Level Security**: enabled
- **Primary Key**: composite (`user_id`, `story_id`)
- **Foreign Keys**:
  - `user_bookmarks.user_id → auth.users.id`
  - `user_bookmarks.story_id → public.stories.id`
- Join table capturing bookmarked stories per user.

| Column       | Type          | Nullable | Default | Notes |
|--------------|---------------|----------|---------|-------|
| `user_id`    | `uuid`        | no       |         |       |
| `story_id`   | `uuid`        | no       |         |       |
| `created_at` | `timestamptz` | no       | `now()` |       |

### `public.story_comments`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `story_comments.user_id → auth.users.id`
  - `story_comments.story_id → public.stories.id`
- Stores user-generated comments on stories.

| Column       | Type          | Nullable | Default             | Notes |
|--------------|---------------|----------|---------------------|-------|
| `story_id`   | `uuid`        | no       |                     |       |
| `user_id`    | `uuid`        | no       |                     |       |
| `content`    | `text`        | no       |                     |       |
| `id`         | `uuid`        | no       | `gen_random_uuid()` |       |
| `created_at` | `timestamptz` | no       | `now()`             |       |

### `public.files`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `files.content_id → public.stories.id`
- Mirrors file objects stored in Supabase Storage that are associated with stories.

| Column      | Type          | Nullable | Default             | Notes                                                            |
|-------------|---------------|----------|---------------------|------------------------------------------------------------------|
| `content_id`| `uuid`        | yes      |                     |                                                                  |
| `file_path` | `text`        | no       |                     | storage path                                                     |
| `file_name` | `text`        | no       |                     |                                                                  |
| `file_size` | `int8`        | yes      |                     | size in bytes                                                    |
| `mime_type` | `text`        | no       |                     |                                                                  |
| `file_type` | `text`        | no       |                     | check: value must be one of `text`, `docx`, `pdf`, `image`       |
| `id`        | `uuid`        | no       | `gen_random_uuid()` |                                                                  |
| `created_at`| `timestamptz` | yes      | `now()`             |                                                                  |
| `updated_at`| `timestamptz` | yes      | `now()`             |                                                                  |

### `public.extracted_texts`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Unique Constraints**: `extracted_texts_content_id_key` (`content_id`)
- **Foreign Keys**:
  - `extracted_texts.content_id → public.stories.id`
- Stores OCR and text extraction results for stories, along with processing metadata.

| Column             | Type          | Nullable | Default             | Notes                                                                                   |
|--------------------|---------------|----------|---------------------|-----------------------------------------------------------------------------------------|
| `processing_status`| `text`        | yes      | `'PENDING'::text`   | check: value must be one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`              |
| `content_id`       | `uuid`        | yes      |                     | unique                                                                                  |
| `original_text`    | `text`        | yes      |                     |                                                                                         |
| `extracted_text`   | `text`        | yes      |                     |                                                                                         |
| `processing_logs`  | `jsonb`       | yes      |                     | diagnostic details                                                                      |
| `id`               | `uuid`        | no       | `gen_random_uuid()` |                                                                                         |
| `created_at`       | `timestamptz` | yes      | `now()`             |                                                                                         |
| `updated_at`       | `timestamptz` | yes      | `now()`             |                                                                                         |

### `public.audios`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `audios.content_id → public.stories.id`
- Holds metadata for generated narration audio files.

| Column             | Type          | Nullable | Default             | Notes                                                                                   |
|--------------------|---------------|----------|---------------------|-----------------------------------------------------------------------------------------|
| `content_id`       | `uuid`        | yes      |                     |                                                                                         |
| `audio_url`        | `text`        | no       |                     | storage path or public URL                                                              |
| `audio_duration`   | `int4`        | yes      |                     | duration in seconds                                                                     |
| `id`               | `uuid`        | no       | `gen_random_uuid()` |                                                                                         |
| `audio_format`     | `text`        | yes      | `'mp3'::text`       |                                                                                         |
| `created_at`       | `timestamptz` | yes      | `now()`             |                                                                                         |
| `updated_at`       | `timestamptz` | yes      | `now()`             |                                                                                         |
| `generation_status`| `text`        | yes      | `'PENDING'::text`   | check: value must be one of `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`              |

### `public.admin_logs`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `admin_logs.admin_id → auth.users.id`
- Records administrative actions for auditing.

| Column      | Type          | Nullable | Default             | Notes              |
|-------------|---------------|----------|---------------------|--------------------|
| `admin_id`  | `uuid`        | yes      |                     |                    |
| `action`    | `text`        | no       |                     |                    |
| `target_type`| `text`       | yes      |                     |                    |
| `target_id` | `uuid`        | yes      |                     |                    |
| `details`   | `jsonb`       | yes      |                     | structured context |
| `ip_address`| `text`        | yes      |                     |                    |
| `id`        | `uuid`        | no       | `gen_random_uuid()` |                    |
| `created_at`| `timestamptz` | yes      | `now()`             |                    |

### `public.system_stats`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Unique Constraints**: `system_stats_stat_type_key` (`stat_type`)
- Aggregated statistics or counters used by the system.

| Column      | Type          | Nullable | Default             | Notes                      |
|-------------|---------------|----------|---------------------|----------------------------|
| `stat_type` | `text`        | no       |                     | unique identifier          |
| `stat_value`| `jsonb`       | no       |                     | structured metric payload  |
| `id`        | `uuid`        | no       | `gen_random_uuid()` |                            |
| `updated_at`| `timestamptz` | yes      | `now()`             |                            |

### `public.content_reports`

- **Row Level Security**: enabled
- **Primary Key**: `id`
- **Foreign Keys**:
  - `content_reports.reporter_id → auth.users.id`
  - `content_reports.reviewed_by → auth.users.id`
- Manages moderation reports submitted by users and their resolution state.

| Column         | Type          | Nullable | Default             | Notes                                                                                   |
|----------------|---------------|----------|---------------------|-----------------------------------------------------------------------------------------|
| `reporter_id`  | `uuid`        | yes      |                     |                                                                                         |
| `content_type` | `text`        | no       |                     | check: value must be one of `STORY`, `COMMENT`                                          |
| `content_id`   | `uuid`        | no       |                     |                                                                                         |
| `reason`       | `text`        | no       |                     |                                                                                         |
| `description`  | `text`        | yes      |                     |                                                                                         |
| `reviewed_by`  | `uuid`        | yes      |                     |                                                                                         |
| `reviewed_at`  | `timestamptz` | yes      |                     |                                                                                         |
| `resolution_note` | `text`     | yes      |                     |                                                                                         |
| `id`           | `uuid`        | no       | `gen_random_uuid()` |                                                                                         |
| `created_at`   | `timestamptz` | yes      | `now()`             |                                                                                         |
| `status`       | `text`        | yes      | `'PENDING'::text`   | check: value must be one of `PENDING`, `REVIEWING`, `RESOLVED`, `REJECTED`               |

### `public.user_activity_summary`

- **Row Level Security**: enabled
- **Primary Key**: `user_id`
- **Foreign Keys**:
  - `user_activity_summary.user_id → auth.users.id`
- Denormalized counters summarizing each user's activity across the platform.

| Column                      | Type          | Nullable | Default             | Notes |
|-----------------------------|---------------|----------|---------------------|-------|
| `user_id`                   | `uuid`        | no       |                     |       |
| `last_active_at`            | `timestamptz` | yes      |                     |       |
| `total_stories_created`     | `int4`        | yes      | `0`                 |       |
| `total_stories_read`        | `int4`        | yes      | `0`                 |       |
| `total_stories_listened`    | `int4`        | yes      | `0`                 |       |
| `total_likes_given`         | `int4`        | yes      | `0`                 |       |
| `total_comments_made`       | `int4`        | yes      | `0`                 |       |
| `total_bookmarks`           | `int4`        | yes      | `0`                 |       |
| `total_reading_time_seconds`| `int8`        | yes      | `0`                 |       |
| `total_listening_time_seconds`| `int8`     | yes      | `0`                 |       |
| `created_at`                | `timestamptz` | yes      | `now()`             |       |
| `updated_at`                | `timestamptz` | yes      | `now()`             |       |

---

_Generated from the Supabase project metadata available at the time of writing. Re-run the Supabase MCP schema inspection tools after future migrations to keep this document up to date._
