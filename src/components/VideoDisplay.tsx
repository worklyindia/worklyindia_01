import { useState, useRef, useEffect } from "react";
import { YouTubeVideoCard } from "./YouTubeVideoCard";

interface VideoDisplayProps {
  videos: Array<{ title?: string; url: string }>;
}

const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const VideoDisplay = ({ videos }: VideoDisplayProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const validVideos = videos.filter(video => video.url && extractYouTubeId(video.url));
  
  // Handle scroll to update active dot
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || validVideos.length <= 1) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const itemWidth = container.offsetWidth * 0.85; // Approximate card width
      const newIndex = Math.round(scrollLeft / itemWidth);
      setActiveIndex(Math.min(newIndex, validVideos.length - 1));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [validVideos.length]);

  if (validVideos.length === 0) {
    return null;
  }

  // Single video - full width, centered
  if (validVideos.length === 1) {
    return (
      <div className="mb-4 flex justify-center">
        <div className="w-full max-w-lg">
          <YouTubeVideoCard 
            url={validVideos[0].url} 
            title={validVideos[0].title} 
          />
        </div>
      </div>
    );
  }

  // Multiple videos - horizontal scroll with dots, properly centered
  return (
    <div className="mb-4">
      {/* Scrollable Video Container */}
      <div className="w-full">
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-3 px-4 snap-x snap-mandatory scroll-smooth scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          style={{ scrollPaddingInline: '16px' }}
        >
          {validVideos.map((video, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[80vw] max-w-[380px] snap-center"
            >
              <YouTubeVideoCard 
                url={video.url} 
                title={video.title} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dot Pagination Indicator */}
      <div className="flex justify-center gap-1.5 mt-3">
        {validVideos.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              const container = scrollContainerRef.current;
              if (container) {
                const itemWidth = container.querySelector('.flex-shrink-0')?.clientWidth || 300;
                container.scrollTo({
                  left: index * (itemWidth + 16), // 16 is the gap
                  behavior: 'smooth'
                });
              }
              setActiveIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === activeIndex 
                ? 'bg-primary w-4' 
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`Go to video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoDisplay;
