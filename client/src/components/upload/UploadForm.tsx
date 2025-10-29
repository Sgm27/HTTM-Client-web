import { ChangeEvent, FormEvent } from 'react';
import { ContentType, Visibility } from '@/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface UploadFormState {
  contentType: ContentType;
  visibility: Visibility;
  title: string;
  description: string;
  contentFile: File | null;
  thumbnailFile: File | null;
}

interface UploadFormProps {
  state: UploadFormState;
  onStateChange: (next: Partial<UploadFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}

export const UploadForm = ({ state, onStateChange, onSubmit, loading }: UploadFormProps) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onStateChange({ contentFile: file });
  };

  const handleThumbnailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onStateChange({ thumbnailFile: file });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin upload</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contentType">Loại nội dung</Label>
              <Select
                name="contentType"
                value={state.contentType}
                onValueChange={(value) => onStateChange({ contentType: value as ContentType })}
              >
                <SelectTrigger id="contentType">
                  <SelectValue placeholder="Chọn loại nội dung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ContentType.TEXT}>Văn bản</SelectItem>
                  <SelectItem value={ContentType.COMIC}>Truyện tranh</SelectItem>
                  <SelectItem value={ContentType.NEWS}>Tin tức</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="visibility">Chế độ hiển thị</Label>
              <Select
                name="visibility"
                value={state.visibility}
                onValueChange={(value) => onStateChange({ visibility: value as Visibility })}
              >
                <SelectTrigger id="visibility">
                  <SelectValue placeholder="Chọn chế độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Visibility.PUBLIC}>Công khai</SelectItem>
                  <SelectItem value={Visibility.PRIVATE}>Riêng tư</SelectItem>
                  <SelectItem value={Visibility.UNLISTED}>Không công khai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Tiêu đề</Label>
            <Input
              id="title"
              name="title"
              value={state.title}
              onChange={(event) => onStateChange({ title: event.target.value })}
              placeholder="Nhập tiêu đề câu chuyện"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              name="description"
              value={state.description}
              onChange={(event) => onStateChange({ description: event.target.value })}
              placeholder="Mô tả ngắn gọn về nội dung"
            />
          </div>

          <div>
            <Label htmlFor="contentFile">File nội dung</Label>
            <Input
              id="contentFile"
              name="contentFile"
              type="file"
              accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              required
            />
            {state.contentFile && <p className="text-sm text-muted-foreground mt-2">{state.contentFile.name}</p>}
          </div>

          <div>
            <Label htmlFor="thumbnailFile">Ảnh thumbnail</Label>
            <Input
              id="thumbnailFile"
              name="thumbnailFile"
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
            />
            {state.thumbnailFile && <p className="text-sm text-muted-foreground mt-2">{state.thumbnailFile.name}</p>}
          </div>

          <Button id="btnSubmit" name="btnSubmit" type="submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Tải lên'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
