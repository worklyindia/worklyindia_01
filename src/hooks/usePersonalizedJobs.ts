import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LocationFilter {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  cityCount?: number;
  stateCount?: number;
  countryCount?: number;
}

export interface PersonalizedJob {
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
  trending_score: number;
  base_score: number;
  organic_score: number;
  organic_rank?: number | null;
  match_score?: number;
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
  location_match_level?: 'city' | 'state' | 'country' | null;
  boost_end_date?: string;
  apiCompanyName?: string;
}

export const usePersonalizedJobs = (options?: {
  limit?: number;
  enabled?: boolean;
  locationFilter?: LocationFilter;
  matchLevel?: 'city' | 'state' | 'country' | 'auto';
}) => {
  const { user } = useAuth();
  const locationFilter = options?.locationFilter;
  const [jobs, setJobs] = useState<PersonalizedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const requestRef = useRef(0);
  const fetchingRef = useRef(false);

  const limit = options?.limit || 20;
  const enabled = options?.enabled !== false;

  console.log('🎯 usePersonalizedJobs hook initialized', { 
    enabled, 
    user: user?.id || 'no user', 
    limit 
  });

  const fetchPersonalizedJobs = useCallback(async (pageNum: number = 0, reset: boolean = false) => {
    if (!enabled || !user?.id) {
      console.log('⏸️ Personalized jobs fetch disabled', { enabled, hasUser: !!user?.id });
      setLoading(false);
      return;
    }

    // Wait for location counts before fetching
    if (locationFilter && (locationFilter.cityCount === undefined || locationFilter.stateCount === undefined || locationFilter.countryCount === undefined)) {
      console.log('⏸️ Waiting for location counts before fetching jobs');
      setLoading(true);
      return;
    }

    // Wait for location data if locationFilter is provided but empty
    if (locationFilter && !locationFilter.city && !locationFilter.state && !locationFilter.country) {
      console.log('⏸️ Waiting for location data before fetching jobs');
      setLoading(true);
      return;
    }
    
    if (!reset && fetchingRef.current) return;
    const requestId = ++requestRef.current;
    fetchingRef.current = true;
    console.log('🔄 Fetching personalized jobs', { pageNum, user: user.id, reset });
    console.log('📍 Location filter with counts:', locationFilter);
    setLoading(true);
    setError(null);

    try {
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
          skills,
          is_boosted,
          boost_level,
          trending_score,
          organic_score,
          organic_rank,
          created_at,
          views_count,
          applications_count,
          city,
          state,
          country,
          languages,
          boost_end_date,
          api_company_name,
          education_required,
          work_mode,
          shift_timing,
          openings,
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

      // Apply location filter with explicit match level support
      if (locationFilter) {
        const { city, state, country, cityCount, stateCount, countryCount } = locationFilter;
        const requestedLevel = options?.matchLevel || 'auto';
        
        // Trim location values to handle trailing/leading spaces
        const trimmedCity = city?.trim();
        const trimmedState = state?.trim();
        const trimmedCountry = country?.trim();
        
        console.log('🔍 [FILTER DEBUG] Location counts:', { 
          city: trimmedCity, cityCount, 
          state: trimmedState, stateCount, 
          country: trimmedCountry, countryCount, 
          requestedLevel 
        });
        
        // Explicit match level filtering with pattern matching to handle trailing spaces
        if (requestedLevel === 'city' && trimmedCity && cityCount && cityCount > 0) {
          console.log('✅ [EXPLICIT CITY] Applying City filter:', trimmedCity, `(${cityCount} jobs)`);
          query = query.or(`city.eq.${trimmedCity},city.ilike.${trimmedCity} %`);
        } else if (requestedLevel === 'state' && trimmedState && stateCount && stateCount > 0) {
          console.log('✅ [EXPLICIT STATE] Applying State filter:', trimmedState, `(${stateCount} jobs)`);
          query = query.or(`state.eq.${trimmedState},state.ilike.${trimmedState} %`);
        } else if (requestedLevel === 'country' && trimmedCountry && countryCount && countryCount > 0) {
          console.log('✅ [EXPLICIT COUNTRY] Applying Country filter:', trimmedCountry, `(${countryCount} jobs)`);
          query = query.or(`country.eq.${trimmedCountry},country.ilike.${trimmedCountry} %`);
        } else if (requestedLevel === 'auto') {
          // Auto mode: Use priority logic (City → State → Country)
          if (trimmedCity && cityCount && cityCount > 0) {
            console.log('✅ [AUTO PRIORITY 1] Applying City filter:', trimmedCity, `(${cityCount} jobs)`);
            query = query.or(`city.eq.${trimmedCity},city.ilike.${trimmedCity} %`);
          } else if (trimmedState && stateCount && stateCount > 0) {
            console.log('✅ [AUTO PRIORITY 2] Applying State filter:', trimmedState, `(${stateCount} jobs)`);
            query = query.or(`state.eq.${trimmedState},state.ilike.${trimmedState} %`);
          } else if (trimmedCountry && countryCount && countryCount > 0) {
            console.log('✅ [AUTO PRIORITY 3] Applying Country filter:', trimmedCountry, `(${countryCount} jobs)`);
            query = query.or(`country.eq.${trimmedCountry},country.ilike.${trimmedCountry} %`);
          } else {
            console.log('⚠️ No location filter applied - no jobs found', { 
              city: trimmedCity, cityCount, 
              state: trimmedState, stateCount, 
              country: trimmedCountry, countryCount 
            });
          }
        }
      } else {
        console.log('⚠️ No locationFilter provided');
      }

      query = query
        .order('trending_score', { ascending: false })
        .range(pageNum * limit, (pageNum + 1) * limit - 1);

      const { data, error: fetchError } = await query;

      if (requestId !== requestRef.current) return;
      if (fetchError) {
        console.error('❌ Fetch Error:', fetchError);
        throw fetchError;
      }

      // Determine which filter was applied
      let appliedFilter: 'city' | 'state' | 'country' | null = null;
      if (locationFilter) {
        const { city, cityCount, state, stateCount, countryCount } = locationFilter;
        const requestedLevel = options?.matchLevel || 'auto';
        
        // If explicit level requested, use that
        if (requestedLevel === 'city' && city && cityCount && cityCount > 0) {
          appliedFilter = 'city';
        } else if (requestedLevel === 'state' && state && stateCount && stateCount > 0) {
          appliedFilter = 'state';
        } else if (requestedLevel === 'country' && countryCount && countryCount > 0) {
          appliedFilter = 'country';
        } else if (requestedLevel === 'auto') {
          // Auto mode: determine based on priority
          if (city && cityCount && cityCount > 0) {
            appliedFilter = 'city';
          } else if (state && stateCount && stateCount > 0) {
            appliedFilter = 'state';
          } else if (countryCount && countryCount > 0) {
            appliedFilter = 'country';
          }
        }
      }

      const fetchedJobs = (data || []).map((job: any) => {
        // Base Score = (views × 0.10) + (applications × 1.0)
        const baseScore = (job.views_count || 0) * 0.10 + (job.applications_count || 0) * 1.0;
        
        // Use trending_score from database (already includes boost calculation)
        const trendingScore = job.trending_score || baseScore;
        
        // Use organic_score from database (views + applications WITHOUT boost)
        const organicScore = job.organic_score || baseScore;
        
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
          skills: job.skills || [],
          is_boosted: job.is_boosted || false,
          boost_level: job.boost_level || 0,
          created_at: job.created_at,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          logo_url: job.companies?.logo_url,
          base_score: baseScore,
          trending_score: trendingScore,
          organic_score: organicScore,
          organic_rank: job.organic_rank,
          city: job.city || locationFilter?.city || null,
          state: job.state || locationFilter?.state || null,
          country: job.country || locationFilter?.country || 'India',
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
          location_match_level: appliedFilter,
          boost_end_date: job.boost_end_date,
          apiCompanyName: job.api_company_name,
          education_required: job.education_required,
          work_mode: job.work_mode,
          shift_timing: job.shift_timing,
          openings: job.openings,
        };
      }) as PersonalizedJob[];
      
      console.log('✅ Fetched', fetchedJobs.length, 'jobs with filter:', appliedFilter);
      console.log('🏆 Organic Rankings (from DB):', fetchedJobs.filter(j => j.organic_rank).map(j => `#${j.organic_rank} - ${j.title} (job_id: ${j.job_id.slice(0,8)})`));
      
      if (reset || pageNum === 0) {
        setJobs(fetchedJobs);
      } else {
        setJobs(prev => [...prev, ...fetchedJobs]);
      }
      
      setHasMore(fetchedJobs.length === limit);
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
  }, [user?.id, limit, enabled, options?.matchLevel, locationFilter?.city, locationFilter?.state, locationFilter?.country, locationFilter?.cityCount, locationFilter?.stateCount, locationFilter?.countryCount]);

  useEffect(() => {
    fetchPersonalizedJobs(0, true);
  }, [fetchPersonalizedJobs]);

  // Real-time subscription for job updates (both INSERT and UPDATE)
  useEffect(() => {
    if (!enabled) return;

    console.log('🔴 Setting up real-time subscription for personalized jobs');

    const channel = supabase
      .channel('personalized-jobs-updates')
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
          
          // For INSERT or UPDATE of ranks, refresh all jobs
          if (payload.eventType === 'INSERT' || 
              (payload.eventType === 'UPDATE' && 
               (payload.new.organic_rank !== payload.old?.organic_rank || 
                payload.new.trending_score !== payload.old?.trending_score))) {
            console.log('🔄 Rank or score changed, refreshing all jobs');
            fetchPersonalizedJobs(0, true);
            return;
          }
          
          // For other updates, update the specific job in state
          if (payload.eventType === 'UPDATE' && jobs.length > 0) {
            const jobExists = jobs.find(j => j.job_id === payload.new.id);
            if (!jobExists) return;

            setJobs(prevJobs => {
              const updatedJobs = prevJobs.map(job => {
                if (job.job_id === payload.new.id) {
                  const newViewsCount = payload.new.views_count || 0;
                  const newApplicationsCount = payload.new.applications_count || 0;
                  const baseScore = (newViewsCount * 0.10) + (newApplicationsCount * 1.0);
                  const trendingScore = payload.new.trending_score || baseScore;
                  const organicScore = payload.new.organic_score || baseScore;
                  
                  return {
                    ...job,
                    views_count: newViewsCount,
                    applications_count: newApplicationsCount,
                    is_boosted: payload.new.is_boosted,
                    boost_level: payload.new.boost_level || 0,
                    boost_end_date: payload.new.boost_end_date,
                    base_score: baseScore,
                    trending_score: trendingScore,
                    organic_score: organicScore,
                    organic_rank: payload.new.organic_rank
                  };
                }
                return job;
              });
              
              // Re-sort by trending_score (DESC) - real-time position updates
              updatedJobs.sort((a, b) => b.trending_score - a.trending_score);
              
              return updatedJobs;
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔴 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [enabled, jobs.length, fetchPersonalizedJobs]);

  const loadMore = useCallback(() => {
    if (!fetchingRef.current && !loading && hasMore) {
      fetchPersonalizedJobs(page + 1, false);
    }
  }, [loading, hasMore, page, fetchPersonalizedJobs]);

  const refresh = useCallback(() => {
    fetchPersonalizedJobs(0, true);
  }, [fetchPersonalizedJobs]);

  // Determine if "For You" tab should be shown
  // Show only if City has jobs OR State has jobs
  const shouldShowTab = useMemo(() => {
    if (!locationFilter) return false;
    const { cityCount = 0, stateCount = 0 } = locationFilter;
    return cityCount > 0 || stateCount > 0;
  }, [locationFilter?.cityCount, locationFilter?.stateCount]);

  return {
    jobs,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    shouldShowTab
  };
};
