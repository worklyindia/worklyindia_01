import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { formatDateWithTime, isToday } from '@/utils/dateFormatUtils';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';
import {
  readPersistentJobsCache,
  writePersistentJobsCache,
} from '@/utils/persistentJobsCache';


export interface LatestJob {
  job_id: string;
  short_id?: string;
  public_slug?: string;
  title: string;
  company: string;
  location: string;
  job_type: string;
  experience_level: string;
  salary_range: string;
  description: string;
  category: string;
  skills: string[];
  is_boosted: boolean;
  boost_level: number;
  created_at: string;
  views_count: number;
  applications_count: number;
  logo_url?: string;
  location_match?: string;
  effective_date: string;
  city?: string;
  state?: string;
  country?: string;
  languages?: string[];
  is_verified: boolean;
  verified_plan_end?: string;
  badge_color?: string;
  company_instagram_link?: string;
  company_facebook_link?: string;
  company_youtube_link?: string;
  company_linkedin_link?: string;
  latitude?: number;
  longitude?: number;
  precise_address?: string;
  trending_score?: number;
  base_score?: number;
  trending_rank?: number;
  organic_rank?: number | null;
  is_new?: boolean;
  apiCompanyName?: string;
  education_required?: string;
  openings?: number;
}

// Persist each scrolled page for 24h so returning visitors see the same
// list instantly and we skip an API call. Auto-clears after 24h so old
// postings roll off and fresh jobs surface.
const getLatestJobsCacheKey = (userId: string | undefined, limit: number, pageNum: number, locationKey: string) =>
  `latest_${userId || 'guest'}_${limit}_${pageNum}_${locationKey || 'anywhere'}`;


export const useLatestJobs = (options?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { user } = useAuth();
  const { location: userLocation } = useUserLocation();
  const [jobs, setJobs] = useState<LatestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const requestRef = useRef(0);
  const fetchingRef = useRef(false);

  const limit = options?.limit || 20;
  const enabled = options?.enabled !== false;

  console.log('🕐 useLatestJobs hook initialized', { 
    enabled, 
    user: user?.id || 'guest', 
    limit,
    userLocation: userLocation.city || userLocation.state || userLocation.country || 'unknown'
  });

  const fetchLatestJobs = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!enabled) {
      console.log('⏸️ Latest jobs fetch disabled (enabled=false)');
      return;
    }
    
    if (!reset && fetchingRef.current) return;
    const requestId = ++requestRef.current;
    fetchingRef.current = true;
    console.log('🔄 Fetching latest jobs for user:', user?.id || 'guest', 'page:', pageNum);
    const locationKey = [userLocation.city, userLocation.state, userLocation.country].filter(Boolean).join('_').toLowerCase();
    const cacheKey = getLatestJobsCacheKey(user?.id, limit, pageNum, locationKey);
    // Bypass cache on explicit reset (e.g. after a new job is posted via
    // realtime INSERT) — otherwise we serve stale data and freshly posted
    // internal jobs never appear until the 24h TTL expires.
    const cached = reset ? null : readPersistentJobsCache<{ jobs: LatestJob[]; hasMore: boolean }>(cacheKey);
    if (cached) {
      if (reset || pageNum === 0) {
        setJobs(cached.jobs || []);
      } else {
        setJobs(prev => [...prev, ...(cached.jobs || [])]);
      }
      setHasMore(cached.hasMore ?? false);
      setPage(pageNum);
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
      return;
    }

    
    // Only show full loading on initial load, use loadingMore for pagination
    if (pageNum === 0 || reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_latest_jobs_with_priority_v2', {
        p_user_id: user?.id || null,
        p_limit: limit,
        p_offset: pageNum * limit
      });

      if (requestId !== requestRef.current) return;
      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
        throw rpcError;
      }

      const fetchedJobs = (data || []) as any[];
      
      console.log('🔍 Fetched latest jobs:', fetchedJobs.length, 'jobs (sorted by database: created_at DESC)');
      console.log('📅 Jobs in order received from database:');
      fetchedJobs.slice(0, 5).forEach((job: any, idx: number) => {
        console.log(`  ${idx + 1}. ${job.title}
    - Job ID: ${job.job_id}
    - Created (UTC): ${job.created_at}
    - IST: ${formatDateWithTime(job.created_at)}
    - Boosted: ${job.is_boosted ? 'Yes' : 'No'}
    - Trending Score: ${job.trending_score || 0}`);
      });
      
      // Calculate base score and location match for each job
      const enrichedJobs = fetchedJobs.map((job: any) => {
        // Only show badge for city match
        let locationMatch: 'city' | null = null;
        if (userLocation.city && job.city && userLocation.city.toLowerCase() === job.city.toLowerCase()) {
          locationMatch = 'city';
        }
        
        // Base Score = (views × 0.10) + (applications × 1.0) - WITHOUT BOOST
        const baseScore = (job.views_count || 0) * 0.10 + (job.applications_count || 0) * 1.0;
        
        // Calculate if job is new (posted within last 24 hours in IST)
        const jobIsNew = isToday(job.created_at);
        
        // Boost calculation (boost_level × 100) is handled automatically by database trigger
        // trending_score from DB = base_score + (boost_level × 100) if boosted
        
        return {
          ...job,
          base_score: baseScore,
          trending_score: job.trending_score || baseScore,
          trending_rank: job.trending_rank, // Use trending_rank from database
          location_match: locationMatch,
          is_new: jobIsNew,
          apiCompanyName: job.api_company_name,
        };
      });
      
      // Database already sorts by created_at DESC and provides organic_rank, no need to re-sort or recalculate
      if (reset || pageNum === 0) {
        console.log('🔄 Setting jobs (reset mode). Job IDs in order:');
        console.log(enrichedJobs.slice(0, 5).map((j: any) => `${j.title} (${j.job_id?.substring(0, 8)}...)`));
        setJobs(enrichedJobs as any);
      } else {
        console.log('🔄 Appending jobs');
        setJobs((prev) => [...prev, ...(enrichedJobs as any)]);
      }
      
      const nextHasMore = fetchedJobs.length === limit;
      writePersistentJobsCache(cacheKey, {
        jobs: enrichedJobs,
        hasMore: nextHasMore,
      });

      setHasMore(nextHasMore);
      setPage(pageNum);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setHasMore(false);
      console.error('❌ Error fetching latest jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
      
      // Report error to monitoring
      import('../utils/errorMonitoring').then(({ handleReactQueryError }) => {
        handleReactQueryError(err, 'useLatestJobs');
      }).catch(e => console.warn('Could not report error to monitoring:', e));
    } finally {
      if (requestId === requestRef.current) {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user?.id, limit, enabled, userLocation.city, userLocation.state, userLocation.country]);

  useEffect(() => {
    fetchLatestJobs(0, true);
  }, [fetchLatestJobs]);

  // Real-time subscription for job updates (both INSERT and UPDATE)
  useEffect(() => {
    if (!enabled) return;
    if (!shouldEnableRealtime()) return;

    console.log('🔴 Setting up real-time subscription for latest jobs');

    const channel = supabase
      .channel('latest-jobs-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'jobs'
        },
        async (payload: any) => {
          console.log('🔴 Real-time event received:', payload.eventType, 'for job:', payload.new?.id);
          
          if (!payload.new?.id) return;
          
          // For INSERT or major rank changes, refresh all jobs to maintain sort order
          if (payload.eventType === 'INSERT' || 
              (payload.eventType === 'UPDATE' && 
               (payload.new.organic_rank !== payload.old?.organic_rank || 
                payload.new.trending_rank !== payload.old?.trending_rank))) {
            console.log('🔄 New job or rank changed, refreshing all jobs');
            fetchLatestJobs(0, true);
            return;
          }
          
          // For other updates, update the specific job in state
          if (payload.eventType === 'UPDATE' && jobs.length > 0) {
            const jobExists = jobs.find(j => j.job_id === payload.new.id);
            if (!jobExists) return;

            // Fetch updated counts
            const { data: viewsCount } = await supabase.rpc('get_job_view_count', { 
              p_job_id: payload.new.id 
            });
            const { data: applicationsCount } = await supabase.rpc('get_job_application_count', { 
              p_job_id: payload.new.id 
            });
            
            const baseScore = (viewsCount || 0) * 0.10 + (applicationsCount || 0) * 1.0;
            const trendingScore = payload.new.trending_score || baseScore;
            
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.job_id === payload.new.id
                  ? {
                      ...job,
                      views_count: viewsCount || 0,
                      applications_count: applicationsCount || 0,
                      base_score: baseScore,
                      trending_score: trendingScore,
                      trending_rank: payload.new.trending_rank,
                      organic_rank: payload.new.organic_rank,
                      is_boosted: payload.new.is_boosted,
                      boost_level: payload.new.boost_level || 0
                    }
                  : job
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up real-time subscription for latest jobs');
      supabase.removeChannel(channel);
    };
  }, [enabled, jobs.length, fetchLatestJobs]);

  const loadMore = useCallback(() => {
    if (!fetchingRef.current && !loading && !loadingMore && hasMore) {
      fetchLatestJobs(page + 1);
    }
  }, [loading, loadingMore, hasMore, page, fetchLatestJobs]);

  const refresh = useCallback(() => {
    fetchLatestJobs(0, true);
  }, [fetchLatestJobs]);

  return {
    jobs,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh
  };
};
