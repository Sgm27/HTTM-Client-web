type CommentInit = Partial<Comment> & {
  story_id?: string;
  user_id?: string;
  created_at?: string | Date;
  content?: string;
};

export class Comment {
  id!: string;
  storyId!: string;
  userId!: string;
  text!: string;
  createdAt!: Date;
  author?: {
    id?: string;
    name?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  };

  content?: string;

  constructor(init?: CommentInit) {
    if (init) {
      this.id = init.id ?? '';
      this.storyId = init.storyId ?? init.story_id ?? '';
      this.userId = init.userId ?? init.user_id ?? '';
      const text = init.text ?? init.content ?? '';
      this.text = text;
      this.content = init.content ?? text;
      this.author = init.author;

      const created = init.createdAt ?? init.created_at;
      if (created instanceof Date) {
        this.createdAt = created;
      } else if (typeof created === 'string') {
        this.createdAt = new Date(created);
      } else {
        this.createdAt = new Date();
      }
    } else {
      this.id = '';
      this.storyId = '';
      this.userId = '';
      this.text = '';
      this.createdAt = new Date();
    }
  }
}
