import { Comment } from './Comment';
import { ContentType, StoryStatus, Visibility } from './enums';

export class Story {
  id!: string;
  uploadId!: string;
  title!: string;
  content!: string;
  audioUrl?: string;
  audioStatus?: string | null;
  status!: StoryStatus;
  views!: number;
  createdAt!: Date;
  updatedAt!: Date;
  description?: string | null;
  contentType?: ContentType;
  visibility?: Visibility;
  authorId?: string;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  author?: {
    id?: string;
    name?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  };
  commentCount?: number;
  comments?: Comment[];

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
    if (typeof this.contentType === 'string') {
      this.contentType = this.contentType as ContentType;
    }
    if (typeof this.visibility === 'string') {
      this.visibility = this.visibility as Visibility;
    }
    this.views = typeof this.views === 'number' ? this.views : Number(this.views ?? 0);
    if (Array.isArray(init?.comments)) {
      this.comments = init.comments.map((comment) => new Comment(comment));
    }
    if (typeof this.commentCount !== 'number') {
      this.commentCount = this.comments?.length ?? 0;
    }
  }

  setFile(fileId: string): void {
    this.uploadId = fileId;
  }

  publish(): void {
    this.status = StoryStatus.PUBLISHED;
  }
}
