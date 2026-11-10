import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  makeJobsCacheKey,
  readJobsCache,
  writeJobsCache,
} from '@/lib/jobsPersistentCache';

interface JobFilters {
  location?: string;
  min_salary?: number;
  max_salary?: number;
  experience_level?: string;
  work_mode?: string;
  skills?: string[];
}

interface JobFeedParams {
  filters?: JobFilters;
  page?: number;
  limit?: number;
  sort?: 'latest' | 'salary' | 'relevance';
}

interface JobFeedResponse {
  success: boolean;
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  timestamp: string;
}

export const useOptimizedJobFeed = (params: JobFeedParams = {}) => {
  const { filters = {}, page = 1, limit = 20, sort = 'latest' } = params;

  const cacheKey = makeJobsCacheKey(['optimized-job-feed', filters, page, limit, sort]);
  const persistedInitial = readJobsCache<JobFeedResponse>(cacheKey);

  return useQuery({
    queryKey: ['optimized-job-feed', filters, page, limit, sort],
    queryFn: async (): Promise<JobFeedResponse> => {
      console.log('🔍 Fetching optimized job feed - Page:', page);
      
      const { data, error } = await supabase.functions.invoke('get-job-feed', {
        body: {
          filters,
          page,
          limit,
          sort,
        },
      });

      if (error) {
        console.error('❌ Job feed fetch error:', error);
        throw error;
      }

      console.log('✅ Job feed loaded:', data.data?.length, 'jobs');
      // Persist to localStorage for up to 24h so repeat visits don't hit API.
      try {
        writeJobsCache<JobFeedResponse>(cacheKey, data as JobFeedResponse);
      } catch {
        /* ignore cache write errors */
      }
      return data as JobFeedResponse;
    },
    // With persistent localStorage cache, keep results "fresh" for 24h so we
    // don't re-fetch when the user comes back within the same day.
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    initialData: persistedInitial ?? undefined,
    initialDataUpdatedAt: persistedInitial ? Date.now() : undefined,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep old data while loading new page
  });
};
