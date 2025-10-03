import Home from "./Home";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [continueList, setContinueList] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("reading_history")
        .select("story_id, last_position_seconds, last_accessed_at")
        .eq("user_id", user.id)
        .order("last_accessed_at", { ascending: false })
        .limit(6);
      if (!error && data && data.length) {
        const ids = data.map((r) => r.story_id);
        const { data: stories } = await supabase
          .from("stories_with_stats")
          .select("*")
          .in("id", ids);
        setContinueList(stories || []);
      }
    };
    load();
  }, []);

  return (
    <>
      {continueList.length > 0 && (
        <section className="container py-8">
          <h2 className="text-2xl font-serif font-semibold mb-4">Tiếp tục nghe/đọc</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {continueList.map((s) => (
              <Card key={s.id} className="overflow-hidden cursor-pointer" onClick={() => navigate(`/story/${s.id}`)}>
                <div className="aspect-video bg-muted overflow-hidden">
                  {(s.thumbnail_url || s.cover_image_url) ? (
                    <img src={s.thumbnail_url || s.cover_image_url} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-medium line-clamp-2">{s.title}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
      <Home />
    </>
  );
};

export default Index;
