import { useState } from 'react';
import { useYouTubeAPI } from '@/hooks/useYouTubeAPI';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Play, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface YouTubeSearchProps {
  onSelect?: (videoId: string, title: string, thumbnail: string) => void;
  defaultQuery?: string;
  maxResults?: number;
}

export function YouTubeSearch({ onSelect, defaultQuery = '', maxResults = 6 }: YouTubeSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<any[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const { searchVideos, loading, error } = useYouTubeAPI();

  const handleSearch = async (pageToken?: string) => {
    if (!query.trim()) return;
    
    try {
      const data = await searchVideos(query, maxResults, pageToken);
      if (pageToken) {
        setResults(prev => [...prev, ...data.items]);
      } else {
        setResults(data.items);
      }
      setNextPageToken(data.nextPageToken);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search YouTube videos..."
          className="flex-1"
        />
        <Button onClick={() => handleSearch()} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LottieSearchIcon size={16} />}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((video) => (
          <Card 
            key={video.videoId} 
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onSelect?.(video.videoId, video.title, video.thumbnail)}
          >
            <div className="relative aspect-video">
              <img loading="lazy" decoding="async" 
                src={video.thumbnail} 
                alt={video.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardContent className="p-3">
              <h3 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h3>
              <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {nextPageToken && results.length > 0 && (
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => handleSearch(nextPageToken)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
