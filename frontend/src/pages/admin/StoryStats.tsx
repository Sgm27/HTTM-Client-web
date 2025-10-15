import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StoryStatsDAO } from "@/dao/StoryStatsDAO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Headphones, 
  Bookmark, 
  TrendingUp,
  Search,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StoryStats() {
  const navigate = useNavigate();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const { data, error } = await StoryStatsDAO.getStoriesWithStats(100);
      if (error) {
        console.error("Error fetching stories:", error);
      } else {
        setStories(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchStories();
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await StoryStatsDAO.searchStoriesByTitle(searchTerm);
      if (error) {
        console.error("Error searching stories:", error);
      } else {
        setStories(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleViewDetail = (storyId: string) => {
    navigate(`/admin/story-stats/${storyId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
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
        <div className="text-lg">Đang tải dữ liệu thống kê...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Thống kê truyện</h1>
        <p className="text-gray-500 mt-1">
          Xem chi tiết thống kê lượt xem, tương tác và hiệu suất của từng truyện
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên truyện..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? "Đang tìm..." : "Tìm kiếm"}
            </Button>
            <Button variant="outline" onClick={fetchStories}>
              Tải lại
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng truyện
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stories.length}</div>
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
            <div className="text-2xl font-bold">
              {stories.reduce((sum, story) => sum + (story.view_count || 0), 0).toLocaleString()}
            </div>
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
            <div className="text-2xl font-bold">
              {stories.reduce((sum, story) => sum + (story.likes_count || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng bình luận
            </CardTitle>
            <MessageCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stories.reduce((sum, story) => sum + (story.comments_count || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stories List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách truyện (Sắp xếp theo lượt xem)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Không tìm thấy truyện nào
              </div>
            ) : (
              stories.map((story, index) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => handleViewDetail(story.id)}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-full font-semibold">
                      {index + 1}
                    </div>

                    {/* Story Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {story.title}
                        </h3>
                        {getStatusBadge(story.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {story.author_name || "Không rõ"} • {formatDate(story.created_at)}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6">
                      <div className="flex items-center gap-1 text-sm">
                        <Eye className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{(story.view_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Heart className="h-4 w-4 text-red-400" />
                        <span className="font-medium">{(story.likes_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <MessageCircle className="h-4 w-4 text-blue-400" />
                        <span className="font-medium">{(story.comments_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Headphones className="h-4 w-4 text-green-400" />
                        <span className="font-medium">{(story.listens_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Bookmark className="h-4 w-4 text-yellow-400" />
                        <span className="font-medium">{(story.bookmarks_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-gray-400 ml-4" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
