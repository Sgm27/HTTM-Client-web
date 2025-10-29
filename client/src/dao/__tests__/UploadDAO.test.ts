import { describe, expect, it, vi } from 'vitest';
import { UploadDAO } from '../UploadDAO';
import { StoryStatus } from '@/entities';

const createClient = () => ({
  post: vi.fn(),
  postMultipart: vi.fn(),
  get: vi.fn(),
});

describe('UploadDAO status mutations', () => {
  it('markCompleted posts READY status', async () => {
    const client = createClient();
    const dao = new UploadDAO(client as any);

    await dao.markCompleted('upload-id');

    expect(client.post).toHaveBeenCalledWith('/uploads/upload-id/status', {
      status: StoryStatus.READY,
    });
  });

  it('markFailed posts FAILED status with reason', async () => {
    const client = createClient();
    const dao = new UploadDAO(client as any);

    await dao.markFailed('upload-id', 'missing-file');

    expect(client.post).toHaveBeenCalledWith('/uploads/upload-id/status', {
      status: StoryStatus.FAILED,
      errorReason: 'missing-file',
    });
  });
});
