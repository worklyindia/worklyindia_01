import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  thumbnail: string | null;
  thumbnailSmall?: string | null;
  originalImage?: string;
  width?: number | null;
  height?: number | null;
}

interface RawSearchResult extends SearchResult {
  imageUrl?: string;
}

const normalizeImageResults = (results: RawSearchResult[] | undefined): SearchResult[] =>
  (results || []).map((result) => ({
    ...result,
    // Google returns the actual image in imageUrl and the source webpage in link.
    originalImage: result.originalImage || result.imageUrl || undefined,
    thumbnailSmall: result.thumbnailSmall || result.thumbnail || null,
  })).filter((result) => {
    if (!result.originalImage) return false;
    if (!result.width || !result.height) return true;
    return Math.max(result.width, result.height) >= 1920;
  });

interface SearchResponse {
  success: boolean;
  query: string;
  totalResults: string;
  searchTime: number;
  results: SearchResult[];
  error?: string;
}

interface ConfigTestResponse {
  success: boolean;
  message: string;
  config: {
    serviceAccountConfigured: boolean;
    apiKeyConfigured: boolean;
    searchEngineIdConfigured: boolean;
    authMethod: string;
  };
}

export function useGoogleCustomSearch() {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [startIndex, setStartIndex] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const testConfig = async (): Promise<ConfigTestResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Testing Google Custom Search configuration...');
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'search', action: 'test' }
      });

      console.log('Edge function response:', { data, error: fnError });

      if (fnError) {
        console.error('Edge function error:', fnError);
        throw new Error(fnError.message || 'Edge function invocation failed');
      }
      return data;
    } catch (err: unknown) {
      console.error('Test config error:', err);
      const message = err instanceof Error ? err.message : 'Failed to test configuration';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const search = async (query: string): Promise<SearchResponse> => {
    setLoading(true);
    setError(null);
    setCurrentQuery(query);
    setStartIndex(1);
    setHasMore(true);
    
    try {
      console.log('Searching for:', query);
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'search', query, action: 'search', start: 1, searchType: 'image', imgSize: 'huge' }
      });

      console.log('Search response:', { data, error: fnError });

      if (fnError) {
        console.error('Search edge function error:', fnError);
        throw new Error(fnError.message || 'Edge function invocation failed');
      }
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      
      const results = normalizeImageResults(data.results);
      setStartIndex(11);
      setHasMore(results.length >= 10);
      
      return { ...data, results };
    } catch (err: unknown) {
      console.error('Search error:', err);
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setHasMore(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async (): Promise<SearchResult[]> => {
    if (loadingMore || !hasMore || !currentQuery) return [];
    
    setLoadingMore(true);
    
    try {
      console.log('Loading more from index:', startIndex);
      const { data, error: fnError } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'search', query: currentQuery, action: 'search', start: startIndex, searchType: 'image', imgSize: 'huge' }
      });

      if (fnError) {
        console.error('Load more error:', fnError);
        throw new Error(fnError.message || 'Failed to load more');
      }
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      
      const newResults = normalizeImageResults(data.results);
      setStartIndex(prev => prev + 10);
      setHasMore(newResults.length >= 10);
      
      return newResults;
    } catch (err: unknown) {
      console.error('Load more error:', err);
      setHasMore(false);
      return [];
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentQuery, startIndex]);

  return {
    loading,
    loadingMore,
    error,
    hasMore,
    testConfig,
    search,
    loadMore
  };
}
