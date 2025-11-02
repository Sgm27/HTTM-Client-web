import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { UploadForm, UploadFormState } from '@/components/upload/UploadForm';
import { ProgressBar } from '@/components/upload/ProgressBar';
import { createStory, submitUpload, trackOcrProgress, getAudioStatus } from '@/lib/api/uploadApi';
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
  const [createStoryStage, setCreateStoryStage] = useState<'idle' | 'creating' | 'generatingAudio'>(
    'idle',
  );

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

    // Only poll if status is OCR_IN_PROGRESS
    if (upload?.status === StoryStatus.OCR_IN_PROGRESS && upload.contentFileId) {
      pollOcr();
    }
    // If status is READY and we have content from text file, set it directly
    else if (upload?.status === StoryStatus.READY && upload.content) {
      setOcrProgress(100);
      setOcrText(upload.content);
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
    setCreateStoryStage('creating');
    
    try {
      // Step 1: Create story (this will start audio generation in background)
      const story = await createStory(upload.id);
      
      // Step 2: Check if audio is already available or needs generation
      const audioStatus = story.audioStatus;

      // If audio is not completed, start polling
      if (audioStatus === 'PENDING' || audioStatus === 'PROCESSING') {
        setCreateStoryStage('generatingAudio');
        toast.info('Đang tạo audio, vui lòng đợi...');

        // Poll for audio status every 10 seconds
        const pollInterval = 10000; // 10 seconds
        const maxAttempts = 600; // Maximum 100 minutes (60 * 10s)
        let attempts = 0;

        const pollAudioStatus = async (): Promise<void> => {
          while (attempts < maxAttempts) {
            attempts++;
            
            try {
              const statusResponse = await getAudioStatus(story.id);
              
              if (statusResponse.audioStatus === 'COMPLETED') {
                toast.success('Audio đã được tạo thành công!');
                break;
              } else if (statusResponse.audioStatus === 'FAILED') {
                toast.error('Không thể tạo audio cho truyện');
                break;
              }
              
              // Update progress message
              if (attempts % 3 === 0) {
                toast.info(`Đang xử lý audio... (${attempts * 10}s)`);
              }
              
              // Wait before next poll
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
              console.error('Error polling audio status:', error);
              // Continue polling even if there's an error
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          }

          if (attempts >= maxAttempts) {
            toast.error('Quá thời gian chờ tạo audio. Vui lòng thử lại sau.');
          }
        };

        await pollAudioStatus();
      }

      // Navigate to story page regardless of audio status
      toast.success('Đã tạo truyện thành công!');
      navigate('/story/' + story.id);
      
    } catch (error) {
      console.error('Create story error:', error);
      toast.error('Không thể tạo truyện');
    } finally {
      setCreateStoryStage('idle');
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
              {upload.thumbnailUrl && (
                <div className="flex flex-col items-start space-y-2">
                  <p className="text-sm text-muted-foreground">Thumbnail d� t?i l�n</p>
                  <img
                    src={upload.thumbnailUrl}
                    alt="Uploaded thumbnail preview"
                    className="h-48 w-48 rounded-md border object-cover"
                  />
                </div>
              )}
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
                <Button
                  onClick={handleCreateStory}
                  disabled={!isReadyToCreateStory || createStoryStage !== 'idle'}
                >
                  {createStoryStage !== 'idle' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {createStoryStage === 'generatingAudio'
                    ? 'Đang tạo audio...'
                    : createStoryStage === 'creating'
                      ? 'Đang tạo...'
                      : 'Tạo Story'}
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
