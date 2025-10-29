import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TTSOption } from '@/dtos';

interface ActionBarProps {
  onGenerateAudio: (option: TTSOption) => Promise<void>;
  onPublish?: () => Promise<void>;
  disabled?: boolean;
}

export const ActionBar = ({ onGenerateAudio, onPublish, disabled }: ActionBarProps) => {
  const [voice, setVoice] = useState<string>('default');
  const [speed, setSpeed] = useState<number>(1);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerateAudio({ voice, speed });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="voice">Giọng đọc</Label>
          <Input id="voice" value={voice} onChange={(event) => setVoice(event.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Tốc độ</Label>
          <Slider value={[speed]} min={0.5} max={2} step={0.1} onValueChange={(value) => setSpeed(value[0] ?? 1)} />
          <p className="text-xs text-muted-foreground">Tốc độ hiện tại: {speed.toFixed(1)}x</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleGenerate} disabled={disabled || generating}>
          {generating ? 'Đang tạo audio...' : 'Generate Audio'}
        </Button>
        {onPublish && (
          <Button variant="outline" onClick={handlePublish} disabled={disabled || publishing}>
            {publishing ? 'Đang publish...' : 'Publish'}
          </Button>
        )}
      </div>
    </div>
  );
};
