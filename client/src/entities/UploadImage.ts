import { ProcessingStatus } from './enums';

export class UploadImage {
  id!: string;
  uploadId?: string;
  storyId?: string | null;
  publicUrl?: string | null;
  storagePath!: string;
  mimeType?: string | null;
  order?: number | null;
  status: ProcessingStatus = ProcessingStatus.PENDING;
  progress?: number | null;
  extractedText?: string | null;

  constructor(init?: Partial<UploadImage>) {
    Object.assign(this, init);
    if (typeof this.status === 'string') {
      this.status = this.status as ProcessingStatus;
    }
  }
}
