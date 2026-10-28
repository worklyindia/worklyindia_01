import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecommendedJob {
  job_id: string;
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
  score?: number; // Legacy field, now optional
  // New match scoring fields
  match_score: number;
  match_reason: string;
  city?: string;
  state?: string;
  country?: string;
  languages?: string[];
  // Company verification fields
  is_verified: boolean;
  verified_plan_end?: string;
  badge_color?: string;
  company_instagram_link?: string;
  company_facebook_link?: string;
  company_youtube_link?: string;
  company_linkedin_link?: string;
  // Company coordinates for distance calculation
  company_latitude?: number;
  company_longitude?: number;
}

export const useJobRecommendations = (userId?: string | null) => {
  const [recommendations, setRecommendations] = useState<RecommendedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error: rpcError } = await supabase.rpc('get_personalized_jobs_by_location', {
          p_user_id: userId || null,
          p_limit: 12,
          p_offset: 0
        });

        if (rpcError) {
          throw rpcError;
        }

      // If no recommendations, fetch latest active jobs as fallback
      if (!data || data.length === 0) {
        console.log('🔄 No recommended jobs from RPC, fetching fallback jobs...');
        
        const { data: fallbackJobs, error: fallbackError } = await supabase
          .from('jobs')
          .select(`
            id,
            title,
            location,
            job_type,
            experience_level,
            salary_range,
            description,
            category,
            skills,
            is_boosted,
            boost_level,
            created_at,
            views_count,
            applications_count,
            companies (
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
              longitude,
              account_status
            )
          `)
          .eq('status', 'active')
          .eq('visibility', 'public')
          .not('companies', 'is', null)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(12);

        if (fallbackError) {
          console.error('❌ Fallback jobs fetch error:', fallbackError);
          setRecommendations([]);
        } else if (fallbackJobs && fallbackJobs.length > 0) {
          console.log('✅ Fetched', fallbackJobs.length, 'fallback jobs');
          
          // Filter out jobs from inactive companies and transform
          const transformedJobs = await Promise.all(
            fallbackJobs
              .filter(job => job.companies && job.companies.account_status === 'active')
              .map(async (job) => {
                // Fetch views count using security definer function
                const { data: viewsCount } = await supabase.rpc('get_job_view_count', { 
                  p_job_id: job.id 
                });
                
                // Fetch applications count using security definer function
                const { data: applicationsCount } = await supabase.rpc('get_job_application_count', { 
                  p_job_id: job.id 
                });
                
                return {
                  job_id: job.id,
                  title: job.title,
                  company: job.companies.company_name,
                  location: job.location,
                  job_type: job.job_type,
                  experience_level: job.experience_level,
                  salary_range: job.salary_range,
                  description: job.description,
                  category: job.category,
                  skills: job.skills || [],
                  is_boosted: job.is_boosted,
                  boost_level: job.boost_level,
                  created_at: job.created_at,
                  views_count: viewsCount || job.views_count || 0,
                  applications_count: applicationsCount || job.applications_count || 0,
                  logo_url: job.companies.logo_url,
                  score: job.is_boosted ? job.boost_level * 10 : 0,
                  match_score: 0,
                  match_reason: 'Popular',
                  is_verified: job.companies.is_verified || false,
                  verified_plan_end: job.companies.verified_plan_end,
                  badge_color: job.companies.badge_color || 'gold',
                  company_instagram_link: job.companies.instagram_link,
                  company_facebook_link: job.companies.facebook_link,
                  company_youtube_link: job.companies.youtube_link,
                  company_linkedin_link: job.companies.linkedin_link
                };
              })
          );
          
          console.log('✅ Transformed', transformedJobs.length, 'jobs after filtering');
          setRecommendations(transformedJobs);
        } else {
          console.log('⚠️ No fallback jobs found');
          setRecommendations([]);
        }
      } else {
        console.log('✅ Got', data.length, 'recommended jobs from RPC');
        setRecommendations(data);
      }
      } catch (err) {
        console.error('Error fetching job recommendations:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [userId]);

  const refreshRecommendations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: rpcError } = await supabase.rpc('get_personalized_jobs_by_location', {
        p_user_id: userId || null,
        p_limit: 12,
        p_offset: 0
      });

      if (rpcError) {
        throw rpcError;
      }

      // If no recommendations, fetch latest active jobs as fallback
      if (!data || data.length === 0) {
        console.log('🔄 No recommended jobs from refresh, fetching fallback jobs...');
        
        const { data: fallbackJobs, error: fallbackError } = await supabase
          .from('jobs')
          .select(`
            id,
            title,
            location,
            job_type,
            experience_level,
            salary_range,
            description,
            category,
            skills,
            is_boosted,
            boost_level,
            created_at,
            views_count,
            applications_count,
            companies (
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
              longitude,
              account_status
            )
          `)
          .eq('status', 'active')
          .eq('visibility', 'public')
          .not('companies', 'is', null)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(12);

        if (fallbackError) {
          console.error('❌ Fallback jobs fetch error:', fallbackError);
          setRecommendations([]);
        } else if (fallbackJobs && fallbackJobs.length > 0) {
          console.log('✅ Fetched', fallbackJobs.length, 'fallback jobs on refresh');
          
          // Filter out jobs from inactive companies and transform
          const transformedJobs = await Promise.all(
            fallbackJobs
              .filter(job => job.companies && job.companies.account_status === 'active')
              .map(async (job) => {
                // Fetch views count using security definer function
                const { data: viewsCount } = await supabase.rpc('get_job_view_count', { 
                  p_job_id: job.id 
                });
                
                // Fetch applications count using security definer function
                const { data: applicationsCount } = await supabase.rpc('get_job_application_count', { 
                  p_job_id: job.id 
                });
                
                return {
                  job_id: job.id,
                  title: job.title,
                  company: job.companies.company_name,
                  location: job.location,
                  job_type: job.job_type,
                  experience_level: job.experience_level,
                  salary_range: job.salary_range,
                  description: job.description,
                  category: job.category,
                  skills: job.skills || [],
                  is_boosted: job.is_boosted,
                  boost_level: job.boost_level,
                  created_at: job.created_at,
                  views_count: viewsCount || job.views_count || 0,
                  applications_count: applicationsCount || job.applications_count || 0,
                  logo_url: job.companies.logo_url,
                  score: job.is_boosted ? job.boost_level * 10 : 0,
                  match_score: 0,
                  match_reason: 'Popular',
                  is_verified: job.companies.is_verified || false,
                  verified_plan_end: job.companies.verified_plan_end,
                  badge_color: job.companies.badge_color || 'gold',
                  company_instagram_link: job.companies.instagram_link,
                  company_facebook_link: job.companies.facebook_link,
                  company_youtube_link: job.companies.youtube_link,
                  company_linkedin_link: job.companies.linkedin_link
                };
              })
          );
          
          console.log('✅ Transformed', transformedJobs.length, 'jobs after filtering on refresh');
          setRecommendations(transformedJobs);
        } else {
          console.log('⚠️ No fallback jobs found on refresh');
          setRecommendations([]);
        }
      } else {
        console.log('✅ Got', data.length, 'recommended jobs from refresh RPC');
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Error refreshing recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    recommendations,
    isLoading,
    error,
    refreshRecommendations
  };
};