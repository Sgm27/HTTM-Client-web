import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import { Story, Comment, StoryStatus } from '@/entities';
import { AudioPlayer, ActionBar, CommentList } from '@/components/story';
import { getStory, generateStoryAudio } from '@/lib/api/uploadApi';
import { TTSOption } from '@/dtos';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Eye } from 'lucide-react';

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [comments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const loadStory = async () => {
      setLoading(true);
      try {
        const data = await getStory(id);
        setStory(data);
        setAudioUrl(data.audioUrl);
      } catch (error) {
        console.error('Failed to load story', error);
        toast.error('Không thể tải nội dung truyện');
      } finally {
        setLoading(false);
      }
    };

    void loadStory();
  }, [id]);

  const handleGenerateAudio = async (option: TTSOption) => {
    if (!story) return;
    try {
      const result = await generateStoryAudio(story.id, option);
      setAudioUrl(result.audioUrl);
      toast.success('Đã tạo audio cho truyện');
    } catch (error) {
      console.error('Generate audio error', error);
      toast.error('Không thể tạo audio');
    }
  };

  const handlePublish = async () => {
    if (!story) return;
    setStory((prev) => {
      if (!prev) return prev;
      const updated = new Story({ ...prev });
      updated.publish();
      return updated;
    });
    toast.success('Đã cập nhật trạng thái truyện');
  };

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
          <AudioPlayer src={audioUrl} />
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Hành động</h2>
          <ActionBar onGenerateAudio={handleGenerateAudio} onPublish={handlePublish} disabled={!story} />
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
