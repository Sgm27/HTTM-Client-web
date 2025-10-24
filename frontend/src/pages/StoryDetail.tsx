import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as UICard } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Clock, Eye, Volume2, VolumeX, BookOpen, Newspaper, Pause, Play, Heart, Bookmark, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { synthesizeSpeech } from "@/utils/tts";

interface StoryData {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  content_type: string;
  cover_image_url: string | null;
  view_count: number;
  created_at: string;
  author_id: string;
  profiles: {
    full_name: string | null;
  } | null;
}

type AudioSource = "supabase" | "generated" | "demo";

interface AudioData {
  id?: string;
  audio_url: string;
  generation_status?: string;
  audio_duration: number | null;
  source: AudioSource;
}

interface ExtractedText {
  id: string;
  extracted_text: string;
  original_text: string;
}

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState<StoryData | null>(null);
  const [extractedText, setExtractedText] = useState<ExtractedText | null>(null);
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio());
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [relatedStories, setRelatedStories] = useState<StoryData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; user_id: string; user_name: string | null }>>([]);
  const [newComment, setNewComment] = useState("");
  const listenSessionStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchStory();
      incrementViewCount();
      loadUserAndSocial();
      loadComments();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio]);

  useEffect(() => {
    return () => {
      if (generatedAudioUrlRef.current) {
        URL.revokeObjectURL(generatedAudioUrlRef.current);
        generatedAudioUrlRef.current = null;
      }
    };
  }, []);

  const fetchStory = async () => {
    try {
      // Fetch story details
      const { data: storyData, error: storyError } = await supabase
        .from("stories")
        .select("*")
        .eq("id", id)
        .single();

      if (storyError) throw storyError;
      
      // Fetch profile separately
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", storyData.author_id)
        .single();
      
      // Merge story with profile
      const storyWithProfile = {
        ...storyData,
        profiles: profileData
      };
      
      setStory(storyWithProfile as any);

      // Fetch extracted text
      const { data: textData } = await supabase
        .from("extracted_texts")
        .select("*")
        .eq("content_id", id)
        .single();
      
      if (textData) setExtractedText(textData);

      // Fetch audio data
      const { data: audioData } = await supabase
        .from("audios")
        .select("*")
        .eq("content_id", id)
        .eq("generation_status", "completed")
        .maybeSingle();

      const demoUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      let selectedAudio: AudioData;

      if (audioData) {
        selectedAudio = { ...audioData, source: "supabase" };
        audio.src = audioData.audio_url;
        if (audioData.audio_duration != null) {
          setDuration(Math.floor(audioData.audio_duration));
        }
      } else {
        const textForTts = textData?.extracted_text || storyData.content || storyData.description || storyData.title;
        let generatedAudio: AudioData | undefined;

        if (textForTts) {
          try {
            const { blob, duration: generatedDuration } = await synthesizeSpeech(textForTts);
            const objectUrl = URL.createObjectURL(blob);
            if (generatedAudioUrlRef.current) {
              URL.revokeObjectURL(generatedAudioUrlRef.current);
            }
            generatedAudioUrlRef.current = objectUrl;
            generatedAudio = {
              audio_url: objectUrl,
              audio_duration: generatedDuration ?? null,
              source: "generated",
            };
            audio.src = objectUrl;
            if (generatedDuration != null && Number.isFinite(generatedDuration)) {
              setDuration(Math.floor(generatedDuration));
            }
          } catch (error) {
            console.error("Failed to synthesize audio:", error);
            toast.warning("Không thể tạo audio tự động, sử dụng audio demo tạm thời");
          }
        }

        selectedAudio = generatedAudio ?? {
          audio_url: demoUrl,
          audio_duration: null,
          source: "demo",
        };
        if (selectedAudio.source === "demo") {
          audio.src = demoUrl;
        }
      }

      setAudioData(selectedAudio);
      audio.onended = () => setIsPlaying(false);
      audio.onloadedmetadata = () => setDuration(Math.floor(audio.duration || 0));
      audio.ontimeupdate = () => setPosition(Math.floor(audio.currentTime || 0));
      audio.playbackRate = speed;

      // Fetch related stories (same content type, different story)
      const { data: relatedData } = await supabase
        .from("stories")
        .select("*")
        .eq("content_type", storyData.content_type)
        .neq("id", id)
        .eq("is_public", true)
        .limit(6);

      if (relatedData && relatedData.length > 0) {
        // Fetch profiles for related stories
        const relatedAuthorIds = [...new Set(relatedData.map((story: any) => story.author_id))];
        const { data: relatedProfilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', relatedAuthorIds);
        
        // Create profiles map
        const relatedProfilesMap = new Map();
        (relatedProfilesData || []).forEach(profile => {
          relatedProfilesMap.set(profile.id, profile);
        });
        
        // Merge related stories with profiles
        const relatedWithProfiles = relatedData.map((story: any) => ({
          ...story,
          profiles: relatedProfilesMap.get(story.author_id) || null
        }));
        
        setRelatedStories(relatedWithProfiles as any);
      }

    } catch (error: any) {
      console.error("Error fetching story:", error);
      toast.error("Không thể tải nội dung");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('story_comments')
        .select('id, content, created_at, user_id')
        .eq('story_id', id as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      const map = new Map<string, string | null>();
      (profiles || []).forEach((p: any) => map.set(p.id, p.full_name));
      setComments(
        (data || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          user_id: c.user_id,
          user_name: map.get(c.user_id) ?? null,
        }))
      );
    } catch (e) {
      // non-fatal
    }
  };

  const submitComment = async () => {
    const user = await requireAuth();
    if (!user) return;
    const content = newComment.trim();
    if (!content) return;
    try {
      const { data, error } = await supabase
        .from('story_comments')
        .insert({ story_id: id as string, user_id: user.id, content })
        .select('*')
        .single();
      if (error) throw error;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setComments((prev) => [
        ...prev,
        {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          user_id: user.id,
          user_name: profile?.full_name ?? null,
        },
      ]);
      setNewComment("");
    } catch (e) {
      toast.error('Không thể gửi bình luận');
    }
  };

  const loadUserAndSocial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      // Counts
      const [{ count: likesCnt }, { count: bmsCnt }] = await Promise.all([
        supabase.from('story_likes').select('*', { count: 'exact', head: true }).eq('story_id', id as string),
        supabase.from('user_bookmarks').select('*', { count: 'exact', head: true }).eq('story_id', id as string)
      ]);
      setLikeCount(likesCnt ?? 0);
      setBookmarkCount(bmsCnt ?? 0);

      if (user) {
        const [likeRes, bmRes] = await Promise.all([
          supabase.from('story_likes').select('story_id').eq('story_id', id as string).eq('user_id', user.id).maybeSingle(),
          supabase.from('user_bookmarks').select('story_id').eq('story_id', id as string).eq('user_id', user.id).maybeSingle()
        ]);
        setIsLiked(!!likeRes.data);
        setIsBookmarked(!!bmRes.data);
      } else {
        setIsLiked(false);
        setIsBookmarked(false);
      }
    } catch (e) {
      // non-fatal
    }
  };

  const incrementViewCount = async () => {
    try {
      // Prefer atomic increment via logging view + count from view table
      await supabase.from('story_views').insert({ story_id: id as string });
    } catch (error) {
      console.error("Failed to record view:", error);
    }
  };

  const toggleAudio = () => {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Listening tracking and reading history
  useEffect(() => {
    const attach = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const onPlay = () => {
        listenSessionStartRef.current = audio.currentTime;
        // start periodic progress updates
        if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = window.setInterval(() => {
          void updateReadingHistory(user.id);
        }, 5000);
      };

      const finalizeListen = async () => {
        if (listenSessionStartRef.current == null) return;
        const startAt = listenSessionStartRef.current;
        const listened = Math.max(0, Math.floor(audio.currentTime - startAt));
        if (listened > 0) {
          try {
            await supabase.from('story_listens').insert({
              story_id: id as string,
              user_id: user.id,
              listened_seconds: listened,
            });
          } catch {}
        }
        listenSessionStartRef.current = null;
      };

      const onPause = async () => {
        await finalizeListen();
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        await updateReadingHistory(user.id);
      };

      const onEnded = async () => {
        await finalizeListen();
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        await updateReadingHistory(user.id);
      };

      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      };
    };

    const cleanupPromise = attach();
    return () => {
      void cleanupPromise;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, id, audioData?.audio_duration]);

  const updateReadingHistory = async (uid: string) => {
    try {
      const lastPos = Math.floor(audio.currentTime || 0);
      const duration = audioData?.audio_duration || 0;
      const progress = duration > 0 ? Math.min(100, Math.max(0, (lastPos / duration) * 100)) : 0;
      await supabase
        .from('reading_history')
        .upsert({
          user_id: uid,
          story_id: id as string,
          last_position_seconds: lastPos,
          progress_percent: progress,
          last_accessed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,story_id' });
    } catch {}
  };

  const requireAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Vui lòng đăng nhập để thực hiện thao tác');
      navigate('/auth');
      return null;
    }
    return user;
  };

  const onToggleLike = async () => {
    const user = await requireAuth();
    if (!user) return;
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', id as string)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({ story_id: id as string, user_id: user.id });
        if (error) throw error;
        setIsLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (e: any) {
      toast.error('Không thể cập nhật lượt thích');
    }
  };

  const onToggleBookmark = async () => {
    const user = await requireAuth();
    if (!user) return;
    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('user_bookmarks')
          .delete()
          .eq('story_id', id as string)
          .eq('user_id', user.id);
        if (error) throw error;
        setIsBookmarked(false);
        setBookmarkCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase
          .from('user_bookmarks')
          .insert({ story_id: id as string, user_id: user.id });
        if (error) throw error;
        setIsBookmarked(true);
        setBookmarkCount((c) => c + 1);
      }
    } catch (e: any) {
      toast.error('Không thể cập nhật đánh dấu');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getContentText = () => {
    if (extractedText?.extracted_text) {
      return extractedText.extracted_text;
    }
    if (extractedText?.original_text) {
      return extractedText.original_text;
    }
    return "Không có nội dung văn bản";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12">
          <Card className="h-96 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Không tìm thấy nội dung</h1>
          <Button onClick={() => navigate("/")}>Quay về trang chủ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>

        <article className="max-w-4xl mx-auto">
          {story.cover_image_url && (
            <div className="aspect-video rounded-lg overflow-hidden mb-8 shadow-lg">
              <img
                src={story.cover_image_url}
                alt={story.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                {story.content_type === 'story' ? (
                  <>
                    <BookOpen className="w-3 h-3" />
                    Truyện
                  </>
                ) : (
                  <>
                    <Newspaper className="w-3 h-3" />
                    Tin tức
                  </>
                )}
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {story.title}
            </h1>

            {story.description && (
              <p className="text-xl text-muted-foreground mb-6">
                {story.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span>Tác giả: {story.profiles?.full_name || "Ẩn danh"}</span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {formatDate(story.created_at)}
              </span>
              <span className="flex items-center">
                <Eye className="w-4 h-4 mr-1" />
                {story.view_count} lượt xem
              </span>
            </div>

            {audioData && (
              <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Volume2 className="w-5 h-5" />
                      Nghe Audio
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {audioData.audio_duration
                        ? `Thời lượng: ${Math.ceil(audioData.audio_duration / 60)} phút`
                        : "Nghe nội dung dưới dạng audio"
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {audioData.source === "generated" && "Audio được tạo trực tiếp từ mô hình TTS mới."}
                      {audioData.source === "demo" && "Audio demo tạm thời khi chưa có bản chính thức."}
                      {audioData.source === "supabase" && "Audio đã được tạo và lưu trữ sẵn."}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={toggleAudio}
                    className="rounded-full w-14 h-14"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </Button>
                </div>
              </Card>
            )}

            {/* Share buttons */}
            <div className="flex flex-wrap gap-2 mb-8">
              <Button
                variant={isLiked ? "default" : "outline"}
                size="sm"
                onClick={onToggleLike}
                className="flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                {likeCount}
              </Button>
              <Button
                variant={isBookmarked ? "default" : "outline"}
                size="sm"
                onClick={onToggleBookmark}
                className="flex items-center gap-2"
              >
                <Bookmark className="w-4 h-4" />
                {bookmarkCount}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = window.location.href;
                  if ((navigator as any).share) {
                    try {
                      await (navigator as any).share({ title: story.title, url });
                    } catch {}
                  } else {
                    await navigator.clipboard.writeText(url);
                    toast.success("Đã sao chép liên kết");
                  }
                }}
              >
                Chia sẻ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success("Đã sao chép liên kết");
                }}
              >
                Sao chép link
              </Button>
            </div>
          </div>

          <Card className="p-8 md:p-12 shadow-lg">
            <div 
              className="prose prose-lg max-w-none dark:prose-invert"
              style={{
                lineHeight: "1.8",
                fontSize: "1.125rem",
              }}
            >
              {getContentText().split("\n").map((paragraph, index) => (
                paragraph.trim() && (
                  <p key={index} className="mb-4">
                    {paragraph}
                  </p>
                )
              ))}
            </div>
          </Card>
          {/* Comments */}
          <section className="mt-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Bình luận ({comments.length})
            </h3>
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-muted-foreground">Hãy là người đầu tiên bình luận.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {c.user_name || 'Người dùng'} • {formatDate(c.created_at)}
                    </div>
                    <div>{c.content}</div>
                  </div>
                ))
              )}
              <div className="flex items-start gap-2">
                <textarea
                  className="flex-1 border rounded-md p-2 min-h-[80px] bg-background"
                  placeholder="Viết bình luận..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button onClick={submitComment}>Gửi</Button>
              </div>
            </div>
          </section>
        </article>

        {/* Related stories */}
        {relatedStories.length > 0 && (
          <section className="max-w-5xl mx-auto mt-12">
            <h2 className="text-2xl font-serif font-semibold mb-6">
              {story.content_type === 'story' ? 'Truyện khác' : 'Tin tức khác'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedStories.map((relatedStory) => (
                <UICard 
                  key={relatedStory.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" 
                  onClick={() => navigate(`/story/${relatedStory.id}`)}
                >
                  <div className="aspect-video bg-muted overflow-hidden">
                    {relatedStory.cover_image_url ? (
                      <img 
                        src={relatedStory.cover_image_url} 
                        alt={relatedStory.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {relatedStory.content_type === 'story' ? (
                          <BookOpen className="w-12 h-12 text-muted-foreground" />
                        ) : (
                          <Newspaper className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {relatedStory.content_type === 'story' ? 'Truyện' : 'Tin tức'}
                    </Badge>
                    <h3 className="font-medium line-clamp-2 mb-2">{relatedStory.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {relatedStory.profiles?.full_name || "Ẩn danh"}
                    </p>
                  </div>
                </UICard>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom audio bar demo (always visible) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur p-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleAudio}
              className="shrink-0"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <div className="flex-1">
              <div className="text-sm font-medium mb-1 line-clamp-1">{story?.title || 'Đang phát audio'}</div>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                value={Math.min(position, Math.max(1, duration))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  audio.currentTime = v;
                  setPosition(v);
                }}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[1, 1.5, 2].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={speed === s ? 'default' : 'outline'}
                  onClick={() => {
                    setSpeed(s);
                    audio.playbackRate = s;
                  }}
                >
                  {s}x
                </Button>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
};

export default StoryDetail;

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const mPart = Math.floor(s / 60).toString().padStart(2, '0');
  const sPart = (s % 60).toString().padStart(2, '0');
  return `${mPart}:${sPart}`;
}
