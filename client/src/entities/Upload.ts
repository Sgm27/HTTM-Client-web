import { StoryStatus, ContentType, Visibility, ProcessingStatus } from './enums';
import { UploadImage } from './UploadImage';

export class Upload {
  id!: string;
  userId!: string;
  contentType!: ContentType;
  visibility!: Visibility;
  title!: string;
  description?: string;
  contentFileId!: string;
  thumbnailFileId?: string;
  contentUrl?: string | null;
  thumbnailUrl?: string | null;
  status!: StoryStatus;
  processingStatus!: ProcessingStatus;
  progress?: number;
  content?: string;  // Extracted text content
  ocrText?: string | null;
  errorReason?: string;
  createdAt!: Date;
  updatedAt!: Date;
  images?: UploadImage[];

  constructor(init?: Partial<Upload>) {
    Object.assign(this, init);
    if (typeof this.createdAt === 'string') {
      this.createdAt = new Date(this.createdAt);
    }
    if (typeof this.updatedAt === 'string') {
      this.updatedAt = new Date(this.updatedAt);
    }
    if (typeof this.status === 'string') {
      this.status = this.status as StoryStatus;
    }
    if (typeof this.processingStatus === 'string') {
      this.processingStatus = this.processingStatus as ProcessingStatus;
    }
    if (!this.processingStatus) {
      this.processingStatus = ProcessingStatus.PENDING;
    }
    if (typeof this.contentType === 'string') {
      this.contentType = this.contentType as ContentType;
    }
    if (typeof this.visibility === 'string') {
      this.visibility = this.visibility as Visibility;
    }
    if (Array.isArray(init?.images)) {
      this.images = init.images.map((image) => new UploadImage(image));
    }
  }

  markCompleted(): void {
    this.status = StoryStatus.READY;
    this.progress = 100;
    this.errorReason = undefined;
    this.processingStatus = ProcessingStatus.COMPLETED;
  }

  markFailed(reason: string): void {
    this.status = StoryStatus.FAILED;
    this.errorReason = reason;
    this.processingStatus = ProcessingStatus.FAILED;
  }
}
