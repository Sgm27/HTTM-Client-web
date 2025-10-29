import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SavedItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  cover_image_url: string | null;
}

const Bookmarks = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_bookmarks')
          .select('story_id')
          .eq('user_id', user.id);
        const ids = (data || []).map((r: any) => r.story_id);
        if (ids.length === 0) {
          setItems([]);
          return;
        }
        const { data: stories } = await supabase
          .from('stories_with_stats')
          .select('id, title, thumbnail_url, cover_image_url')
          .in('id', ids);
        setItems((stories || []) as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <h1 className="text-3xl font-serif font-bold mb-6">Đánh dấu</h1>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Chưa có nội dung nào được đánh dấu.</p>
            <Button onClick={() => navigate('/')}>Khám phá nội dung</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((s) => (
              <Card key={s.id} className="overflow-hidden cursor-pointer" onClick={() => navigate(`/story/${s.id}`)}>
                <div className="aspect-video bg-muted overflow-hidden">
                  {(s.thumbnail_url || s.cover_image_url) ? (
                    <img src={s.thumbnail_url || s.cover_image_url!} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-medium line-clamp-2">{s.title}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Bookmarks;


