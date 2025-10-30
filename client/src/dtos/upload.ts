import { z } from 'zod';
import { ContentType, Visibility, StoryStatus, FileKind } from '@/entities';

export const uploadRequestSchema = z.object({
  userId: z.string(),
  contentType: z.nativeEnum(ContentType),
  visibility: z.nativeEnum(Visibility),
  title: z.string().min(1),
  description: z.string().optional(),
  contentFileId: z.string(),
  thumbnailFileId: z.string().optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const uploadResponseSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(StoryStatus),
  progress: z.number().min(0).max(100).optional(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const uploadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contentType: z.nativeEnum(ContentType),
  visibility: z.nativeEnum(Visibility),
  title: z.string(),
  description: z.string().nullable().optional(),
  contentFileId: z.string(),
  thumbnailFileId: z.string().nullable().optional(),
  status: z.nativeEnum(StoryStatus),
  progress: z.number().min(0).max(100).nullable().optional(),
  content: z.string().nullable().optional(),  // Extracted text content
  errorReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UploadDTO = z.infer<typeof uploadSchema>;

export const fileSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  kind: z.nativeEnum(FileKind),
  mime: z.string(),
  size: z.number(),
  hash: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type FileDTO = z.infer<typeof fileSchema>;

export const createUploadResponseSchema = z.object({
  upload: uploadSchema,
  contentFile: fileSchema.optional(),
  thumbnailFile: fileSchema.optional(),
});

export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>;
