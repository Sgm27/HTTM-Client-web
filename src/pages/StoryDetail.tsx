import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as UICard } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Clock, Eye, Volume2, VolumeX, BookOpen, Newspaper, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface StoryData {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  cover_image_url: string | null;
  view_count: number;
  created_at: string;
  author_id: string;
  profiles: {
    full_name: string | null;
  } | null;
}

interface AudioData {
  id: string;
  audio_url: string;
  generation_status: string;
  audio_duration: number | null;
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
  const [relatedStories, setRelatedStories] = useState<StoryData[]>([]);

  useEffect(() => {
    if (id) {
      fetchStory();
      incrementViewCount();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio]);

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
        .single();

      if (audioData) {
        setAudioData(audioData);
        audio.src = audioData.audio_url;
        audio.onended = () => setIsPlaying(false);
      }

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
            <div className="flex gap-2 mb-8">
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
    </div>
  );
};

export default StoryDetail;
