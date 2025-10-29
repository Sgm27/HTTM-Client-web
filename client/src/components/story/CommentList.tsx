import { Comment, User } from '@/entities';
import { Card } from '@/components/ui/card';

interface CommentListProps {
  comments: Array<Comment & { author?: User }>;
}

export const CommentList = ({ comments }: CommentListProps) => (
  <div className="space-y-4">
    {comments.map((comment) => (
      <Card key={comment.id} className="p-4">
        <div className="text-sm text-muted-foreground">{comment.author?.name ?? 'Người dùng'}</div>
        <p className="mt-2 text-sm whitespace-pre-wrap">{comment.text}</p>
        <div className="mt-2 text-xs text-muted-foreground">
          {comment.createdAt instanceof Date ? comment.createdAt.toLocaleString() : comment.createdAt}
        </div>
      </Card>
    ))}
    {comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bình luận nào.</p>}
  </div>
);
