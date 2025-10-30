import { StoryStatus, ContentType, Visibility } from './enums';

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
  progress?: number;
  content?: string;  // Extracted text content
  errorReason?: string;
  createdAt!: Date;
  updatedAt!: Date;

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
    if (typeof this.contentType === 'string') {
      this.contentType = this.contentType as ContentType;
    }
    if (typeof this.visibility === 'string') {
      this.visibility = this.visibility as Visibility;
    }
  }

  markCompleted(): void {
    this.status = StoryStatus.READY;
    this.progress = 100;
    this.errorReason = undefined;
  }

  markFailed(reason: string): void {
    this.status = StoryStatus.FAILED;
    this.errorReason = reason;
  }
}
