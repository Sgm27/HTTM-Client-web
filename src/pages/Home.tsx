import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BookOpen, Clock, Eye, Heart, Newspaper, Volume2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

interface Story {
  id: string;
  title: string;
  description: string;
  content_type: 'story' | 'news' | null;
  status: 'draft' | 'published' | 'rejected' | null;
  is_public: boolean | null;
  cover_image_url: string | null;
  thumbnail_url?: string | null;
  view_count: number;
  views_count?: number | null;
  likes_count?: number | null;
  audio_status: string | null;
  audio_url: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

const Home = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "views">("new");
  const [contentType, setContentType] = useState<"all" | "story" | "news">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const navigate = useNavigate();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl] = useState(() => new Audio());
  const location = useLocation();

  useEffect(() => {
    setPage(1);
    fetchStories(1, true);
  }, [search, sort, contentType, selectedTag]);

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase.from('tags').select('id, name').order('name');
      setTags(data || []);
    };
    loadTags();
  }, []);

  // Sync contentType/sort from URL query
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("type");
    if (t && ["all", "story", "news"].includes(t)) {
      setContentType(t as any);
    }
    const s = params.get("sort");
    if (s && ["new", "views"].includes(s)) {
      setSort(s as any);
    }
  }, [location.search]);

  const fetchStories = async (targetPage = page, replace = false) => {
    try {
      setLoading(true);
      
      let query: any = (supabase as any)
        .from("stories")
        .select(`
          id,
          title,
          description,
          content_type,
          status,
          is_public,
          cover_image_url,
          thumbnail_url,
          view_count,
          audio_status,
          audio_url,
          created_at,
          author_id
        `)
        .eq('status', 'published')
        .eq('is_public', true);

      // Filter by content type
      if (contentType !== "all") {
        query.eq('content_type', contentType);
      }

      // Search functionality
      if (search.trim()) {
        query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      // Tag filter via join table
      if (selectedTag) {
        const { data: tagJoin } = await (supabase as any)
          .from('story_tags')
          .select('story_id')
          .eq('tag_id', selectedTag);
        const taggedIds: string[] = ((tagJoin || []) as Array<{ story_id: string }>).map((r) => String(r.story_id));
        if (taggedIds.length === 0) {
          setStories([]);
          setLoading(false);
          return;
        }
        query = (query as any).in('id', taggedIds as string[]);
      }

      // Sorting
      if (sort === "new") {
        query.order("created_at", { ascending: false });
      } else if (sort === "views") {
        query.order("view_count", { ascending: false, nullsFirst: true });
      }

      // Pagination
      const from = (targetPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      
      // Get unique author IDs to fetch profiles
      const authorIds: string[] = [...new Set((data || []).map((story: any) => String(story.author_id)))] as string[];
      
      // Fetch profiles for all authors
      const { data: profilesData } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds as string[]);
      
      // Create a map of author_id to profile
      const profilesMap = new Map();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
      
      // Compute likes per page
      const ids: string[] = (data || []).map((s: any) => String(s.id));
      let likesCountMap = new Map<string, number>();
      if (ids.length) {
        const { data: likesRows } = await (supabase as any)
          .from('story_likes')
          .select('story_id')
          .in('story_id', ids);
        (likesRows || []).forEach((r: any) => {
          const key = String(r.story_id);
          likesCountMap.set(key, (likesCountMap.get(key) || 0) + 1);
        });
      }

      // Merge stories with profiles and likes
      const storiesWithProfiles = (data || []).map((story: any) => ({
        ...story,
        profiles: profilesMap.get(story.author_id) || null,
        likes_count: likesCountMap.get(String(story.id)) || 0,
      }));
      
      if (replace) {
        setStories(storiesWithProfiles);
      } else {
        setStories((prev) => [...prev, ...storiesWithProfiles]);
      }
    } catch (error: any) {
      console.error('Error fetching stories:', error);
      toast.error("Không thể tải danh sách nội dung");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-12">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-serif font-bold mb-4 bg-gradient-hero bg-clip-text text-transparent">
            Thư Viện Truyện & Báo
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Khám phá hàng ngàn câu chuyện thú vị, đọc và nghe mọi lúc mọi nơi
          </p>
        </div>

        <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Tìm kiếm theo tiêu đề hoặc mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select value={sort} onValueChange={(v: any) => {
              setSort(v);
              const params = new URLSearchParams(location.search);
              if (v === 'new') params.delete('sort'); else params.set('sort', v);
              navigate({ pathname: '/', search: params.toString() });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mới nhất</SelectItem>
                <SelectItem value="views">Xem nhiều</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={contentType} onValueChange={(v: any) => {
              setContentType(v);
              const params = new URLSearchParams(location.search);
              if (v === 'all') params.delete('type'); else params.set('type', v);
              navigate({ pathname: '/', search: params.toString() });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Lọc theo loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
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
        </div>

        {/* Tag filter */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <button
            className={`px-3 py-1 rounded-full border text-sm ${selectedTag ? '' : 'bg-primary text-primary-foreground'}`}
            onClick={() => setSelectedTag(null)}
          >
            Tất cả thẻ
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-1 rounded-full border text-sm ${selectedTag === t.id ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => setSelectedTag(t.id)}
              title={t.name}
            >
              {t.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-xl text-muted-foreground mb-4">
              Chưa có nội dung nào
            </p>
            <Button onClick={() => navigate("/upload")}>
              Đăng nội dung đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <Card
                key={story.id}
                className="overflow-hidden cursor-pointer transition-smooth hover:shadow-hover group"
                onClick={() => navigate(`/story/${story.id}`)}
              >
                <div className="aspect-video bg-gradient-card relative overflow-hidden">
                  {(story.thumbnail_url || story.cover_image_url) ? (
                    <img
                      src={story.thumbnail_url || story.cover_image_url!}
                      alt={story.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  {story.audio_url && (
                    <button
                      className="absolute bottom-3 right-3 z-10 bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playingId === story.id) {
                          audioEl.pause();
                          setPlayingId(null);
                        } else {
                          try {
                            audioEl.pause();
                          } catch {}
                          audioEl.src = story.audio_url!;
                          audioEl.currentTime = 0;
                          audioEl.play();
                          setPlayingId(story.id);
                          audioEl.onended = () => setPlayingId(null);
                        }
                      }}
                      title={playingId === story.id ? 'Tạm dừng' : 'Phát audio'}
                    >
                      {playingId === story.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-serif font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {story.title}
                  </h3>
                  
                  {story.description && (
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {story.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDate(story.created_at)}
                      </span>
                      <span className="flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {story.view_count}
                      </span>
                      {typeof (story as any).likes_count === 'number' && (
                        <span className="flex items-center">
                          <Heart className="w-3 h-3 mr-1" />
                          {(story as any).likes_count}
                        </span>
                      )}
                      {story.audio_url && (
                        <span className="flex items-center">
                          <Volume2 className="w-3 h-3 mr-1" />
                          Audio
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      {story.content_type === 'story' ? (
                        <div className="flex items-center text-blue-600">
                          <BookOpen className="w-3 h-3 mr-1" />
                          Truyện
                        </div>
                      ) : (
                        <div className="flex items-center text-green-600">
                          <Newspaper className="w-3 h-3 mr-1" />
                          Báo
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Tác giả: {story.profiles?.full_name || 'Ẩn danh'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && (
          <div className="flex justify-center mt-8">
            <Button onClick={() => { const next = page + 1; setPage(next); fetchStories(next); }}>
              Tải thêm
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
