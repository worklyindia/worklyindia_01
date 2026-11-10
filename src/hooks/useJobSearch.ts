import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mergeSearchSuggestions, normalizeJobSearch, simplifySearchQuery } from '@/lib/jobSearchMatching';
import { useAuth } from '@/contexts/AuthContext';
import {
  readPersistentJobsCache,
  writePersistentJobsCache,
} from '@/utils/persistentJobsCache';


export interface SearchFilters {
  location?: string | { city?: string; state?: string; country?: string };
  jobType?: string;
  experience?: string;
  salaryMin?: number;
  salaryMax?: number;
  category?: string | string[];
  companySize?: string;
  sortBy?: string;
  skills?: string | string[];
  postedDate?: string;
  jobId?: string;
  company?: string;
  languages?: string | string[];
}

export interface JobResult {
  id: string;
  short_id?: string;
  public_slug?: string;
  title: string;
  company_name: string;
  location: string;
  job_type: string;
  experience_level: string;
  salary_range: string;
  description: string;
  requirements?: string;
  benefits?: string;
  skills: string[];
  status: string;
  category: string;
  created_at: string;
  trending_score: number;
  organic_score?: number;
  organic_rank?: number | null;
  trending_rank?: number | null;
  views_count: number;
  applications_count: number;
  calls_count: number;
  shares_count: number;
  is_boosted: boolean;
  boost_level: number;
  logo_url?: string;
  match_score?: number;
  // Company verification fields
  is_verified?: boolean;
  verified_plan_end?: string;
  badge_color?: string;
  company_instagram_link?: string;
  company_facebook_link?: string;
  company_youtube_link?: string;
  company_linkedin_link?: string;
  // Job location coordinates
  latitude?: number;
  longitude?: number;
  precise_address?: string;
  // Detailed location fields
  city?: string;
  state?: string;
  country?: string;
  education_required?: string;
  work_mode?: string;
  shift_timing?: string;
  openings?: number;
}

export interface SearchSuggestion {
  suggestion: string;
  type: 'job_title' | 'company' | 'skill' | 'category';
  count: number;
}

export const useJobSearch = () => {
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const searchRequest = useRef(0);
  const searchingRef = useRef(false);
  const suggestionRequest = useRef(0);
  const suggestionCache = useRef(new Map<string, SearchSuggestion[]>());

  const searchJobs = useCallback(async (
    query: string = '',
    filters: SearchFilters = {},
    pageNum: number = 0,
    reset: boolean = true
  ) => {
    if (!reset && searchingRef.current) return;
    const requestId = ++searchRequest.current;
    searchingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Search Jobs called:', { query, filters, pageNum, reset, user: user?.id });

      // Persistent search cache (24h, localStorage). Same query+filters+page
      // served instantly without re-hitting the RPC.
      const searchCacheKey = `search_v3_${JSON.stringify({ q: query, f: filters, p: pageNum })}`;
      const cachedSearch = readPersistentJobsCache<{ jobs: JobResult[]; hasMore: boolean }>(searchCacheKey);
      if (cachedSearch) {
        if (reset) {
          setJobs(cachedSearch.jobs);
          setPage(0);
        } else {
          setJobs(prev => [...prev, ...cachedSearch.jobs]);
        }
        setHasMore(cachedSearch.hasMore);
        setPage(pageNum);
        setLoading(false);
        return;
      }

      // Save search to history
      if (query.trim() || Object.keys(filters).length > 0) {
        void supabase.from('search_history').insert({
          user_id: user?.id || null,
          search_query: query,
          filters: filters as any,
          results_count: 0 // Will be updated after we get results
        }).then(() => {});
      }


      // If searching by Job ID, use new optimized search function
      if (filters.jobId) {
        console.log('🔍 Searching by Job ID:', filters.jobId);
        
        const { data: jobData, error: jobError } = await supabase
          .rpc('search_jobs_by_id', { search_term: filters.jobId });

        console.log('🔍 Job ID search result:', { jobData, jobError, searchTerm: filters.jobId });

        if (requestId !== searchRequest.current) return;
        if (jobError) throw jobError;
        
        const transformedJobs = (jobData || []).map((job: any) => ({
          id: job.id,
          short_id: job.short_id, // SEO short URL
          title: job.title,
          company_name: job.company_name || 'Unknown Company',
          location: job.location || 'Location not specified',
          job_type: job.job_type || 'Not specified',
          experience_level: job.experience_level || 'Any',
          salary_range: job.salary_range || 'Salary not disclosed',
          description: job.description || '',
          requirements: job.requirements,
          benefits: job.benefits,
          skills: job.skills || [],
          status: job.status,
          category: job.category,
          created_at: job.created_at,
          trending_score: job.trending_score || 0,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          calls_count: job.calls_count || 0,
          shares_count: job.shares_count || 0,
          is_boosted: job.is_boosted || false,
          boost_level: job.boost_level || 0,
          logo_url: job.logo_url,
          match_score: 100, // Direct ID search gets perfect match
          // Company verification fields
          is_verified: job.is_verified || false,
          verified_plan_end: job.verified_plan_end,
          badge_color: job.badge_color,
          company_instagram_link: job.company_instagram_link,
          company_facebook_link: job.company_facebook_link,
          company_youtube_link: job.company_youtube_link,
          company_linkedin_link: job.company_linkedin_link,
          // Location fields
          city: job.city,
          state: job.state,
          country: job.country
        , education_required: job.education_required, work_mode: job.work_mode, shift_timing: job.shift_timing, openings: job.openings }));

        if (reset) {
          setJobs(transformedJobs);
          setPage(0);
        } else {
          setJobs(prev => [...prev, ...transformedJobs]);
        }
        setHasMore(false);
        writePersistentJobsCache(searchCacheKey, { jobs: transformedJobs, hasMore: false });
        return;

      }

      // If searching by company ID, fetch all jobs for that company
      if (filters.company) {
        console.log('🔍 Searching by Company ID:', filters.company);
        
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select(`
            id, short_id, title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, status, category, created_at, trending_score, views_count, applications_count, calls_count, shares_count, is_boosted, boost_level, education_required, work_mode, shift_timing, openings,
            companies:companies(
              company_name, logo_url, is_verified, verified_plan_end, badge_color,
              instagram_link, facebook_link, youtube_link, linkedin_link, account_status
            )
          `)
          .eq('status', 'active')
          .eq('company_id', filters.company)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false });

        if (requestId !== searchRequest.current) return;
        if (jobError) throw jobError;
        
        const transformedJobs = (jobData || []).map((job: any) => ({
          id: job.id,
          short_id: job.short_id, // SEO short URL
          title: job.title,
          company_name: job.companies?.company_name || 'Unknown Company',
          location: job.location || 'Location not specified',
          job_type: job.job_type || 'Not specified',
          experience_level: job.experience_level || 'Any',
          salary_range: job.salary_range || 'Salary not disclosed',
          description: job.description || '',
          requirements: job.requirements,
          benefits: job.benefits,
          skills: job.skills || [],
          status: job.status,
          category: job.category,
          created_at: job.created_at,
          trending_score: job.trending_score || 0,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          calls_count: job.calls_count || 0,
          shares_count: job.shares_count || 0,
          is_boosted: job.is_boosted || false,
          boost_level: job.boost_level || 0,
          logo_url: job.companies?.logo_url,
          match_score: 100, // Company filter gets perfect match
          // Company verification fields
          is_verified: job.companies?.is_verified || false,
          verified_plan_end: job.companies?.verified_plan_end,
          badge_color: job.companies?.badge_color,
          company_instagram_link: job.companies?.instagram_link,
          company_facebook_link: job.companies?.facebook_link,
          company_youtube_link: job.companies?.youtube_link,
          company_linkedin_link: job.companies?.linkedin_link,
          // Location fields
          city: job.city,
          state: job.state,
          country: job.country
        }));

        if (reset) {
          setJobs(transformedJobs);
          setPage(0);
        } else {
          setJobs(prev => [...prev, ...transformedJobs]);
        }
        setHasMore(false);
        writePersistentJobsCache(searchCacheKey, { jobs: transformedJobs, hasMore: false });
        return;

      }

      // Regular search using fuzzy search
      
      // Handle location filter (string or object)
      let locationFilter = '';
      if (filters.location) {
        if (typeof filters.location === 'string') {
          locationFilter = filters.location;
        } else {
          const { city, state, country } = filters.location;
          const parts = [];
          if (city) parts.push(city);
          if (state) parts.push(state);
          if (country) parts.push(country);
          locationFilter = parts.join(', ');
        }
      }

      // Handle category filter (string or array)
      const categoryFilter = Array.isArray(filters.category) 
        ? filters.category.join(',') 
        : filters.category || '';

      // Handle languages filter (string or array)
      const languagesFilter = Array.isArray(filters.languages)
        ? filters.languages.join(',')
        : filters.languages || '';

      console.log('🔍 Calling fuzzy_search_jobs with params:', {
        search_query: query,
        job_location: locationFilter,
        job_type_filter: filters.jobType || '',
        experience_filter: filters.experience || '',
        salary_min: filters.salaryMin || 0,
        salary_max: filters.salaryMax || 1000000,
        category_filter: categoryFilter,
        languages_filter: languagesFilter,
        page_size: 20,
        page_offset: pageNum * 20,
        sort_by: filters.sortBy || ''
      });

      // Use fuzzy search for better typo tolerance
      const { data, error } = await supabase.rpc('fuzzy_search_jobs', {
        search_query: query,
        job_location: locationFilter,
        job_type_filter: filters.jobType || '',
        experience_filter: filters.experience || '',
        salary_min: filters.salaryMin || 0,
        salary_max: filters.salaryMax || 1000000,
        category_filter: categoryFilter,
        languages_filter: languagesFilter,
        page_size: 20,
        page_offset: pageNum * 20,
        sort_by: filters.sortBy || ''
      });

      if (requestId !== searchRequest.current) return;
      if (error) {
        console.error('🔍 Search error:', error);
        // If RPC function fails, fall back to basic search
        console.log('🔍 Falling back to basic search...');
        
        let query_builder = supabase
          .from('jobs')
          .select(`
            *,
            organic_score,
            organic_rank,
            companies:companies(
              company_name, logo_url, is_verified, verified_plan_end, badge_color,
              instagram_link, facebook_link, youtube_link, linkedin_link, account_status
            )
          `)
          .eq('status', 'active')
          .eq('visibility', 'public');

        if (query) {
          query_builder = query_builder.or(`title.ilike.%${query}%,description.ilike.%${query}%,skills.cs.{${query}}`);
        }

        if (filters.location) {
          const locStr = typeof filters.location === 'string' 
            ? filters.location 
            : [filters.location.city, filters.location.state, filters.location.country].filter(Boolean).join(', ');
          query_builder = query_builder.ilike('location', `%${locStr}%`);
        }

        if (filters.jobType) {
          query_builder = query_builder.eq('job_type', filters.jobType);
        }

        if (filters.category) {
          // Handle array of categories (use first one for fallback basic search)
          const cat = Array.isArray(filters.category) ? filters.category[0] : filters.category;
          if (cat) {
            query_builder = query_builder.eq('category', cat);
          }
        }

        const { data: fallbackData, error: fallbackError } = await query_builder
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .range(pageNum * 20, (pageNum + 1) * 20 - 1);

        if (requestId !== searchRequest.current) return;
        if (fallbackError) {
          throw fallbackError;
        }

        console.log('🔍 Fallback search results:', fallbackData);
        
        const transformedJobs = (fallbackData || []).map((job: any): JobResult => ({
          id: job.id,
          short_id: job.short_id, // SEO short URL
          title: job.title,
          company_name: job.companies?.company_name || 'Unknown Company',
          location: job.location,
          job_type: job.job_type,
          experience_level: job.experience_level,
          salary_range: job.salary_range || 'Salary not disclosed',
          description: job.description,
          requirements: job.requirements,
          benefits: job.benefits,
          skills: job.skills || [],
          status: job.status,
          category: job.category,
          created_at: job.created_at,
          trending_score: job.trending_score || 0,
          organic_score: job.organic_score || 0,
          organic_rank: job.organic_rank,
          views_count: job.views_count || 0,
          applications_count: job.applications_count || 0,
          calls_count: job.calls_count || 0,
          shares_count: job.shares_count || 0,
          is_boosted: job.is_boosted || false,
          boost_level: job.boost_level || 0,
          logo_url: job.companies?.logo_url,
          match_score: 0,
          is_verified: job.companies?.is_verified || false,
          verified_plan_end: job.companies?.verified_plan_end,
          badge_color: job.companies?.badge_color,
          company_instagram_link: job.companies?.instagram_link,
          company_facebook_link: job.companies?.facebook_link,
          company_youtube_link: job.companies?.youtube_link,
          company_linkedin_link: job.companies?.linkedin_link,
          // Location fields
          city: job.city,
          state: job.state,
          country: job.country
        , education_required: job.education_required, work_mode: job.work_mode, shift_timing: job.shift_timing, openings: job.openings }));

        if (reset) {
          setJobs(transformedJobs);
          setPage(0);
        } else {
          setJobs(prev => [...prev, ...transformedJobs]);
        }
        setHasMore(transformedJobs.length === 20);
        writePersistentJobsCache(searchCacheKey, { jobs: transformedJobs, hasMore: transformedJobs.length === 20 });
        return;

      }
      
      console.log('🔍 Search results:', data);

      // Long suggestion titles (underscores, numeric IDs) match nothing
      // verbatim — retry once with the meaningful words so the user still
      // gets results.
      let searchData = data;
      const simplifiedQuery = simplifySearchQuery(query);
      if ((searchData || []).length === 0 && pageNum === 0 && query.trim() && simplifiedQuery !== normalizeJobSearch(query)) {
        console.log('🔍 No results for verbatim query, retrying simplified:', simplifiedQuery);
        const retry = await supabase.rpc('fuzzy_search_jobs', {
          search_query: simplifiedQuery,
          job_location: locationFilter,
          job_type_filter: filters.jobType || '',
          experience_filter: filters.experience || '',
          salary_min: filters.salaryMin || 0,
          salary_max: filters.salaryMax || 1000000,
          category_filter: categoryFilter,
          languages_filter: languagesFilter,
          page_size: 20,
          page_offset: 0,
          sort_by: filters.sortBy || ''
        });
        if (requestId !== searchRequest.current) return;
        if (!retry.error && (retry.data || []).length > 0) {
          searchData = retry.data;
        }
      }

      // Database function now handles sorting, no need for client-side sorting
      let filteredData = searchData || [];
      
      // Apply additional client-side filters (for filters not handled by database)
      if (filters.companySize || filters.skills || filters.postedDate) {
        filteredData = filteredData.filter((job: any) => {
          // Filter by company size - this would need company info
          if (filters.companySize) {
            // Company size filtering would need additional company data
            // For now, we'll just return true
          }
          
          // Filter by skills (handle both string and array)
          if (filters.skills && job.skills) {
            const jobSkills = job.skills.map((s: string) => s.toLowerCase());
            const filterSkills = Array.isArray(filters.skills) 
              ? filters.skills.map(s => s.toLowerCase())
              : [filters.skills.toLowerCase()];
            
            // Check if job has any of the filter skills
            const hasMatchingSkill = filterSkills.some(fs => jobSkills.includes(fs));
            if (!hasMatchingSkill) {
              return false;
            }
          }
          
          // Filter by posted date
          if (filters.postedDate) {
            const jobDate = new Date(job.created_at);
            const now = new Date();
            const diffHours = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60);
            
            switch (filters.postedDate) {
              case 'Last 24 hours':
                return diffHours <= 24;
              case 'Last 7 days':
                return diffHours <= 168; // 24 * 7
              case 'Last 30 days':
                return diffHours <= 720; // 24 * 30
              default:
                return true;
            }
          }
          
          return true;
        });
      }

      const transformedJobs = (filteredData || []).map((job: any): JobResult => ({
        id: job.id,
        short_id: job.short_id, // SEO short URL
        title: job.title,
        company_name: job.company_name,
        location: job.location,
        job_type: job.job_type,
        experience_level: job.experience_level,
        salary_range: job.salary_range || 'Salary not disclosed',
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        skills: job.skills || [],
        status: job.status,
        category: job.category,
        created_at: job.created_at,
        trending_score: job.trending_score || 0,
        organic_score: job.organic_score,
        organic_rank: job.organic_rank ?? job.n ?? null,
        trending_rank: job.trending_rank ?? null,
        public_slug: job.public_slug,
        views_count: job.views_count || 0,
        applications_count: job.applications_count || 0,
        calls_count: job.calls_count || 0,
        shares_count: job.shares_count || 0,
        is_boosted: job.is_boosted || false,
        boost_level: job.boost_level || 0,
        logo_url: job.logo_url,
        match_score: job.match_score || 0,
        city: job.city,
        state: job.state,
        country: job.country,
        // Company verification fields
        is_verified: job.is_verified || false,
        verified_plan_end: job.verified_plan_end,
        badge_color: job.badge_color,
        company_instagram_link: job.company_instagram_link,
        company_facebook_link: job.company_facebook_link,
        company_youtube_link: job.company_youtube_link,
        company_linkedin_link: job.company_linkedin_link,
        education_required: job.education_required,
        work_mode: job.work_mode,
        shift_timing: job.shift_timing,
        openings: job.openings
      }));

      console.log('🔍 Transformed jobs:', transformedJobs.length, 'jobs');

      if (reset) {
        setJobs(transformedJobs);
        setPage(0);
        console.log('🔍 Reset jobs list with', transformedJobs.length, 'jobs');
      } else {
        setJobs(prev => {
          const newJobs = [...prev, ...transformedJobs];
          console.log('🔍 Added', transformedJobs.length, 'jobs to existing', prev.length, 'total:', newJobs.length);
          return newJobs;
        });
      }

      setHasMore(transformedJobs.length === 20);
      setPage(pageNum);
      writePersistentJobsCache(searchCacheKey, { jobs: transformedJobs, hasMore: transformedJobs.length === 20 });


    } catch (err) {
      if (requestId !== searchRequest.current) return;
      console.error('Error searching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to search jobs');
    } finally {
      if (requestId === searchRequest.current) {
        searchingRef.current = false;
        setLoading(false);
      }
    }
  }, [user?.id]);

  const getSuggestions = useCallback(async (query: string) => {
    const requestId = ++suggestionRequest.current;
    const key = query.trim().toLowerCase();
    const cached = suggestionCache.current.get(key);
    setSuggestions(cached || []);
    if (key.length < 2 || cached) return;
    try {
      const { data, error } = await supabase.rpc('get_search_suggestions', {
        query_text: query, limit_count: 10
      });
      if (error) throw error;
      const items = mergeSearchSuggestions((data || []).map((item: any): SearchSuggestion => ({
        suggestion: item.suggestion, type: item.type, count: item.count
      })), query, 10);
      suggestionCache.current.set(key, items);
      if (requestId === suggestionRequest.current) setSuggestions(items);
    } catch (err) {
      console.error('Error getting suggestions:', err);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!searchingRef.current && !loading && hasMore) {
      // This will be called from the component with current search params
      return page + 1;
    }
    return null;
  }, [loading, hasMore, page]);

  return {
    jobs,
    suggestions,
    loading,
    error,
    hasMore,
    searchJobs,
    getSuggestions,
    loadMore,
    page
  };
};

// Helper functions for sorting
const extractSalaryNumber = (salaryRange: string): number => {
  if (!salaryRange || salaryRange === 'Salary not disclosed') return 0;
  const match = salaryRange.match(/₹(\d+(?:,\d+)*)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''));
  }
  return 0;
};

const extractExperienceNumber = (experienceLevel: string): number => {
  if (!experienceLevel) return 0;
  const match = experienceLevel.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  if (experienceLevel.toLowerCase().includes('fresher')) return 0;
  return 0;
};