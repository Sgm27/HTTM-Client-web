import { z } from 'zod';
import { ProcessingStatus, StoryStatus } from '@/entities';
import { uploadImageSchema } from './upload';

export const ocrProgressSchema = z.object({
  status: z.nativeEnum(ProcessingStatus),
  storyStatus: z.nativeEnum(StoryStatus),
  progress: z.number().min(0).max(100),
  ocrText: z.string().nullable().optional(),
  extractedText: z.string().nullable().optional(),
  text: z.string().optional(),
  images: z.array(uploadImageSchema).optional(),
});

export type OCRProgress = z.infer<typeof ocrProgressSchema>;
