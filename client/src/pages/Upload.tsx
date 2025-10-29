import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { UploadForm, UploadFormState } from '@/components/upload/UploadForm';
import { ProgressBar } from '@/components/upload/ProgressBar';
import { createStory, submitUpload, trackOcrProgress } from '@/lib/api/uploadApi';
import { ContentType, StoryStatus, Upload as UploadEntity, Visibility } from '@/entities';
import { Button } from '@/components/ui/button';

const Upload = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<UploadFormState>({
    contentType: ContentType.TEXT,
    visibility: Visibility.PUBLIC,
    title: '',
    description: '',
    contentFile: null,
    thumbnailFile: null,
  });
  const [upload, setUpload] = useState<UploadEntity | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | undefined>();
  const [creatingStory, setCreatingStory] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Vui lòng đăng nhập để đăng nội dung');
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  const isReadyToCreateStory = useMemo(() => {
    return upload?.status === StoryStatus.READY || ocrProgress === 100;
  }, [upload, ocrProgress]);

  useEffect(() => {
    let timeoutId: number | undefined;

    const pollOcr = async () => {
      if (!upload?.contentFileId) return;
      try {
        const result = await trackOcrProgress(upload.contentFileId);
        setOcrProgress(result.progress);
        setOcrText(result.text);

        if (result.progress >= 100) {
          setUpload((prev) => {
            if (!prev) return prev;
            const updated = new UploadEntity({ ...prev });
            updated.status = StoryStatus.READY;
            updated.progress = 100;
            return updated;
          });
          return;
        }

        timeoutId = window.setTimeout(pollOcr, 3000);
      } catch (error) {
        console.error('OCR polling error:', error);
        toast.error('Không thể cập nhật tiến độ OCR');
      }
    };

    if (upload?.status === StoryStatus.OCR_IN_PROGRESS && upload.contentFileId) {
      pollOcr();
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [upload]);

  const handleStateChange = (next: Partial<UploadFormState>) => {
    setFormState((prev) => ({ ...prev, ...next }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast.error('Vui lòng đăng nhập để đăng nội dung');
      return;
    }

    if (!formState.contentFile) {
      toast.error('Vui lòng chọn file nội dung');
      return;
    }

    setLoading(true);

    try {
      const createdUpload = await submitUpload({
        userId: user.id,
        contentType: formState.contentType,
        visibility: formState.visibility,
        title: formState.title,
        description: formState.description,
        contentFile: formState.contentFile,
        thumbnailFile: formState.thumbnailFile ?? undefined,
      });

      setUpload(createdUpload);
      setOcrProgress(createdUpload.progress ?? 0);
      toast.success('Đã gửi yêu cầu xử lý nội dung');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Không thể tải lên nội dung');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async () => {
    if (!upload) return;
    setCreatingStory(true);
    try {
      const story = await createStory(upload.id);
      toast.success('Đã tạo truyện từ nội dung upload');
      navigate(`/story/${story.id}`);
    } catch (error) {
      console.error('Create story error:', error);
      toast.error('Không thể tạo truyện');
    } finally {
      setCreatingStory(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h1 className="text-2xl font-semibold">Cần đăng nhập</h1>
            <p className="text-muted-foreground">Vui lòng đăng nhập để tải nội dung lên hệ thống.</p>
            <Button onClick={() => navigate('/auth')}>Đăng nhập</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">Đăng Nội Dung Mới</h1>
            <p className="text-muted-foreground">
              Chia sẻ truyện hoặc bài báo với cộng đồng. Hỗ trợ upload file text, docx, pdf, ảnh
            </p>
          </div>

          <UploadForm state={formState} onStateChange={handleStateChange} onSubmit={handleSubmit} loading={loading} />

          {upload && (
            <div className="space-y-4">
              <ProgressBar
                progress={ocrProgress}
                statusLabel={
                  upload.status === StoryStatus.OCR_IN_PROGRESS
                    ? 'Đang xử lý'
                    : upload.status === StoryStatus.FAILED
                      ? 'Lỗi OCR'
                      : 'Hoàn tất'
                }
              />
              {ocrText && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Trích xuất trước:</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{ocrText}</p>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleCreateStory} disabled={!isReadyToCreateStory || creatingStory}>
                  {creatingStory ? 'Đang tạo...' : 'Tạo Story'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;
