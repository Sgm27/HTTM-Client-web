import { TTSOption } from '@/dtos';

export type TTSEngine = {
  synthesize(text: string, opt?: TTSOption): Promise<{ url: string; fileId?: string }>;
};

export class TTSService {
  constructor(private readonly engine: TTSEngine) {}

  async generate(text: string, opt?: TTSOption): Promise<{ url: string; fileId?: string }> {
    return this.engine.synthesize(text, opt);
  }
}
