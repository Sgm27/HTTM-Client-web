import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  src?: string;
}

export const AudioPlayer = ({ src }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    const level = value[0] ?? 0.8;
    setVolume(level);
    if (audio) {
      audio.volume = level;
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} preload="metadata" />
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={togglePlayback} disabled={!src}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2 w-full">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider value={[volume]} max={1} step={0.05} onValueChange={handleVolumeChange} className="w-full" />
        </div>
      </div>
    </div>
  );
};
