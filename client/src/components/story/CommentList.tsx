import { Comment } from '@/entities';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CommentAuthor {
  id?: string;
  name?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

interface CommentListProps {
  comments: Array<Comment & { author?: CommentAuthor }>;
}

const getAuthorName = (author?: CommentAuthor) => author?.fullName ?? author?.name ?? 'Người dùng';

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/);
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
  return initials.join('') || 'ND';
};

export const CommentList = ({ comments }: CommentListProps) => (
  <div className="space-y-4">
    {comments.map((comment) => (
      <Card key={comment.id} className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={comment.author?.avatarUrl ?? undefined} alt={getAuthorName(comment.author) ?? undefined} />
            <AvatarFallback>{getInitials(getAuthorName(comment.author))}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">{getAuthorName(comment.author)}</p>
              <p className="text-xs text-muted-foreground">
                {comment.createdAt instanceof Date ? comment.createdAt.toLocaleString('vi-VN') : comment.createdAt}
              </p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.text ?? comment.content ?? ''}</p>
          </div>
        </div>
      </Card>
    ))}
    {comments.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bình luận nào.</p>}
  </div>
);
