import { describe, expect, it, vi } from 'vitest';
import { StoryDAO } from '../StoryDAO';
import { StoryStatus } from '@/entities';
import { TTSService } from '@/services';

const sampleStory = {
  id: 'story-1',
  uploadId: 'upload-1',
  title: 'Sample story',
  content: 'Story content',
  audioUrl: null,
  status: StoryStatus.DRAFT,
  views: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('StoryDAO', () => {
  it('createStory returns Story instance', async () => {
    const client = {
      post: vi.fn().mockResolvedValue(sampleStory),
      get: vi.fn(),
    };
    const ttsService = new TTSService({ synthesize: vi.fn() });
    const dao = new StoryDAO(client as any, ttsService);

    const story = await dao.createStory('upload-1');

    expect(client.post).toHaveBeenCalledWith('/stories', { uploadId: 'upload-1' });
    expect(story.id).toBe('story-1');
    expect(story.title).toBe('Sample story');
  });

  it('generateAudio delegates to TTS and API', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(sampleStory),
      post: vi.fn().mockResolvedValue({ audioUrl: 'https://example.com/audio.mp3' }),
    };
    const synthesize = vi.fn().mockResolvedValue({ url: 'https://example.com/audio.mp3' });
    const ttsService = new TTSService({ synthesize });
    const dao = new StoryDAO(client as any, ttsService);

    const result = await dao.generateAudio('story-1', { voice: 'vi-VN', speed: 1.2 });

    expect(client.get).toHaveBeenCalledWith('/stories/story-1');
    expect(synthesize).toHaveBeenCalledWith('Story content', { voice: 'vi-VN', speed: 1.2 });
    expect(client.post).toHaveBeenCalledWith('/stories/story-1/generate-audio', { voice: 'vi-VN', speed: 1.2 });
    expect(result.audioUrl).toBe('https://example.com/audio.mp3');
  });
});
