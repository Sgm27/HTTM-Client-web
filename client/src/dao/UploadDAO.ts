import { DAO } from './DAO';
import { ApiClient } from '@/lib/api/httpClient';
import { ContentType, Visibility, Upload, StoryStatus } from '@/entities';
import {
  createUploadResponseSchema,
  UploadDTO,
  uploadSchema,
} from '@/dtos';

export interface CreateUploadInput {
  userId: string;
  contentType: ContentType;
  visibility: Visibility;
  title: string;
  description?: string;
  contentFiles: File[];
  thumbnailFile?: File;
}

export class UploadDAO extends DAO<ApiClient> {
  async create(input: CreateUploadInput): Promise<Upload> {
    const form = new FormData();
    form.append('userId', input.userId);
    form.append('contentType', input.contentType);
    form.append('visibility', input.visibility);
    form.append('title', input.title);
    if (input.description) {
      form.append('description', input.description);
    }
    input.contentFiles.forEach((file) => {
      form.append('contentFiles', file);
    });
    if (input.thumbnailFile) {
      form.append('thumbnailFile', input.thumbnailFile);
    }

    const payload = await this.con.postMultipart('/uploads', form);
    const parsed = createUploadResponseSchema.parse(payload);
    return new Upload(parsed.upload);
  }

  async findById(id: string): Promise<Upload | null> {
    const payload = await this.con.get(`/uploads/${id}`);
    const parsed = uploadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }

    return new Upload(parsed.data as UploadDTO);
  }

  async markCompleted(id: string): Promise<void> {
    await this.con.post(`/uploads/${id}/status`, {
      status: StoryStatus.READY,
    });
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.con.post(`/uploads/${id}/status`, {
      status: StoryStatus.FAILED,
      errorReason: reason,
    });
  }
}
