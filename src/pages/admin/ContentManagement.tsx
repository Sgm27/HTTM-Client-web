import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Eye, Heart, MessageCircle, Ban, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoryDetail {
  id: string;
  title: string;
  author_name: string | null;
  author_email: string | null;
  status: string | null;
  view_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string | null;
}

export default function ContentManagement() {
  const [stories, setStories] = useState<StoryDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStory, setSelectedStory] = useState<StoryDetail | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"published" | "draft" | "rejected">("published");
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchStories();
  }, [statusFilter]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("admin_story_details")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error("Error fetching stories:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách truyện",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedStory) return;

    try {
      // @ts-ignore - Types will be updated later
      const { error } = await supabase.rpc("admin_update_story_status", {
        p_story_id: selectedStory.id,
        p_new_status: newStatus,
        p_reason: rejectionReason || null,
      });

      if (error) throw error;

      toast({
        title: "Thành công",
        description: `Trạng thái truyện đã được cập nhật thành ${newStatus === "published" ? "đã xuất bản" : newStatus === "draft" ? "bản nháp" : "từ chối"}`,
      });

      setStatusDialogOpen(false);
      setRejectionReason("");
      fetchStories();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái truyện",
        variant: "destructive",
      });
    }
  };

  const filteredStories = stories.filter((story) =>
    story.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.author_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-600">Đã xuất bản</Badge>;
      case "draft":
        return <Badge variant="secondary">Bản nháp</Badge>;
      case "rejected":
        return <Badge variant="destructive">Từ chối</Badge>;
      default:
        return <Badge variant="outline">Không rõ</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải nội dung...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quản lý nội dung</h1>
        <p className="text-gray-500 mt-1">Xem xét và kiểm duyệt nội dung do người dùng tạo</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm truyện theo tiêu đề hoặc tác giả..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Lọc theo trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="published">Đã xuất bản</SelectItem>
                <SelectItem value="draft">Bản nháp</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Tác giả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lượt xem</TableHead>
                <TableHead>Lượt thích</TableHead>
                <TableHead>Bình luận</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStories.map((story) => (
                <TableRow key={story.id}>
                  <TableCell className="font-medium">{story.title}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{story.author_name || "Không rõ"}</p>
                      <p className="text-xs text-gray-500">{story.author_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(story.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Eye className="h-4 w-4 text-gray-400" />
                      <span>{story.view_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Heart className="h-4 w-4 text-gray-400" />
                      <span>{story.likes_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="h-4 w-4 text-gray-400" />
                      <span>{story.comments_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {story.created_at
                      ? new Date(story.created_at).toLocaleDateString("vi-VN")
                      : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {story.status !== "published" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStory(story);
                            setNewStatus("published");
                            setStatusDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Phê duyệt
                        </Button>
                      )}
                      {story.status !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStory(story);
                            setNewStatus("rejected");
                            setStatusDialogOpen(true);
                          }}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Từ chối
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Change Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái truyện</DialogTitle>
            <DialogDescription>
              Thay đổi trạng thái cho "{selectedStory?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Trạng thái mới</label>
              <Select
                value={newStatus}
                onValueChange={(value: "published" | "draft" | "rejected") =>
                  setNewStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Đã xuất bản</SelectItem>
                  <SelectItem value="draft">Bản nháp</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newStatus === "rejected" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Lý do từ chối (Tùy chọn)</label>
                <Textarea
                  placeholder="Giải thích lý do truyện này bị từ chối..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleUpdateStatus}>Cập nhật trạng thái</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
