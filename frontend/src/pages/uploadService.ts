import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, Tables } from '@/integrations/supabase/types';

export interface SubmitUploadOptions {
  supabase: SupabaseClient<Database>;
  user: User;
  title: string;
  description: string;
  content: string;
  contentType: 'story' | 'news';
  isPublic: boolean;
  file: File | null;
  thumbnail: File | null;
}

export interface SubmitUploadResult {
  story: Tables<'stories'>;
  filePath: string | null;
  thumbnailUrl: string | null;
}

const FALLBACK_CONTENT = 'Nội dung sẽ được trích xuất từ file đã tải lên';

const getFileTypeCategory = (mimeType: string): 'text' | 'docx' | 'pdf' | 'image' => {
  if (mimeType === 'text/plain') return 'text';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'text';
};

const buildFileName = (userId: string, prefix: string, extension: string | undefined) => {
  const safeExt = extension?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  return `${userId}/${prefix}_${Date.now()}.${safeExt}`;
};

export const submitUpload = async ({
  supabase,
  user,
  title,
  description,
  content,
  contentType,
  isPublic,
  file,
  thumbnail,
}: SubmitUploadOptions): Promise<SubmitUploadResult> => {
  const client = supabase as any;
  let filePath: string | null = null;
  let fileType: string | null = null;
  let thumbnailUrl: string | null = null;

  // Upload main file if provided
  if (file) {
    const fileExt = file.name.split('.').pop();
    const fileName = buildFileName(user.id, 'file', fileExt);

    const { error: uploadError } = await client.storage
      .from('uploads')
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    filePath = fileName;
    fileType = file.type;

    if (!thumbnail && file.type.startsWith('image/')) {
      const { data: pub } = client.storage.from('uploads').getPublicUrl(fileName);
      thumbnailUrl = pub?.publicUrl ?? null;
    }
  }

  // Upload thumbnail if specified explicitly
  if (thumbnail) {
    const thumbExt = thumbnail.name.split('.').pop();
    const thumbName = buildFileName(user.id, 'thumb', thumbExt);
    const { error: thumbError } = await client.storage
      .from('uploads')
      .upload(thumbName, thumbnail);

    if (thumbError) {
      throw thumbError;
    }

    const { data: pub } = client.storage.from('uploads').getPublicUrl(thumbName);
    thumbnailUrl = pub?.publicUrl ?? thumbnailUrl;
  }

  const storyContent = content || FALLBACK_CONTENT;

  const { data: storyData, error: storyError } = await client
    .from('stories')
    .insert({
      title,
      description,
      content: storyContent,
      author_id: user.id,
      content_type: contentType,
      status: 'draft',
      is_public: isPublic,
      file_path: filePath,
      file_type: fileType,
      thumbnail_url: thumbnailUrl,
    })
    .select()
    .single();

  if (storyError || !storyData) {
    throw storyError ?? new Error('Không thể tạo truyện mới');
  }

  if (file && filePath) {
    const { error: fileError } = await client.from('files').insert({
      content_id: storyData.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: getFileTypeCategory(file.type),
      mime_type: file.type,
    });

    if (fileError) {
      console.warn('Error inserting file record:', fileError);
    }
  }

  const { error: extractedTextError } = await client.from('extracted_texts').insert({
    content_id: storyData.id,
    original_text: content,
    processing_status: file ? 'pending' : 'completed',
    extracted_text: file ? null : content,
  });

  if (extractedTextError) {
    console.warn('Error creating extracted text record:', extractedTextError);
  }

  const { error: uploadLogError } = await client.from('uploads').insert({
    story_id: storyData.id,
    user_id: user.id,
    original_file_path: filePath,
    original_mime: fileType,
    processing_status: file ? 'pending' : 'completed',
    extracted_text: file ? null : content,
  });

  if (uploadLogError) {
    console.warn('Error creating upload record:', uploadLogError);
  }

  return {
    story: storyData,
    filePath,
    thumbnailUrl,
  };
};
