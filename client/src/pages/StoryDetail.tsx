import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import { Story, Comment, ContentType } from '@/entities';
import { AudioPlayer, CommentList } from '@/components/story';
import { getStory } from '@/lib/api/uploadApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Loader2,
  ArrowLeft,
  Eye,
  Share2,
  Link as LinkIcon,
  CalendarDays,
  MessageCircle,
} from 'lucide-react';

const contentTypeLabels: Record<ContentType, string> = {
  [ContentType.TEXT]: 'Truyện chữ',
  [ContentType.COMIC]: 'Truyện tranh',
  [ContentType.NEWS]: 'Tin tức',
};

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      setUser(supabaseUser);
    };

    void loadUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const loadStory = async () => {
      setLoading(true);
      try {
        const data = await getStory(id);
        setStory(data);
        setComments(data.comments ?? []);
      } catch (error) {
        console.error('Failed to load story', error);
        toast.error('Không thể tải nội dung truyện');
      } finally {
        setLoading(false);
      }
    };

    void loadStory();
  }, [id]);

  const commentCount = useMemo(
    () => story?.commentCount ?? comments.length,
    [comments.length, story?.commentCount],
  );

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && 'writeText' in navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const input = document.createElement('textarea');
        input.value = window.location.href;
        input.setAttribute('readonly', '');
        input.style.position = 'absolute';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      toast.success('Đã sao chép liên kết truyện');
    } catch (error) {
      console.error('Failed to copy link', error);
      toast.error('Không thể sao chép liên kết');
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (!story) return;
    const shareData = {
      title: story.title,
      text: story.description ?? story.content.slice(0, 120),
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Đã chia sẻ truyện');
        return;
      } catch (error) {
        console.error('Failed to share', error);
        toast.error('Không thể chia sẻ truyện');
        return;
      }
    }

    await handleCopyLink();
  }, [handleCopyLink, story]);

  const handleSubmitComment = useCallback(async () => {
    if (!story || !user) {
      toast.error('Bạn cần đăng nhập để bình luận');
      return;
    }

    const content = commentText.trim();
    if (!content) {
      toast.error('Vui lòng nhập nội dung bình luận');
      return;
    }

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/stories/${story.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          content,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to submit comment');
      }

      const payload = await response.json();
      const newComment = new Comment({
        id: payload.id,
        storyId: payload.storyId,
        userId: payload.userId,
        text: payload.text,
        createdAt: payload.createdAt,
        author: payload.author,
      });

      setComments((prev) => [newComment, ...prev]);
      setStory((prev) =>
        prev
          ? new Story({
              ...prev,
              commentCount: typeof payload.commentCount === 'number' ? payload.commentCount : (prev.commentCount ?? prev.comments?.length ?? 0) + 1,
              comments: [newComment, ...(prev.comments ?? [])],
            })
          : prev,
      );
      setCommentText('');
      toast.success('Đã gửi bình luận');
    } catch (error) {
      console.error('Failed to submit comment', error);
      toast.error('Không thể gửi bình luận, vui lòng thử lại');
    } finally {
      setSubmittingComment(false);
    }
  }, [commentText, story, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Không tìm thấy truyện.</p>
            <Button onClick={() => navigate('/')}>Quay lại trang chủ</Button>
          </div>
        </main>
      </div>
    );
  }

  const audioMessage = !story.audioUrl
    ? story.audioStatus === 'failed'
      ? 'Không thể tạo audio cho truyện. Vui lòng thử lại sau.'
      : 'Audio đang được xử lý, vui lòng quay lại sau ít phút.'
    : undefined;

  const formattedDate = story.createdAt instanceof Date
    ? story.createdAt.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : story.createdAt;

  const badgeLabel = story.contentType ? contentTypeLabels[story.contentType] ?? 'Truyện' : 'Truyện';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl py-12 space-y-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{story.views.toLocaleString('vi-VN')} lượt xem</span>
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="secondary" className="rounded-full px-4 py-1 text-sm font-medium">
              {badgeLabel}
            </Badge>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Chia sẻ
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleCopyLink}>
                <LinkIcon className="h-4 w-4" />
                Sao chép link
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-serif font-bold text-foreground">{story.title}</h1>
            {story.description && (
              <p className="text-base text-muted-foreground leading-relaxed">{story.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {(story.author?.fullName ?? story.author?.name ?? 'Tác giả')
                    .split(' ')
                    .filter(Boolean)
                    .map((part) => part[0]?.toUpperCase())
                    .slice(0, 2)
                    .join('') || 'TG'}
                </div>
                <div className="leading-tight">
                  <p className="font-medium text-foreground">{story.author?.fullName ?? story.author?.name ?? 'Tác giả'}</p>
                  <p className="text-xs text-muted-foreground">Đăng truyện</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>Đăng ngày {formattedDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{story.views.toLocaleString('vi-VN')} lượt xem</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>{commentCount.toLocaleString('vi-VN')} bình luận</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <Card className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
              {story.content}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Nghe truyện</h2>
          <Card className="p-4">
            <AudioPlayer src={story.audioUrl ?? undefined} emptyMessage={audioMessage} />
            {story.audioStatus === 'failed' && (
              <p className="mt-3 text-sm text-destructive">Hệ thống chưa thể tạo audio cho truyện này.</p>
            )}
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Bình luận ({commentCount.toLocaleString('vi-VN')})</h2>
          </div>
          {user ? (
            <Card className="p-4 space-y-3">
              <Textarea
                placeholder="Hãy chia sẻ cảm nhận của bạn về truyện này..."
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                disabled={submittingComment}
                rows={4}
              />
              <div className="flex justify-end">
                <Button onClick={handleSubmitComment} disabled={submittingComment}>
                  {submittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gửi bình luận
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Vui lòng đăng nhập để tham gia bình luận và chia sẻ cảm nhận của bạn.
              </p>
            </Card>
          )}
          <CommentList comments={comments} />
        </section>
      </main>
    </div>
  );
};

export default StoryDetail;
