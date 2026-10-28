import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface JobAnalytics {
  total_views: number;
  unique_views: number;
  total_applications: number;
  calls_count: number;
  shares_count: number;
  conversion_rate: number;
  views_this_week: number;
  applications_this_week: number;
}

export const useJobAnalytics = (jobId?: string, timeRange: string = '30d') => {
  const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user && jobId) {
      fetchAnalytics();
    }
  }, [user, jobId, timeRange]);

  const fetchAnalytics = async () => {
    if (!user || !jobId) return;
    
    try {
      setLoading(true);
      
      // First verify user owns this job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          views_count,
          applications_count,
          calls_count,
          shares_count,
          companies!inner(user_id)
        `)
        .eq('id', jobId)
        .eq('companies.user_id', user.id)
        .single();

      if (jobError || !job) {
        throw new Error('Job not found or access denied');
      }

      // Calculate date range based on timeRange parameter
      const getDaysAgo = (range: string) => {
        switch (range) {
          case '7d': return 7;
          case '30d': return 30;
          case '90d': return 90;
          case '1y': return 365;
          default: return 30;
        }
      };

      const daysAgo = getDaysAgo(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Get views within time range
      const { data: rangeViews } = await supabase
        .from('job_interactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('interaction_type', 'view')
        .gte('created_at', startDate.toISOString());

      // Get applications within time range
      const { data: rangeApplications } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .gte('applied_at', startDate.toISOString());

      // Get calls within time range
      const { data: rangeCalls } = await supabase
        .from('job_interactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('interaction_type', 'call')
        .gte('created_at', startDate.toISOString());

      // Get shares within time range
      const { data: rangeShares } = await supabase
        .from('job_interactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('interaction_type', 'share')
        .gte('created_at', startDate.toISOString());

      // Get unique views count for time range
      const uniqueViews = new Set(rangeViews?.map(v => v.user_id).filter(Boolean)).size;

      // Get views this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: weeklyViews } = await supabase
        .from('job_interactions')
        .select('*')
        .eq('job_id', jobId)
        .eq('interaction_type', 'view')
        .gte('created_at', oneWeekAgo.toISOString());

      // Get applications this week
      const { data: weeklyApplications } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .gte('applied_at', oneWeekAgo.toISOString());

      const total_views = rangeViews?.length || 0;
      const total_applications = rangeApplications?.length || 0;
      const calls_count = rangeCalls?.length || 0;
      const shares_count = rangeShares?.length || 0;
      const conversion_rate = total_views > 0 ? (total_applications / total_views) * 100 : 0;

      const analyticsData: JobAnalytics = {
        total_views,
        unique_views: uniqueViews,
        total_applications,
        calls_count,
        shares_count,
        conversion_rate: Number(conversion_rate.toFixed(1)),
        views_this_week: weeklyViews?.length || 0,
        applications_this_week: weeklyApplications?.length || 0
      };

      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics
  };
};