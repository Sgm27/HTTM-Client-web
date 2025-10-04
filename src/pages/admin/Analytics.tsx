import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, FileText, Eye, Heart } from "lucide-react";

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch dashboard stats
      const { data: statsData } = await supabase
        .from("admin_dashboard_stats")
        .select("*")
        .single();

      setStats(statsData);

      // Fetch recent activity - top stories
      const { data: topStories } = await supabase
        .from("admin_story_details")
        .select("*")
        .order("view_count", { ascending: false })
        .limit(10);

      setRecentActivity(topStories || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải phân tích...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Phân tích & Báo cáo</h1>
        <p className="text-gray-500 mt-1">Thông tin chi tiết và thống kê về nền tảng của bạn</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng người dùng
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              +{stats?.new_users_this_week || 0} tuần này
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Truyện đã xuất bản
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_published_stories || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              +{stats?.new_stories_this_week || 0} tuần này
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng lượt xem
            </CardTitle>
            <Eye className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_views || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.total_story_views || 0} lượt xem duy nhất
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng lượt thích
            </CardTitle>
            <Heart className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_likes || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Trên tất cả truyện</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Top 10 truyện có nhiều lượt xem nhất
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((story, index) => (
              <div
                key={story.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{story.title}</p>
                    <p className="text-sm text-gray-500">
                      bởi {story.author_name || "Không rõ"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{story.view_count || 0}</p>
                  <p className="text-xs text-gray-500">lượt xem</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Phân loại nội dung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Đã xuất bản</span>
                <span className="text-lg font-semibold text-green-600">
                  {stats?.total_published_stories || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Bản nháp</span>
                <span className="text-lg font-semibold text-yellow-600">
                  {stats?.total_draft_stories || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Từ chối</span>
                <span className="text-lg font-semibold text-red-600">
                  {stats?.total_rejected_stories || 0}
                </span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Tổng cộng</span>
                  <span className="text-lg font-bold">
                    {(stats?.total_published_stories || 0) +
                      (stats?.total_draft_stories || 0) +
                      (stats?.total_rejected_stories || 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chỉ số tương tác</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tổng lượt thích</span>
                <span className="text-lg font-semibold">{stats?.total_likes || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tổng bình luận</span>
                <span className="text-lg font-semibold">{stats?.total_comments || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Phiên nghe</span>
                <span className="text-lg font-semibold">{stats?.total_listens || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Thẻ tag đang hoạt động</span>
                <span className="text-lg font-semibold">{stats?.total_tags || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
