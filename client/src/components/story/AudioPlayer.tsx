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
    <div className="rounded-lg border p-4 space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={togglePlayback} disabled={disabled}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <Slider
                value={[sliderValue]}
                max={sliderMax}
                step={0.1}
                onValueChange={handleSeek}
                disabled={disabled || duration <= 0}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 lg:w-auto">
            <div className="text-xs sm:text-sm text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="flex gap-2">
              {SPEED_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={speed === option ? 'default' : 'outline'}
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
