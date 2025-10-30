import { z } from 'zod';
import { StoryStatus, ContentType, Visibility } from '@/entities';
import { ttsOptionSchema } from './tts';

export const createStoryRequestSchema = z.object({
  uploadId: z.string(),
});

export type CreateStoryRequest = z.infer<typeof createStoryRequestSchema>;

export const storySchema = z.object({
  id: z.string(),
  uploadId: z.string(),
  title: z.string(),
  content: z.string(),
  audioUrl: z.string().url().optional().nullable(),
  audioStatus: z.string().optional().nullable(),
  status: z.nativeEnum(StoryStatus),
  views: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  contentType: z.nativeEnum(ContentType).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
});

export type StoryDTO = z.infer<typeof storySchema>;

export const generateAudioResponseSchema = z.object({
  audioUrl: z.string().url(),
});

export type GenerateAudioResponse = z.infer<typeof generateAudioResponseSchema>;

export const generateAudioRequestSchema = ttsOptionSchema.optional();
