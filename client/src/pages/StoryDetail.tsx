import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import { Story, Comment, StoryStatus } from '@/entities';
import { AudioPlayer, CommentList } from '@/components/story';
import { getStory } from '@/lib/api/uploadApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Eye } from 'lucide-react';

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [comments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const loadStory = async () => {
      setLoading(true);
      try {
        const data = await getStory(id);
        setStory(data);
      } catch (error) {
        console.error('Failed to load story', error);
        toast.error('Không thể tải nội dung truyện');
      } finally {
        setLoading(false);
      }
    };

    void loadStory();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12 space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{story.views} lượt xem</span>
          </div>
        </div>

        <section className="space-y-4">
          <h1 className="text-4xl font-serif font-bold">{story.title}</h1>
          <div className="text-sm text-muted-foreground">
            Trạng thái: {story.status === StoryStatus.PUBLISHED ? 'Đã publish' : 'Nháp'}
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{story.content}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Audio</h2>
          <AudioPlayer src={story.audioUrl ?? undefined} emptyMessage={audioMessage} />
          {story.audioStatus === 'failed' && (
            <p className="text-sm text-destructive">Hệ thống chưa thể tạo audio cho truyện này.</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Bình luận</h2>
          <CommentList comments={comments} />
        </section>
      </main>
    </div>
  );
};

export default StoryDetail;
