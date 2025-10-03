import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, 
  BookOpen, 
  Trash2, 
  Edit3, 
  Eye, 
  Clock,
  Newspaper,
  Volume2,
  FileText,
  LogOut
} from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface StoryData {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  view_count: number;
  is_public: boolean;
  status: string;
  created_at: string;
  cover_image_url: string | null;
  audios?: {
    id: string;
    generation_status: string;
  }[];
}

const Account = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [myStories, setMyStories] = useState<StoryData[]>([]);

  useEffect(() => {
    checkAuth();
    fetchProfile();
    fetchMyStories();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Vui lòng đăng nhập");
      navigate("/auth");
    }
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      setProfile(data);
      setFullName(data.full_name || "");
    }
  };

  const fetchMyStories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("stories")
      .select(`
        id, 
        title, 
        description,
        content_type,
        view_count, 
        is_public,
        status,
        created_at,
        cover_image_url,
        audios (
          id,
          generation_status
        )
      `)
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching stories:", error);
    } else {
      setMyStories(data || []);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Không tìm thấy người dùng");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Cập nhật thông tin thành công!");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.message || "Không thể cập nhật thông tin");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm("Bạn có chắc muốn xóa truyện này?")) return;

    try {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", storyId);

      if (error) throw error;

      toast.success("Đã xóa truyện");
      fetchMyStories();
    } catch (error: any) {
      toast.error("Không thể xóa truyện");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">
              Quản Lý Tài Khoản
            </h1>
            <p className="text-muted-foreground">
              Cập nhật thông tin và quản lý truyện của bạn
            </p>
          </div>

          <Card className="p-8 shadow-soft">
            <h2 className="text-2xl font-serif font-semibold mb-6">
              Thông Tin Cá Nhân
            </h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  "Cập nhật"
                )}
              </Button>
            </form>
          </Card>

          <Card className="p-8 shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-semibold">
                Nội dung của tôi ({myStories.length})
              </h2>
              <Button onClick={() => navigate("/upload")}>
                <FileText className="w-4 h-4 mr-2" />
                Tạo mới
              </Button>
            </div>

            {myStories.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Chưa có nội dung nào</h3>
                <p className="text-muted-foreground mb-6">
                  Hãy bắt đầu bằng việc tạo truyện hoặc tin tức đầu tiên của bạn
                </p>
                <Button onClick={() => navigate("/upload")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Tạo nội dung đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myStories.map((story) => (
                  <Card key={story.id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={story.content_type === 'story' ? 'default' : 'secondary'}>
                            {story.content_type === 'story' ? (
                              <>
                                <BookOpen className="w-3 h-3 mr-1" />
                                Truyện
                              </>
                            ) : (
                              <>
                                <Newspaper className="w-3 h-3 mr-1" />
                                Tin tức
                              </>
                            )}
                          </Badge>
                          <Badge variant={story.is_public ? 'outline' : 'secondary'}>
                            {story.is_public ? 'Công khai' : 'Riêng tư'}
                          </Badge>
                          <Badge variant={
                            story.status === 'published' ? 'default' : 
                            story.status === 'draft' ? 'secondary' : 'destructive'
                          }>
                            {story.status === 'published' ? 'Đã xuất bản' : 
                             story.status === 'draft' ? 'Bản nháp' : 'Xử lý'}
                          </Badge>
                          {story.audios && story.audios.length > 0 && (
                            <Badge variant="outline">
                              <Volume2 className="w-3 h-3 mr-1" />
                              {story.audios[0].generation_status === 'completed' ? 'Có audio' : 'Đang tạo audio'}
                            </Badge>
                          )}
                        </div>

                        <h3 
                          className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/story/${story.id}`)}
                        >
                          {story.title}
                        </h3>
                        
                        {story.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {story.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Eye className="w-4 h-4 mr-1" />
                            {story.view_count} lượt xem
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {new Date(story.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </div>

                      {story.cover_image_url && (
                        <div className="ml-4 w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={story.cover_image_url}
                            alt={story.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/story/${story.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Xem
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Điều hướng đến trang chỉnh sửa - có thể implement sau
                            toast.info("Chức năng chỉnh sửa sẽ được phát triển trong phiên bản tới");
                          }}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Sửa
                        </Button>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStory(story.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Xóa
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Logout Section */}
          <Card className="p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Đăng xuất</h3>
                <p className="text-sm text-muted-foreground">
                  Thoát khỏi tài khoản hiện tại
                </p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Đã đăng xuất");
                  navigate("/");
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Đăng xuất
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Account;
