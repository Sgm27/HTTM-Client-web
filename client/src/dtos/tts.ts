import { z } from 'zod';

export const ttsOptionSchema = z.object({
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2).optional(),
  format: z.enum(['mp3', 'wav']).optional(),
});

export type TTSOption = z.infer<typeof ttsOptionSchema>;
