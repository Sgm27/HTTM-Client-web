import { DAO } from './DAO';
import { ApiClient } from '@/lib/api/httpClient';
import { Story } from '@/entities';
import { TTSService } from '@/services';
import {
  storySchema,
  CreateStoryRequest,
  createStoryRequestSchema,
  generateAudioResponseSchema,
  generateAudioRequestSchema,
  TTSOption,
} from '@/dtos';

export class StoryDAO extends DAO<ApiClient> {
  constructor(con: ApiClient, private readonly tts: TTSService) {
    super(con);
  }

  async getStoryById(storyId: string): Promise<Story> {
    const payload = await this.con.get(`/stories/${storyId}`);
    const parsed = storySchema.parse(payload);
    return new Story(parsed);
  }

  async createStory(uploadId: string): Promise<Story> {
    const body: CreateStoryRequest = createStoryRequestSchema.parse({ uploadId });
    const payload = await this.con.post('/stories', body);
    const parsed = storySchema.parse(payload);
    return new Story(parsed);
  }

  async generateAudio(storyId: string, opt?: TTSOption): Promise<{ audioUrl: string }> {
    const story = await this.getStoryById(storyId);
    const options = opt ? generateAudioRequestSchema.parse(opt) : undefined;
    if (options) {
      await this.tts.generate(story.content, options);
    } else {
      await this.tts.generate(story.content);
    }
    const payload = await this.con.post(`/stories/${storyId}/generate-audio`, options ?? {});
    const parsed = generateAudioResponseSchema.parse(payload);
    return parsed;
  }
}
