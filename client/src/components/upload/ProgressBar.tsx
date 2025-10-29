import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  progress: number;
  statusLabel: string;
}

export const ProgressBar = ({ progress, statusLabel }: ProgressBarProps) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>Tiến độ OCR</span>
      <span>{statusLabel}</span>
    </div>
    <Progress value={progress} />
  </div>
);
