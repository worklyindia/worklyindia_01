import { useState, useEffect, useMemo, useRef } from "react";
import {
  subscribeActiveVideo,
  setActiveVideo,
  clearActiveVideo,
} from "@/lib/activeVideoPlayer";
import { Play, Youtube, Eye, ThumbsUp, Clock, MessageCircle, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useYouTubeAPI } from "@/hooks/useYouTubeAPI";
import { audioManager } from "@/services/GlobalAudioManager";
import { Button } from "@/components/ui/button";
import { NativeBottomSheet } from "@/components/NativeBottomSheet";

interface YouTubeVideoCardProps {
  url: string;
  title?: string;
  /** When false, renders only the player/thumbnail with no title, stats or description block. */
  showDetails?: boolean;
}

const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const formatViewCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

const formatDuration = (duration: string): string => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatPublishedDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

// Helper function to make links, phones, emails, hashtags clickable - fixed duplicate issue
const linkifyDescription = (text: string): React.ReactNode[] => {
  // Combined pattern with SINGLE capturing group - no nested groups to avoid duplicates
  const combinedRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|#[a-zA-Z0-9_\u0900-\u097F]+|(?:\+91[\s-]?)?[6-9]\d{9})/gi;
  
  const parts = text.split(combinedRegex);
  
  return parts.map((part, index) => {
    if (!part || part.trim() === '') return null;
    
    // URL check - create NEW regex each time (no lastIndex issue)
    if (/^https?:\/\//i.test(part)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // Email check
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(part)) {
      return (
        <a 
          key={index} 
          href={`mailto:${part}`}
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // Hashtag check (including Hindi characters)
    if (/^#[a-zA-Z0-9_\u0900-\u097F]+$/.test(part)) {
      return (
        <span key={index} className="text-blue-600">
          {part}
        </span>
      );
    }
    
    // Phone number check - Indian mobile format
    const phoneDigits = part.replace(/\D/g, '');
    if (phoneDigits.length >= 10 && phoneDigits.length <= 13 && /^[6-9]/.test(phoneDigits.slice(-10))) {
      return (
        <a 
          key={index} 
          href={`tel:${phoneDigits}`}
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    return <span key={index}>{part}</span>;
  }).filter(Boolean);
};

export function YouTubeVideoCard({ url, title: fallbackTitle, showDetails = true }: YouTubeVideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playerKey = useRef(
    `ytcard-${Math.random().toString(36).slice(2)}`,
  ).current;
  const [videoData, setVideoData] = useState<{
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    channelId: string;
    duration: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    publishedAt: string;
    tags: string[];
  } | null>(null);
  const [channelThumbnail, setChannelThumbnail] = useState<string | null>(null);
  const [channelThumbError, setChannelThumbError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const { getVideoDetails, getChannelInfo } = useYouTubeAPI();

  const videoId = extractYouTubeId(url);

  useEffect(() => {
    if (!videoId) {
      setIsLoading(false);
      return;
    }

    const fetchVideoData = async () => {
      try {
        const details = await getVideoDetails(videoId);
        setVideoData({
          title: details.title,
          description: details.description,
          thumbnail: details.thumbnail,
          channelTitle: details.channelTitle,
          channelId: details.channelId,
          duration: details.duration,
          viewCount: details.statistics.viewCount,
          likeCount: details.statistics.likeCount,
          commentCount: details.statistics.commentCount,
          publishedAt: details.publishedAt,
          tags: details.tags || []
        });

        // Fetch channel info for thumbnail
        if (details.channelId) {
          try {
            const channelInfo = await getChannelInfo(details.channelId);
            setChannelThumbnail(channelInfo.thumbnail);
          } catch (e) {
            console.log('Could not fetch channel thumbnail');
          }
        }
      } catch (error) {
        console.error('Failed to fetch YouTube video details:', error);
        setVideoData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoData();
  }, [videoId]);

  useEffect(() => {
    if (!isPlaying) return;
    audioManager.onVideoPlay(playerKey);
    return () => audioManager.onVideoStop(playerKey);
  }, [isPlaying, playerKey]);

  // Only one video at a time — stop this one when another player starts.
  useEffect(() => {
    const unsubscribe = subscribeActiveVideo((activeKey) => {
      if (activeKey !== playerKey) {
        setIsPlaying(false);
      }
    });
    return () => {
      unsubscribe();
      clearActiveVideo(playerKey);
    };
  }, [playerKey]);

  if (!videoId) return null;

  const handleVideoClick = () => {
    if (isPlaying) {
      setIsPlaying(false);
      clearActiveVideo(playerKey);
      return;
    }
    // YouTube owns audio permission. Preserve the user's synchronous gesture.
    setActiveVideo(playerKey);
    setIsPlaying(true);
  };

  if (isLoading) {
    if (!showDetails) {
      return (
        <div className="rounded-xl overflow-hidden bg-card border">
          <Skeleton className="aspect-video w-full" />
        </div>
      );
    }
    return (
      <div className="rounded-xl overflow-hidden bg-card border">
        <Skeleton className="aspect-video w-full" />
        <div className="p-4 space-y-3">
          <div className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const displayTitle = videoData?.title || fallbackTitle || "Job Video";
  // Always use img.youtube.com - bypasses referrer blocking on custom domains (e.g. Vercel)
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;


  return (
    <div className="rounded-xl overflow-hidden bg-card border shadow-sm">
      
      {/* Video Player / Thumbnail - No black bars, natural aspect ratio */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {isPlaying ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&fs=1&iv_load_policy=3`}
            title={displayTitle}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            aria-label={`Play ${displayTitle}`}
            className="w-full h-full p-0 rounded-none cursor-pointer group relative block"
            onClick={handleVideoClick}
          >
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ color: 'transparent' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src.includes('hqdefault')) {
                  img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                } else if (img.src.includes('mqdefault')) {
                  img.src = `https://img.youtube.com/vi/${videoId}/default.jpg`;
                } else {
                  // Final fallback: hide broken image icon
                  img.style.visibility = 'hidden';
                }
              }}
            />
            
            {/* Duration Badge - Bottom Right */}
            {videoData?.duration && (
              <div className="absolute bottom-2 right-2 bg-black/90 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                {formatDuration(videoData.duration)}
              </div>
            )}
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition-colors">
              <div className="bg-red-600 rounded-full p-3 sm:p-4 group-hover:scale-110 transition-transform shadow-xl opacity-90 group-hover:opacity-100">
                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white" />
              </div>
            </div>

            {/* YouTube Watermark */}
            <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
          </Button>
        )}
      </div>

      {/* Video Info Section - YouTube Style */}
      {showDetails && (
      <div className="p-3 sm:p-4">
        {/* Channel + Title Row */}
        <div className="flex gap-3">
          {/* Channel Thumbnail */}
          <div className="flex-shrink-0">
            {channelThumbnail && !channelThumbError ? (
              <img loading="lazy" decoding="async" 
                src={channelThumbnail} 
                alt=""
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                style={{ color: 'transparent' }}
                onError={(e) => {
                  // Hide broken icon immediately before React re-renders
                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                  setChannelThumbError(true);
                }}
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-600 flex items-center justify-center">
                <Youtube className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          {/* Title + Channel Name */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-2 text-sm sm:text-base leading-snug">
              {displayTitle}
            </h3>
            {videoData?.channelTitle && (
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 truncate">
                {videoData.channelTitle}
              </p>
            )}
          </div>
        </div>

        {/* Stats Row - Views, Likes, Comments */}
        {videoData && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{formatViewCount(videoData.viewCount)} views</span>
            </div>
            <span className="text-muted-foreground/50">•</span>
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{formatViewCount(videoData.likeCount)}</span>
            </div>
            <span className="text-muted-foreground/50">•</span>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{formatViewCount(videoData.commentCount)}</span>
            </div>
          </div>
        )}

        {/* Description with Clickable Links */}
        {videoData?.description && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
              {linkifyDescription(videoData.description)}
            </div>
            {videoData.description.length > 150 && (
              <button 
                onClick={() => setShowFullDescription(true)}
                className="text-xs text-primary font-medium mt-1.5 active:scale-95 transition-transform duration-150"
              >
                Show more
              </button>
            )}

            <NativeBottomSheet
              isOpen={showFullDescription}
              onClose={() => setShowFullDescription(false)}
              height="half"
            >
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {linkifyDescription(videoData.description)}
              </div>
            </NativeBottomSheet>
          </div>
        )}

        {/* Published Date with Relative Time */}
        {videoData && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Published: {new Date(videoData.publishedAt).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })} • {formatPublishedDate(videoData.publishedAt)}</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
