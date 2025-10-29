import { DAO } from './DAO';
import { ApiClient } from '@/lib/api/httpClient';
import { File, FileKind } from '@/entities';
import { fileSchema, ocrProgressSchema } from '@/dtos';

export interface SaveFileInput {
  kind: FileKind;
  filePath: string;
  mime: string;
  size: number;
  hash?: string;
}

export class FileDAO extends DAO<ApiClient> {
  constructor(con: ApiClient, private readonly ocrService?: { extractText(filePath: string): Promise<string> }) {
    super(con);
  }

  async saveFile(input: SaveFileInput): Promise<File> {
    const payload = await this.con.post('/files', input);
    const parsed = fileSchema.parse(payload);
    return new File(parsed);
  }

  async progressOCR(fileId: string): Promise<{ progress: number; text?: string }> {
    const payload = await this.con.get(`/ocr/progress/${fileId}`);
    const parsed = ocrProgressSchema.parse(payload);

    if (parsed.progress >= 100 && !parsed.text && this.ocrService) {
      const text = await this.ocrService.extractText(fileId);
      return { progress: 100, text };
    }

    return parsed;
  }
}
