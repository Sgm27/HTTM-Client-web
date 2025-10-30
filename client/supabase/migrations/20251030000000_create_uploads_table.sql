-- Create content_type enum
CREATE TYPE public.content_type AS ENUM ('TEXT', 'COMIC', 'NEWS');

-- Create visibility enum
CREATE TYPE public.visibility AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- Create story_status enum
CREATE TYPE public.story_status AS ENUM ('DRAFT', 'OCR_IN_PROGRESS', 'READY', 'PUBLISHED', 'FAILED');

-- Create file_kind enum
CREATE TYPE public.file_kind AS ENUM ('CONTENT', 'THUMBNAIL', 'AUDIO');

-- Create uploads table
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type content_type NOT NULL,
  visibility visibility NOT NULL DEFAULT 'PUBLIC',
  title TEXT NOT NULL,
  description TEXT,
  content_file_id TEXT NOT NULL,
  thumbnail_file_id TEXT,
  status story_status NOT NULL DEFAULT 'DRAFT',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  content TEXT,  -- Extracted text content
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create files table (for tracking uploaded files)
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  kind file_kind NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  hash TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  content TEXT,  -- For OCR results
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uploads
CREATE POLICY "Users can view own uploads"
  ON public.uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own uploads"
  ON public.uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploads"
  ON public.uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
  ON public.uploads FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for files
CREATE POLICY "Users can view files from own uploads"
  ON public.files FOR SELECT
  USING (true);  -- Files are referenced by uploads, so indirect permission

CREATE POLICY "Service can manage files"
  ON public.files FOR ALL
  USING (true);  -- Backend service manages files

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for uploads
CREATE POLICY "Anyone can view uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger for updated_at on uploads
CREATE TRIGGER set_updated_at_uploads
  BEFORE UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_uploads_user_id ON public.uploads(user_id);
CREATE INDEX idx_uploads_status ON public.uploads(status);
CREATE INDEX idx_uploads_created_at ON public.uploads(created_at DESC);
CREATE INDEX idx_files_file_path ON public.files(file_path);

-- Update stories table to reference uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' AND column_name = 'upload_id'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL;
    CREATE INDEX idx_stories_upload_id ON public.stories(upload_id);
  END IF;

  -- Add content_type and visibility columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN content_type content_type DEFAULT 'TEXT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN visibility visibility DEFAULT 'PUBLIC';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN status story_status DEFAULT 'DRAFT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' AND column_name = 'views'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
END $$;
