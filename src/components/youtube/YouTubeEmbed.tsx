import { useState, useEffect } from 'react';
import { useYouTubeAPI } from '@/hooks/useYouTubeAPI';
import { Skeleton } from '@/components/ui/skeleton';

interface YouTubeEmbedProps {
  videoId: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  className?: string;
}

export function YouTubeEmbed({ 
  videoId, 
  width = 560, 
  height = 315, 
  autoplay = false,
  className = ''
}: YouTubeEmbedProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const { getEmbedInfo, loading } = useYouTubeAPI();

  useEffect(() => {
    if (videoId) {
      getEmbedInfo(videoId)
        .then(embed => {
          let url = embed.embedUrl;
          if (autoplay) url += '?autoplay=1';
          setEmbedUrl(url);
        })
        .catch(() => {
          // Fallback to direct embed URL
          setEmbedUrl(`https://www.youtube.com/embed/${videoId}${autoplay ? '?autoplay=1' : ''}`);
        });
    }
  }, [videoId, autoplay]);

  if (loading || !embedUrl) {
    return <Skeleton className={`${className}`} style={{ width, height }} />;
  }

  return (
    <iframe
      width={width}
      height={height}
      src={embedUrl}
      className={`rounded-lg ${className}`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
