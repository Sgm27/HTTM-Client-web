export class Comment {
  id!: string;
  storyId!: string;
  userId!: string;
  text!: string;
  createdAt!: Date;

  constructor(init?: Partial<Comment>) {
    Object.assign(this, init);
    if (typeof this.createdAt === 'string') {
      this.createdAt = new Date(this.createdAt);
    }
  }
}
