import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
}

interface YouTubeVideoDetails {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  tags: string[];
  duration: string;
  definition: string;
  statistics: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
  embedHtml?: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  thumbnail: string;
  country: string;
  publishedAt: string;
  statistics: {
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
  };
  bannerUrl?: string;
}

interface YouTubeEmbed {
  videoId: string;
  embedUrl: string;
  watchUrl: string;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    maxres: string;
  };
  iframeHtml: string;
}

interface SearchResult {
  totalResults: number;
  resultsPerPage: number;
  nextPageToken?: string;
  prevPageToken?: string;
  items: YouTubeVideo[];
}

export function useYouTubeAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAPI = async (payload: Record<string, any>) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('unified-youtube-api', {
        body: payload
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);
      
      return data;
    } catch (err: any) {
      const message = err.message || 'YouTube API error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const testAPI = async (): Promise<{ message: string; sample?: { title: string; channel: string } }> => {
    const result = await callAPI({ action: 'test' });
    return { message: result.message, sample: result.sample };
  };

  const searchVideos = async (query: string, maxResults = 10, pageToken?: string): Promise<SearchResult> => {
    const result = await callAPI({ action: 'search', query, maxResults, pageToken });
    return {
      totalResults: result.totalResults,
      resultsPerPage: result.resultsPerPage,
      nextPageToken: result.nextPageToken,
      prevPageToken: result.prevPageToken,
      items: result.items
    };
  };

  const getVideoDetails = async (videoId: string): Promise<YouTubeVideoDetails> => {
    const result = await callAPI({ action: 'video', videoId });
    return result.video;
  };

  const getChannelInfo = async (channelId: string): Promise<YouTubeChannel> => {
    const result = await callAPI({ action: 'channel', channelId });
    return result.channel;
  };

  const getEmbedInfo = async (videoId: string): Promise<YouTubeEmbed> => {
    const result = await callAPI({ action: 'embed', videoId });
    return result.embed;
  };

  return {
    loading,
    error,
    testAPI,
    searchVideos,
    getVideoDetails,
    getChannelInfo,
    getEmbedInfo
  };
}
