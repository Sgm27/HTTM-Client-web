import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload as UploadIcon, Loader2, FileText, BookOpen, Newspaper } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { debugAuth, refreshSession } from "@/utils/auth-debug";
import { submitUpload } from "./uploadService";

const Upload = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<'story' | 'news'>('story');
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  useEffect(() => {
    // Chỉ redirect khi đã load xong và không có user
    if (!authLoading && !user) {
      toast.error("Vui lòng đăng nhập để đăng nội dung");
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleDebugAuth = async () => {
    const result = await debugAuth();
    console.log('Debug result:', result);
    toast.info("Kiểm tra console để xem thông tin debug");
  };

  const handleRefreshSession = async () => {
    const result = await refreshSession();
    if (result.error) {
      toast.error("Lỗi refresh session: " + result.error.message);
    } else {
      toast.success("Đã refresh session thành công");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error("File không được vượt quá 50MB");
        return;
      }

      // Check file type
      const allowedTypes = [
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
      ];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Chỉ hỗ trợ file: text, docx, pdf, ảnh (jpg, png, gif, webp)");
        return;
      }

      setFile(selectedFile);
      toast.success("Đã chọn file: " + selectedFile.name);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        toast.error('Thumbnail phải là ảnh');
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        toast.error('Thumbnail tối đa 10MB');
        return;
      }
      setThumbnail(selected);
      toast.success('Đã chọn thumbnail: ' + selected.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Vui lòng đăng nhập để đăng nội dung");
      return;
    }

    if (!title || (!content && !file)) {
      toast.error("Vui lòng điền tiêu đề và nội dung hoặc upload file");
      return;
    }

    setLoading(true);

    try {
      const result = await submitUpload({
        supabase,
        user,
        title,
        description,
        content,
        contentType,
        isPublic,
        file,
        thumbnail,
      });

      toast.success(`Đăng ${contentType === 'story' ? 'truyện' : 'bài báo'} thành công!`);
      navigate(`/story/${result.story.id}`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Không thể đăng nội dung");
    } finally {
      setLoading(false);
    }
  };

  // Hiển thị loading khi đang kiểm tra authentication
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

  // Hiển thị thông báo nếu chưa đăng nhập
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-3xl mx-auto">
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold mb-4">Cần đăng nhập</h1>
              <p className="text-muted-foreground mb-6">
                Bạn cần đăng nhập để có thể đăng nội dung
              </p>
              <div className="space-y-4">
                <Button onClick={() => navigate("/auth")}>
                  Đăng nhập ngay
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={handleDebugAuth}>
                    Debug Auth
                  </Button>
                  <Button variant="outline" onClick={handleRefreshSession}>
                    Refresh Session
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-serif font-bold mb-2">
              Đăng Nội Dung Mới
            </h1>
            <p className="text-muted-foreground">
              Chia sẻ truyện hoặc bài báo với cộng đồng. Hỗ trợ upload file text, docx, pdf, ảnh
            </p>
          </div>

          

          <Card className="p-8 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contentType">Loại nội dung</Label>
                  <Select value={contentType} onValueChange={(value: 'story' | 'news') => setContentType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại nội dung" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">
                        <div className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-2" />
                          Truyện
                        </div>
                      </SelectItem>
                      <SelectItem value="news">
                        <div className="flex items-center">
                          <Newspaper className="w-4 h-4 mr-2" />
                          Bài báo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visibility">Hiển thị</Label>
                  <Select value={isPublic ? 'public' : 'private'} onValueChange={(value) => setIsPublic(value === 'public')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chế độ hiển thị" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Công khai</SelectItem>
                      <SelectItem value="private">Riêng tư</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề *</Label>
                <Input
                  id="title"
                  placeholder={`Nhập tiêu đề ${contentType === 'story' ? 'truyện' : 'bài báo'}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả ngắn</Label>
                <Textarea
                  id="description"
                  placeholder={`Mô tả ngắn gọn về ${contentType === 'story' ? 'truyện' : 'bài báo'} của bạn`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Nội dung {!file && '*'}</Label>
                <Textarea
                  id="content"
                  placeholder={`Nhập nội dung ${contentType === 'story' ? 'truyện' : 'bài báo'} hoặc upload file bên dưới`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  required={!file}
                />
                <p className="text-sm text-muted-foreground">
                  Bạn có thể nhập trực tiếp nội dung hoặc upload file. Nếu upload file, nội dung sẽ được trích xuất tự động.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File đính kèm (Hỗ trợ: text, docx, pdf, ảnh)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file"
                    type="file"
                    accept=".txt,.pdf,.docx,.doc,image/*"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {file && (
                    <span className="flex items-center text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 mr-2" />
                      {file.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ: Text, PDF, DOCX, Ảnh (Tối đa 50MB). Nội dung sẽ được trích xuất tự động và tạo audio.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail (tùy chọn - ảnh)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="cursor-pointer"
                  />
                  {thumbnail && (
                    <span className="flex items-center text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 mr-2" />
                      {thumbnail.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Ảnh tối đa 10MB. Nếu không chọn, sẽ dùng ảnh upload (nếu có).</p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang đăng...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-4 w-4" />
                      Đăng {contentType === 'story' ? 'Truyện' : 'Bài Báo'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Upload;
