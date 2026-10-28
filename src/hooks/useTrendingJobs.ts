import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';
import {
  readPersistentJobsCache,
  writePersistentJobsCache,
} from '@/utils/persistentJobsCache';


export interface TrendingJob {
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
  openings?: number;
  education_required?: string;
  work_mode?: string;
  shift_timing?: string;
  skills: string[];
  is_boosted: boolean;
  boost_level: number;
  created_at: string;
  views_count: number;
  applications_count: number;
  logo_url?: string;
  trending_score: number;
  base_score: number;
  trending_rank?: number | null;
  organic_rank?: number | null;
  location_match?: string;
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
  company_latitude?: number;
  company_longitude?: number;
  latitude?: number;
  longitude?: number;
  boost_end_date?: string;
  apiCompanyName?: string;
  is_new?: boolean;
}

export const useTrendingJobs = (options?: {
  limit?: number;
  enabled?: boolean;
  showTopRanked?: boolean; // New option to fetch top ranked jobs
}) => {
  const { user } = useAuth();
  const { location: userLocation } = useUserLocation();
  const [jobs, setJobs] = useState<TrendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const requestRef = useRef(0);
  const fetchingRef = useRef(false);

  const limit = options?.limit || 20;
  const enabled = options?.enabled !== false;
  const showTopRanked = options?.showTopRanked || false;

  console.log('🔥 useTrendingJobs hook initialized', { 
    enabled, 
    user: user?.id || 'guest', 
    limit,
    showTopRanked,
    userLocation: userLocation.city || userLocation.state || userLocation.country || 'unknown'
  });

  const fetchTrendingJobs = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!enabled) {
      console.log('⏸️ Trending jobs fetch disabled (enabled=false)');
      return;
    }
    
    if (!reset && fetchingRef.current) return;
    const requestId = ++requestRef.current;
    fetchingRef.current = true;
    console.log('🔄 Fetching jobs', { 
      pageNum, 
      showTopRanked, 
      mode: showTopRanked ? 'by organic_rank' : 'by trending_score' 
    });
    setLoading(true);
    setError(null);

    try {
      // Persist scrolled pages for 24h so returning visitors see the same
      // list instantly. Auto-clears after 24h.
      const cacheKey = `trending_v2_${showTopRanked ? 'top' : 'regular'}_${limit}_${pageNum}`;
      // Skip persistent cache on explicit reset so newly posted jobs surface
      // immediately instead of waiting for the 24h TTL to expire.
      const cached = reset ? null : readPersistentJobsCache<{ jobs: TrendingJob[]; hasMore: boolean }>(cacheKey);
      if (cached) {
        setJobs(reset || pageNum === 0 ? cached.jobs : prev => [...prev, ...cached.jobs]);
        setHasMore(cached.hasMore);
        setPage(pageNum);
        setLoading(false);
        fetchingRef.current = false;
        return;
      }


      const fetchLimit = limit;
      const shouldPaginate = !showTopRanked;
      
      let query = supabase
        .from('jobs')
        .select(`
          id,
          short_id,
          public_slug,
          title,
          location,
          job_type,
          experience_level,
          salary_range,
          category,
          work_mode,
          shift_timing,
          education_required,
          openings,
          skills,
          is_boosted,
          boost_level,
          trending_score,
          trending_rank,
          organic_rank,
          boost_end_date,
          created_at,
          views_count,
          applications_count,
          city,
          state,
          country,
          languages,
          latitude,
          longitude,
          api_company_name,
          companies!inner(
            company_name,
            logo_url,
            is_verified,
            verified_plan_end,
            badge_color,
            instagram_link,
            facebook_link,
            youtube_link,
            linkedin_link,
            latitude,
            longitude
          )
        `)
        .eq('status', 'active')
        .eq('visibility', 'public');
      
      // Order by organic_rank for top ranked section, otherwise by trending_score
      if (showTopRanked) {
        query = query
          .not('organic_rank', 'is', null)
          .order('organic_rank', { ascending: true })
          .limit(fetchLimit);
      } else {
        query = query
          .order('trending_score', { ascending: false })
          .range(pageNum * limit, (pageNum + 1) * limit - 1);
      }
      
      const { data, error: fetchError } = await query;

      if (requestId !== requestRef.current) return;
      if (fetchError) {
        console.error('❌ Fetch Error:', fetchError);
        throw fetchError;
      }

      const fetchedJobs = (data || []).map((job: any) => {
        // Only show badge for city match
        let locationMatch: 'city' | null = null;
        if (userLocation.city && job.city && userLocation.city.toLowerCase() === job.city.toLowerCase()) {
          locationMatch = 'city';
        }
        
        // Base Score = (views × 0.10) + (applications × 1.0)
        const baseScore = (job.views_count || 0) * 0.10 + (job.applications_count || 0) * 1.0;
        
        // Use trending_score from database (includes boost: base_score + boost_value)
        // Boost values: 1x=+100, 2x=+200, 3x=+300, 4x=+400, 5x=+500
        const trendingScore = job.trending_score || baseScore;
        
        return {
          job_id: job.id,
          short_id: job.short_id,
          public_slug: job.public_slug,
          title: job.title,
          company: job.companies?.company_name || '',
          location: job.location,
          job_type: job.job_type,
          experience_level: job.experience_level,
          salary_range: job.salary_range,
          description: job.description,
          category: job.category,
          work_mode: job.work_mode,
          shift_timing: job.shift_timing,
          education_required: job.education_required,
          openings: job.openings,
          skills: job.skills || [],
          is_boosted: job.is_boosted || false,
          boost_level: job.boost_level || 0,
          created_at: job.created_at,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          logo_url: job.companies?.logo_url,
          base_score: baseScore,
          trending_score: trendingScore,
          trending_rank: job.trending_rank,
          organic_rank: job.organic_rank,
          city: job.city,
          state: job.state,
          country: job.country,
          location_match: locationMatch,
          languages: job.languages || [],
          is_verified: job.companies?.is_verified || false,
          verified_plan_end: job.companies?.verified_plan_end,
          badge_color: job.companies?.badge_color,
          company_instagram_link: job.companies?.instagram_link,
          company_facebook_link: job.companies?.facebook_link,
          company_youtube_link: job.companies?.youtube_link,
          company_linkedin_link: job.companies?.linkedin_link,
          company_latitude: job.companies?.latitude,
          company_longitude: job.companies?.longitude,
          latitude: job.latitude,
          longitude: job.longitude,
          boost_end_date: job.boost_end_date,
          apiCompanyName: job.api_company_name,
          is_new: false,
        };
      }) as TrendingJob[];
      
      console.log('📊 Jobs with ranks:', fetchedJobs.slice(0, 5).map(j => ({
        title: j.title,
        base: j.base_score.toFixed(2),
        trending: j.trending_score.toFixed(2),
        trendingRank: j.trending_rank,
        organicRank: j.organic_rank,
        boosted: j.is_boosted,
        boostLevel: j.boost_level
      })));
      
      console.log('✅ Fetched', fetchedJobs.length, 'jobs');
      console.log('🏆 Top ranked jobs:', fetchedJobs.filter(j => j.organic_rank).map(j => ({
        title: j.title,
        baseScore: j.base_score.toFixed(2),
        organicRank: j.organic_rank,
        trendingScore: j.trending_score.toFixed(2),
        trendingRank: j.trending_rank
      })));
      
      if (reset || pageNum === 0) {
        setJobs(fetchedJobs);
      } else {
        setJobs(prev => [...prev, ...fetchedJobs]);
      }
      
      // For top ranked section, always set hasMore to false as we fetch all ranked jobs
      const nextHasMore = showTopRanked ? false : fetchedJobs.length === limit;
      writePersistentJobsCache(cacheKey, { jobs: fetchedJobs, hasMore: nextHasMore });
      setHasMore(nextHasMore);
      setPage(pageNum);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setHasMore(false);
      console.error('❌ Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      if (requestId === requestRef.current) {
        fetchingRef.current = false;
        setLoading(false);
      }
    }
  }, [limit, enabled, showTopRanked]);

  useEffect(() => {
    if (enabled) {
      fetchTrendingJobs(0, true);
    } else {
      setLoading(false);
    }
  }, [enabled, fetchTrendingJobs]);

  // Real-time subscription for job updates (both INSERT and UPDATE)
  useEffect(() => {
    if (!enabled) return;
    if (!shouldEnableRealtime()) return;

    console.log('🔴 Setting up real-time subscription for trending jobs');

    const channel = supabase
      .channel('trending-jobs-updates')
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
          
          // For INSERT or major rank/score changes, refresh all jobs to maintain proper sorting
          if (payload.eventType === 'INSERT' || 
              (payload.eventType === 'UPDATE' && 
               (payload.new.organic_rank !== payload.old?.organic_rank || 
                payload.new.trending_rank !== payload.old?.trending_rank ||
                payload.new.trending_score !== payload.old?.trending_score))) {
            console.log('🔄 New job or rank/score changed, refreshing all jobs');
            fetchTrendingJobs(0, true);
            return;
          }
          
          // For other minor updates, update the specific job in state
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
            
            setJobs(prevJobs => {
              const updatedJobs = prevJobs.map(job => {
                if (job.job_id === payload.new.id) {
                  return {
                    ...job,
                    views_count: viewsCount || 0,
                    applications_count: applicationsCount || 0,
                    is_boosted: payload.new.is_boosted,
                    boost_level: payload.new.boost_level || 0,
                    boost_end_date: payload.new.boost_end_date,
                    base_score: baseScore,
                    trending_score: trendingScore,
                    trending_rank: payload.new.trending_rank,
                    organic_rank: payload.new.organic_rank
                  };
                }
                return job;
              });
              
              // Re-sort based on mode
              if (showTopRanked) {
                updatedJobs.sort((a, b) => {
                  if (a.organic_rank === null && b.organic_rank === null) return 0;
                  if (a.organic_rank === null) return 1;
                  if (b.organic_rank === null) return -1;
                  return a.organic_rank - b.organic_rank;
                });
              } else {
                updatedJobs.sort((a, b) => b.trending_score - a.trending_score);
              }
              
              return updatedJobs;
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up real-time subscription for trending jobs');
      supabase.removeChannel(channel);
    };
  }, [enabled, jobs.length, fetchTrendingJobs, showTopRanked]);

  const loadMore = useCallback(() => {
    if (!fetchingRef.current && !loading && hasMore) {
      fetchTrendingJobs(page + 1);
    }
  }, [loading, hasMore, page, fetchTrendingJobs]);

  const refresh = useCallback(() => {
    fetchTrendingJobs(0, true);
  }, [fetchTrendingJobs]);

  return {
    jobs,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
};
