import { Upload, Story, ContentType, Visibility } from '@/entities';
import {
  createUploadResponseSchema,
  generateAudioResponseSchema,
  ocrProgressSchema,
  storySchema,
  ttsOptionSchema,
  type OCRProgress,
  type TTSOption,
} from '@/dtos';
import { z } from 'zod';

const API_BASE = '/api';

export type SubmitUploadParams = {
  userId: string;
  contentType: ContentType;
  visibility: Visibility;
  title: string;
  description?: string;
  contentFile: File;
  thumbnailFile?: File;
};

async function handleJsonResponse<T extends z.ZodTypeAny>(
  response: Response,
  schema: T,
): Promise<z.infer<T>> {
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const json = await response.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  return parsed.data;
}

export async function submitUpload(params: SubmitUploadParams): Promise<Upload> {
  const formData = new FormData();
  formData.append('userId', params.userId);
  formData.append('contentType', params.contentType);
  formData.append('visibility', params.visibility);
  formData.append('title', params.title);
  if (params.description) {
    formData.append('description', params.description);
  }
  formData.append('contentFile', params.contentFile);
  if (params.thumbnailFile) {
    formData.append('thumbnailFile', params.thumbnailFile);
  }

  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    body: formData,
  });

  const data = await handleJsonResponse(response, createUploadResponseSchema);

  return new Upload(data.upload);
}

export async function trackOcrProgress(fileId: string): Promise<OCRProgress> {
  const response = await fetch(`${API_BASE}/ocr/progress/${fileId}`);
  return handleJsonResponse(response, ocrProgressSchema);
}

export async function createStory(uploadId: string): Promise<Story> {
  const response = await fetch(`${API_BASE}/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadId }),
  });

  const data = await handleJsonResponse(response, storySchema);
  return new Story(data);
}

export async function getStory(id: string): Promise<Story> {
  const response = await fetch(`${API_BASE}/stories/${id}`);
  const data = await handleJsonResponse(response, storySchema);
  return new Story(data);
}

export async function generateStoryAudio(storyId: string, option?: TTSOption) {
  const payload = option ? ttsOptionSchema.parse(option) : undefined;

  const response = await fetch(`${API_BASE}/stories/${storyId}/generate-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });

  return handleJsonResponse(response, generateAudioResponseSchema);
}

export type AudioStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AudioStatusResponse {
  audioStatus: AudioStatus;
  audioUrl?: string;
}

const audioStatusResponseSchema = z.object({
  audioStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  audioUrl: z.string().optional().nullable(),
});

export async function getAudioStatus(storyId: string): Promise<AudioStatusResponse> {
  const response = await fetch(`${API_BASE}/stories/${storyId}/audio-status`);
  const data = await handleJsonResponse(response, audioStatusResponseSchema);
  return {
    audioStatus: data.audioStatus,
    audioUrl: data.audioUrl ?? undefined,
  };
}
