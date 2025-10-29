import { z } from 'zod';

export const ocrProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  text: z.string().optional(),
});

export type OCRProgress = z.infer<typeof ocrProgressSchema>;
