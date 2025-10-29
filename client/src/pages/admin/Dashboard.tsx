import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Eye, Heart, Headphones, MessageCircle, Tag, AlertCircle } from "lucide-react";
import { Views } from "@/integrations/supabase/types";

type DashboardStats = Views<"admin_dashboard_stats">;

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from("admin_dashboard_stats")
          .select("*")
          .single();

        if (error) throw error;
        setStats(data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải thống kê...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Tổng người dùng",
      value: stats?.total_users || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      subtitle: `+${stats?.new_users_this_week || 0} tuần này`,
    },
    {
      title: "Truyện đã xuất bản",
      value: stats?.total_published_stories || 0,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: `+${stats?.new_stories_this_week || 0} tuần này`,
    },
    {
      title: "Tổng lượt xem",
      value: stats?.total_views || 0,
      icon: Eye,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      subtitle: `${stats?.total_story_views || 0} lượt xem duy nhất`,
    },
    {
      title: "Tổng lượt thích",
      value: stats?.total_likes || 0,
      icon: Heart,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Phiên nghe",
      value: stats?.total_listens || 0,
      icon: Headphones,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
    {
      title: "Bình luận",
      value: stats?.total_comments || 0,
      icon: MessageCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Thẻ tag",
      value: stats?.total_tags || 0,
      icon: Tag,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100",
    },
    {
      title: "Báo cáo chờ xử lý",
      value: stats?.pending_reports || 0,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  const contentStats = [
    { label: "Đã xuất bản", value: stats?.total_published_stories || 0, color: "text-green-600" },
    { label: "Bản nháp", value: stats?.total_draft_stories || 0, color: "text-yellow-600" },
    { label: "Từ chối", value: stats?.total_rejected_stories || 0, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">Tổng quan thống kê ứng dụng của bạn</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stat.value.toLocaleString()}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trạng thái nội dung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contentStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-600">{stat.label}</span>
                  <span className={`text-lg font-semibold ${stat.color}`}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thống kê nhanh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Người dùng hoạt động</span>
                <span className="text-lg font-semibold text-gray-900">
                  {stats?.total_profiles || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Người dùng mới (7 ngày)</span>
                <span className="text-lg font-semibold text-green-600">
                  +{stats?.new_users_this_week || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Truyện mới (7 ngày)</span>
                <span className="text-lg font-semibold text-blue-600">
                  +{stats?.new_stories_this_week || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions */}
      {(stats?.pending_reports || 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              Cần xử lý
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              Bạn có {stats?.pending_reports} báo cáo nội dung đang chờ xử lý.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
