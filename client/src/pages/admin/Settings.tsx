import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TagType {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface AdminLog {
  id: string;
  action: string;
  admin_id: string | null;
  target_type: string | null;
  created_at: string | null;
}

export default function Settings() {
  const [tags, setTags] = useState<TagType[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("tags")
        .select("*")
        .order("name");

      if (tagsError) throw tagsError;
      setTags(tagsData || []);

      // Fetch recent admin logs
      const { data: logsData, error: logsError } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setLogs(logsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu cài đặt",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast({
        title: "Lỗi",
        description: "Tên thẻ không được để trống",
        variant: "destructive",
      });
      return;
    }

    try {
      const slug = newTagName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

      const { error } = await supabase
        .from("tags")
        .insert([{ name: newTagName.trim(), slug }] as any);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Thẻ đã được tạo thành công",
      });

      setNewTagName("");
      fetchData();
    } catch (error: any) {
      console.error("Error creating tag:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo thẻ",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa thẻ này không?")) return;

    try {
      const { error } = await supabase
        .from("tags")
        .delete()
        .eq("id", tagId);

      if (error) throw error;

      toast({
        title: "Thành công",
        description: "Thẻ đã được xóa thành công",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa thẻ",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải cài đặt...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cài đặt hệ thống</h1>
        <p className="text-gray-500 mt-1">Quản lý thẻ, danh mục và cấu hình hệ thống</p>
      </div>

      {/* Tag Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Quản lý thẻ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Nhập tên thẻ..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTag();
                  }
                }}
              />
              <Button onClick={handleCreateTag}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm thẻ
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm flex items-center space-x-2"
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {tags.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                Chưa có thẻ nào. Tạo thẻ đầu tiên ở trên.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động quản trị gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hành động</TableHead>
                <TableHead>Loại đối tượng</TableHead>
                <TableHead>ID quản trị viên</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.target_type || "N/A"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.admin_id ? log.admin_id.substring(0, 8) + "..." : "Hệ thống"}
                  </TableCell>
                  <TableCell>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString("vi-VN")
                      : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {logs.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              Chưa có nhật ký hoạt động quản trị.
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin hệ thống</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tổng số thẻ</span>
              <span className="font-semibold">{tags.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Hành động quản trị đã ghi</span>
              <span className="font-semibold">{logs.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Phiên bản cơ sở dữ liệu</span>
              <Badge>PostgreSQL 15</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Trạng thái nền tảng</span>
              <Badge className="bg-green-600">Hoạt động</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
