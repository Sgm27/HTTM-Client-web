import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pause, Play } from 'lucide-react';

interface AudioPlayerProps {
  src?: string;
  emptyMessage?: string;
}

const SPEED_OPTIONS = [1, 1.5, 2] as const;

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '00:00';
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const AudioPlayer = ({ src, emptyMessage }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSpeed(1);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = 1;
      if (src) {
        audio.load();
      }
    }
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
    }
  }, [speed]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const [time] = value;
    if (typeof time === 'number' && Number.isFinite(time)) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeedChange = (value: number) => {
    setSpeed(value);
  };

  const disabled = !src;
  const sliderMax = duration > 0 ? duration : 1;
  const sliderValue = duration > 0 ? currentTime : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-4 lg:px-0">
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              disabled={disabled}
              className="h-12 w-12 rounded-full border-border bg-background shadow-sm"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <div className="flex-1">
              <Slider
                value={[sliderValue]}
                max={sliderMax}
                step={0.1}
                onValueChange={handleSeek}
                disabled={disabled || duration <= 0}
                className="cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tốc độ phát
            </span>
            <div className="flex gap-2">
              {SPEED_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={speed === option ? 'default' : 'outline'}
                  className="rounded-full px-3"
                  onClick={() => handleSpeedChange(option)}
                  disabled={disabled}
                >
                  {option}x
                </Button>
              ))}
            </div>
          </div>
        </div>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? 'Audio sẽ tự động xuất hiện sau khi xử lý xong.'}
          </p>
        )}
      </div>
    </div>
  );
};
