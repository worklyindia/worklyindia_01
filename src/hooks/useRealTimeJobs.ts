import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatDateWithTime } from '@/utils/dateFormatUtils';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  experience: string;
  description: string;
  posted: string;
  isNew: boolean;
  tags: string[];
  trendingScore: number;
  viewsCount: number;
  applicationsCount: number;
  callsCount: number;
  sharesCount: number;
  isBoosted: boolean;
  boostLevel: number;
  isVerified: boolean;
  badgeColor: string;
  verifiedPlanEnd?: string;
  apiCompanyName?: string;
  logo_url?: string;
}

interface UseRealTimeJobsOptions {
  limit?: number;
  showToastOnNewJob?: boolean;
  filterStatus?: 'active' | 'all';
}

export const useRealTimeJobs = (options: UseRealTimeJobsOptions = {}) => {
  const navigate = useNavigate();
  const {
    limit = 10,
    showToastOnNewJob = true,
    filterStatus = 'active'
  } = options;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newJobsCount, setNewJobsCount] = useState(0);

  /**
   * OPTIMIZED: Removed per-job RPC calls (get_job_view_count, get_job_application_count)
   * Now uses joined data counts directly - saves 2 DB queries per job
   */
  const transformJobData = (jobData: any): Job => {
    const callsCount = jobData.job_interactions?.filter(
      (interaction: any) => interaction.interaction_type === 'call'
    ).length || 0;
    
    const sharesCount = jobData.job_interactions?.filter(
      (interaction: any) => interaction.interaction_type === 'share'
    ).length || 0;

    const viewsCount = jobData.job_interactions?.filter(
      (interaction: any) => interaction.interaction_type === 'view'
    ).length || jobData.views_count || 0;

    const applicationsCount = jobData.job_applications?.length || 0;
    
    return {
      id: jobData.id,
      title: jobData.title,
      company: jobData.companies?.company_name || 'Company Name',
      location: jobData.location,
      salary: jobData.salary_min && jobData.salary_max 
        ? `${jobData.salary_currency || '₹'} ${jobData.salary_min.toLocaleString()} - ${jobData.salary_max.toLocaleString()} / ${jobData.salary_period || 'year'}`
        : jobData.salary_range || 'Salary not disclosed',
      type: jobData.job_type,
      experience: jobData.experience_level,
      description: jobData.description,
      posted: formatDateWithTime(jobData.created_at),
      isNew: (new Date().getTime() - new Date(jobData.created_at).getTime()) < 24 * 60 * 60 * 1000,
      tags: jobData.skills || [],
      trendingScore: jobData.trending_score || 0,
      viewsCount,
      applicationsCount,
      callsCount,
      sharesCount,
      isBoosted: jobData.is_boosted || false,
      boostLevel: jobData.boost_level || 0,
      isVerified: jobData.companies?.is_verified || false,
      badgeColor: jobData.companies?.badge_color || 'gold',
      verifiedPlanEnd: jobData.companies?.verified_plan_end,
      apiCompanyName: jobData.api_company_name,
      logo_url: jobData.companies?.logo_url
    };
  };

  // Simplified select - only needed columns
  const JOB_SELECT = `
    id, title, location, salary_range, salary_min, salary_max, salary_currency, salary_period,
    job_type, experience_level, description, created_at, skills, trending_score,
    views_count, is_boosted, boost_level, api_company_name, status, visibility,
    companies(company_name, logo_url, is_verified, verified_plan_end, badge_color),
    job_interactions!job_interactions_job_id_fkey(interaction_type),
    job_applications!job_applications_job_id_fkey(id)
  `;

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('jobs')
        .select(JOB_SELECT)
        .eq('status', 'active')
        .eq('visibility', 'public')
        .not('companies', 'is', null)
        .order('created_at', { ascending: false });

      if (limit > 0) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Database query error:', fetchError);
        setJobs([]);
        return;
      }

      const transformedJobs = (data || []).map(transformJobData);
      setJobs(transformedJobs);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setJobs([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [limit, filterStatus]);

  /**
   * OPTIMIZED: Only listen for INSERT events (not UPDATE/DELETE)
   * Updates and deletes will be reflected on next page load
   * This reduces realtime message processing significantly
   */
  useEffect(() => {
    fetchJobs();

    if (!shouldEnableRealtime()) return;

    const channel = supabase
      .channel('realtime-jobs-lite')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs'
        },
        async (payload) => {
          const { data: newJobData, error } = await supabase
            .from('jobs')
            .select(JOB_SELECT)
            .eq('id', payload.new.id)
            .eq('status', 'active')
            .eq('visibility', 'public')
            .maybeSingle();

          if (!error && newJobData) {
            const transformedJob = transformJobData(newJobData);
            
            setJobs(prevJobs => {
              const exists = prevJobs.some(job => job.id === transformedJob.id);
              if (exists) return prevJobs;
              const newJobs = [transformedJob, ...prevJobs];
              return limit > 0 ? newJobs.slice(0, limit) : newJobs;
            });

            setNewJobsCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs, limit]);

  return {
    jobs,
    loading,
    error,
    newJobsCount,
    clearNewJobsCount: () => setNewJobsCount(0),
    refreshJobs: fetchJobs
  };
};
