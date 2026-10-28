import { useState, useRef, useEffect } from "react";
import { Play, Pause, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsAppAudioPlayerProps {
  url: string;
  isOutgoing?: boolean;
}

export function WhatsAppAudioPlayer({ url, isOutgoing = false }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformBars] = useState(() => 
    Array.from({ length: 28 }, () => Math.random() * 0.6 + 0.2)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const activeBarIndex = Math.floor((progress / 100) * waveformBars.length);

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg min-w-[260px] ${
      isOutgoing ? 'bg-transparent' : 'bg-transparent'
    }`}>
      <audio ref={audioRef} src={url} preload="metadata" />
      
      {/* Orange Headphone Circle with Duration */}
      <div className="relative flex-shrink-0">
        <div className="h-12 w-12 rounded-full bg-[#FF8C00] flex items-center justify-center shadow-md">
          <Headphones className="h-6 w-6 text-white" />
        </div>
        {/* Duration badge */}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#FF8C00] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
          {formatTime(duration || 0)}
        </span>
      </div>

      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-10 w-10 rounded-full bg-white shadow-md flex-shrink-0 hover:bg-gray-50"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-gray-700 fill-current" />
        ) : (
          <Play className="h-5 w-5 text-gray-700 fill-current ml-0.5" />
        )}
      </Button>

      {/* Waveform Visualization with Progress Dot */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative flex items-center gap-[2px] h-6">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-100 ${
                i < activeBarIndex
                  ? 'bg-[#FF8C00]'
                  : isOutgoing ? 'bg-[#8BC5BC]' : 'bg-gray-300'
              }`}
              style={{ height: `${height * 24}px` }}
            />
          ))}
          {/* Progress Dot */}
          <div 
            className="absolute h-3.5 w-3.5 rounded-full bg-[#FF8C00] shadow-md border-2 border-white top-1/2 -translate-y-1/2 transition-all duration-100"
            style={{ left: `${Math.min(progress, 100)}%` }}
          />
        </div>
        
        {/* Time Display */}
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
}
