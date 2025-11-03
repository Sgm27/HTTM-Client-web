import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { UploadForm, UploadFormState } from '@/components/upload/UploadForm';
import { ProgressBar } from '@/components/upload/ProgressBar';
import { createStory, submitUpload, trackOcrProgress, getAudioStatus } from '@/lib/api/uploadApi';
import { ContentType, StoryStatus, Upload as UploadEntity, Visibility, ProcessingStatus, UploadImage } from '@/entities';
import { Button } from '@/components/ui/button';

// Step Upload - 1: Initialize and guard the upload page
const Upload = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<UploadFormState>({
    contentType: ContentType.TEXT,
    visibility: Visibility.PUBLIC,
    title: '',
    description: '',
    contentFiles: [],
    thumbnailFile: null,
  });
  const [upload, setUpload] = useState<UploadEntity | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | undefined>();
  const [createStoryStage, setCreateStoryStage] = useState<'idle' | 'creating' | 'generatingAudio'>(
    'idle',
  );
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const processingStatusLabel: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: 'Chờ xử lý',
    [ProcessingStatus.PROCESSING]: 'Đang xử lý',
    [ProcessingStatus.COMPLETED]: 'Hoàn tất',
    [ProcessingStatus.FAILED]: 'Lỗi',
  };

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('Vui lòng đăng nhập để đăng nội dung');
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    // Only create preview URLs for image files
    const urls = formState.contentFiles
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [formState.contentFiles]);

  const isReadyToCreateStory = useMemo(() => {
    if (!upload) return false;
    if (upload.status === StoryStatus.READY) {
      return true;
    }
    return upload.processingStatus === ProcessingStatus.COMPLETED;
  }, [upload]);

  const displayImages = useMemo(() => {
    if (upload?.images && upload.images.length > 0) {
      return upload.images
        .map((image, index) => ({
          key: image.id ?? `${image.storagePath}-${index}`,
          url: image.publicUrl ?? image.storagePath ?? '',
          status: image.status,
          progress: image.progress ?? 0,
        }))
        .filter((item) => Boolean(item.url));
    }
    // Only show previews for image files
    if (previewUrls.length > 0) {
      return previewUrls.map((url, index) => ({
        key: `${index}-${url}`,
        url,
        status: undefined,
        progress: 0,
      }));
    }
    return [];
  }, [upload, previewUrls]);

  const needsOcr = useMemo(() => {
    if (!upload) return false;
    if (displayImages.length > 0) return true;
    if (upload.processingStatus === ProcessingStatus.PROCESSING) return true;
    return false;
  }, [upload, displayImages]);

  // Step Upload - 6: Poll OCR progress until processing completes
  useEffect(() => {
    if (!upload) return;

    let timeoutId: number | undefined;

    const pollOcr = async () => {
      try {
        const result = await trackOcrProgress(upload.id);
        setOcrProgress(result.progress);
        const combinedText = result.ocrText ?? result.extractedText ?? result.text;
        if (combinedText) {
          setOcrText(combinedText);
        }

        setUpload((prev) => {
          if (!prev) return prev;
          const next = new UploadEntity({
            ...prev,
            progress: result.progress,
            status: (result.storyStatus ?? prev.status) as StoryStatus,
            processingStatus: (result.status ?? prev.processingStatus) as ProcessingStatus,
            ocrText: result.ocrText ?? combinedText ?? prev.ocrText,
            content: combinedText ?? prev.content,
            images: result.images
              ? result.images.map((image) => new UploadImage(image))
              : prev.images,
          });

          if (next.processingStatus === ProcessingStatus.COMPLETED) {
            next.status = StoryStatus.READY;
            next.progress = 100;
          } else if (next.processingStatus === ProcessingStatus.FAILED) {
            next.status = StoryStatus.FAILED;
          }

          return next;
        });

        if (result.status === ProcessingStatus.COMPLETED || result.status === ProcessingStatus.FAILED) {
          if (result.status === ProcessingStatus.COMPLETED && combinedText) {
            setOcrProgress(100);
            setOcrText(combinedText);
          }
          if (result.status === ProcessingStatus.FAILED) {
            toast.error('Xử lý OCR thất bại. Vui lòng thử lại.');
          }
          return;
        }

        timeoutId = window.setTimeout(pollOcr, 10000);
      } catch (error) {
        console.error('OCR polling error:', error);
        toast.error('Không thể cập nhật tiến độ OCR');
        timeoutId = window.setTimeout(pollOcr, 10000);
      }
    };

    if (
      upload.processingStatus === ProcessingStatus.PROCESSING ||
      upload.status === StoryStatus.OCR_IN_PROGRESS
    ) {
      pollOcr();
    } else if (upload.processingStatus === ProcessingStatus.COMPLETED) {
      if (upload.ocrText || upload.content) {
        setOcrProgress(100);
        setOcrText(upload.ocrText ?? upload.content);
      }
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

  // Step Upload - 3: Gather form state and submit upload request
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast.error('Vui lòng đăng nhập để đăng nội dung');
      return;
    }

    if (formState.contentFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất một file nội dung');
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
        contentFiles: formState.contentFiles,
        thumbnailFile: formState.thumbnailFile ?? undefined,
      });

      setUpload(createdUpload);
      setOcrProgress(createdUpload.progress ?? 0);
      setOcrText(createdUpload.ocrText ?? createdUpload.content);
      toast.success('Đã gửi yêu cầu xử lý nội dung');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Không thể tải lên nội dung');
    } finally {
      setLoading(false);
    }
  };

  // Step Upload - 7: Trigger story creation once upload is ready
  const handleCreateStory = async () => {
    if (!upload) return;
    setCreateStoryStage('creating');
    
    try {
      const story = await createStory(upload.id);
      
      const audioStatus = story.audioStatus;

      if (audioStatus === 'PENDING' || audioStatus === 'PROCESSING') {
        setCreateStoryStage('generatingAudio');
        toast.info('Đang tạo audio, vui lòng đợi...');

        const pollInterval = 10000; // 10 seconds
        const maxAttempts = 600; // Maximum 100 minutes (60 * 10s)
        let attempts = 0;

        // Step Upload - 8: Poll audio generation status until completion
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
              
              if (attempts % 3 === 0) {
                toast.info(`Đang xử lý audio... (${attempts * 10}s)`);
              }
              
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
              console.error('Error polling audio status:', error);
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          }

          if (attempts >= maxAttempts) {
            toast.error('Quá thời gian chờ tạo audio. Vui lòng thử lại sau.');
          }
        };

        await pollAudioStatus();
      }

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
            <div className="space-y-6">
              {displayImages.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {displayImages.map((image, index) => (
                    <div key={image.key ?? index} className="space-y-2">
                      <div className="overflow-hidden rounded-md border bg-muted/40">
                        <img
                          src={image.url}
                          alt={`Preview ${index + 1}`}
                          className="h-64 w-full object-cover"
                        />
                      </div>
                      {image.status && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Trạng thái: {processingStatusLabel[image.status]}</p>
                          <p>Tiến độ: {image.progress ?? 0}%</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {upload.thumbnailUrl && (
                <div className="flex flex-col items-start space-y-2">
                  <p className="text-sm text-muted-foreground">Thumbnail đã tải lên</p>
                  <img
                    src={upload.thumbnailUrl}
                    alt="Uploaded thumbnail preview"
                    className="h-48 w-48 rounded-md border object-cover"
                  />
                </div>
              )}

              {needsOcr && (
                <ProgressBar
                  progress={ocrProgress}
                  statusLabel={
                    upload.processingStatus === ProcessingStatus.PROCESSING
                      ? 'Đang xử lý OCR'
                      : upload.processingStatus === ProcessingStatus.FAILED
                        ? 'Lỗi OCR'
                        : 'Hoàn tất OCR'
                  }
                />
              )}

              {needsOcr && upload.processingStatus === ProcessingStatus.FAILED && (
                <p className="text-sm text-destructive">Hệ thống không thể trích xuất văn bản từ ảnh. Vui lòng thử lại.</p>
              )}

              {ocrText && needsOcr && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Văn bản đã trích xuất từ OCR:</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{ocrText}</p>
                </div>
              )}

              {upload.content && !needsOcr && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Nội dung đã tải lên:</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{upload.content.substring(0, 500)}...</p>
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
