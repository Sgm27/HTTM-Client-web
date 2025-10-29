import { StoryStatus } from './enums';

export class Story {
  id!: string;
  uploadId!: string;
  title!: string;
  content!: string;
  audioUrl?: string;
  status!: StoryStatus;
  views!: number;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(init?: Partial<Story>) {
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
  }

  setFile(fileId: string): void {
    this.uploadId = fileId;
  }

  publish(): void {
    this.status = StoryStatus.PUBLISHED;
  }
}
