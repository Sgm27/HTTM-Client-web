import { z } from 'zod';
import { StoryStatus, ContentType, Visibility } from '@/entities';
import { ttsOptionSchema } from './tts';
import { uploadImageSchema } from './upload';

export const createStoryRequestSchema = z.object({
  uploadId: z.string(),
});

export type CreateStoryRequest = z.infer<typeof createStoryRequestSchema>;

const storyCommentAuthorSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

export const storyCommentSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  userId: z.string(),
  text: z.string(),
  createdAt: z.string(),
  author: storyCommentAuthorSchema.optional(),
});

export const storySchema = z.object({
  id: z.string(),
  uploadId: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  content: z.string(),
  audioUrl: z.string().url().optional().nullable(),
  audioStatus: z.string().optional().nullable(),
  status: z.nativeEnum(StoryStatus),
  views: z.union([z.number(), z.null()]).transform((value) => value ?? 0),
  createdAt: z.string(),
  updatedAt: z.string(),
  contentType: z.nativeEnum(ContentType).optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  authorId: z.string().optional(),
  coverImageUrl: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  author: storyCommentAuthorSchema.optional(),
  commentCount: z.number().default(0),
  comments: z.array(storyCommentSchema).default([]),
  images: z.array(uploadImageSchema).optional(),
});

export type StoryDTO = z.infer<typeof storySchema>;

export const generateAudioResponseSchema = z.object({
  audioUrl: z.string().url(),
});

export type GenerateAudioResponse = z.infer<typeof generateAudioResponseSchema>;

export const generateAudioRequestSchema = ttsOptionSchema.optional();
