import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StoryStatsDAO } from "@/dao/StoryStatsDAO";
import { StoryDetailStatistics } from "@/types/entities/StoryStatistics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Eye, 
  Heart, 
  MessageCircle, 
  Headphones, 
  Bookmark,
  Clock,
  Calendar,
  User,
  Tag,
  TrendingUp
} from "lucide-react";

export default function StoryStatsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StoryDetailStatistics | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [listens, setListens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStoryStats(id);
    }
  }, [id]);

  const fetchStoryStats = async (storyId: string) => {
    setLoading(true);
    try {
      const { data: statsData, error: statsError } = await StoryStatsDAO.getStoryDetailStats(storyId);
      const { data: commentsData } = await StoryStatsDAO.getStoryComments(storyId);
      const { data: listensData } = await StoryStatsDAO.getStoryListenHistory(storyId);

      if (statsError) {
        console.error("Error fetching story stats:", statsError);
      } else {
        setStats(statsData);
        setComments(commentsData || []);
        setListens(listensData || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}g ${minutes}p ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}p ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      published: { label: "Đã xuất bản", variant: "default" },
      draft: { label: "Bản nháp", variant: "secondary" },
      rejected: { label: "Từ chối", variant: "destructive" },
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant as any}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải thống kê chi tiết...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/story-stats")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>
        <div className="text-center py-8 text-gray-500">
          Không tìm thấy dữ liệu thống kê cho truyện này
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate("/admin/story-stats")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Quay lại danh sách
      </Button>

      {/* Story Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {stats.story.cover_image_url && (
              <img
                src={stats.story.cover_image_url}
                alt={stats.story.title}
                className="w-32 h-48 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{stats.story.title}</h1>
                {getStatusBadge(stats.story.status)}
              </div>
              <p className="text-gray-600 mb-4">{stats.story.description}</p>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{stats.author.full_name || "Không rõ"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(stats.story.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng lượt xem
            </CardTitle>
            <Eye className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.total_views.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.stats.unique_views.toLocaleString()} độc lập
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Lượt thích
            </CardTitle>
            <Heart className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.total_likes.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Bình luận
            </CardTitle>
            <MessageCircle className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.total_comments.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Lượt nghe
            </CardTitle>
            <Headphones className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.total_listens.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Bookmark
            </CardTitle>
            <Bookmark className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stats.total_bookmarks.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Thời gian nghe
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(stats.stats.total_listening_time / 3600)}
            </div>
            <p className="text-xs text-gray-500 mt-1">giờ</p>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      {stats.tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Tag className="h-5 w-5 mr-2" />
              Thẻ tag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="views" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="views">Lịch sử xem</TabsTrigger>
          <TabsTrigger value="readers">Top người đọc</TabsTrigger>
          <TabsTrigger value="chart">Biểu đồ theo ngày</TabsTrigger>
          <TabsTrigger value="listens">Lịch sử nghe</TabsTrigger>
        </TabsList>

        {/* Recent Views Tab */}
        <TabsContent value="views" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lượt xem gần đây (20 lượt mới nhất)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recent_views.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Chưa có lượt xem nào</p>
                ) : (
                  stats.recent_views.map((view) => (
                    <div key={view.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{view.user_name || "Khách"}</span>
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(view.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Readers Tab */}
        <TabsContent value="readers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 người đọc nhiều nhất</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.top_readers.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Chưa có dữ liệu</p>
                ) : (
                  stats.top_readers.map((reader, index) => (
                    <div key={reader.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{reader.user_name || "Không rõ"}</p>
                          <p className="text-xs text-gray-500">{reader.user_email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatSeconds(reader.total_reading_time)}</p>
                        <p className="text-xs text-gray-500">{reader.total_views} lần xem</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Views by Date Chart */}
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Thống kê xem theo ngày (7 ngày gần nhất)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.views_by_date.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Chưa có dữ liệu trong 7 ngày qua</p>
                ) : (
                  stats.views_by_date.map((item) => (
                    <div key={item.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{item.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500"
                            style={{ 
                              width: `${Math.min((item.views_count / Math.max(...stats.views_by_date.map(v => v.views_count))) * 100, 100)}%` 
                            }}
                          />
                        </div>
                        <span className="font-semibold text-blue-600 w-12 text-right">
                          {item.views_count}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listen History Tab */}
        <TabsContent value="listens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử nghe gần đây</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {listens.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Chưa có lượt nghe nào</p>
                ) : (
                  listens.map((listen) => (
                    <div key={listen.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Headphones className="h-4 w-4 text-green-400" />
                        <div>
                          <p className="font-medium">{listen.user_name || "Khách"}</p>
                          <p className="text-xs text-gray-500">
                            Đã nghe: {formatSeconds(listen.listened_seconds)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(listen.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
