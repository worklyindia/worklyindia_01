import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityItem {
  id: string;
  type: 'application' | 'interview' | 'status_update' | 'job_match';
  title: string;
  message: string;
  timestamp: string;
  jobId?: string;
  jobTitle?: string;
  company?: string;
  status?: string;
  isNew: boolean;
  metadata?: any;
}

interface UseRealTimeActivityOptions {
  limit?: number;
  showToastOnUpdate?: boolean;
  autoRefresh?: boolean;
}

/**
 * OPTIMIZED: Removed ALL realtime subscriptions
 * Data fetches once on mount - manual refresh available via refreshActivities()
 * This saves 2 realtime channels + cascading DB queries per event
 */
export const useRealTimeActivity = (options: UseRealTimeActivityOptions = {}) => {
  const { limit = 20 } = options;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const { user } = useAuth();

  const transformJobApplication = (application: any): ActivityItem => ({
    id: application.id,
    type: 'application',
    title: `Applied for ${application.jobs?.title || 'Job'}`,
    message: `You applied for ${application.jobs?.title} at ${application.jobs?.companies?.company_name || 'Company'}`,
    timestamp: new Date(application.applied_at).toISOString(),
    jobId: application.job_id,
    jobTitle: application.jobs?.title,
    company: application.jobs?.companies?.company_name,
    status: application.status || 'applied',
    isNew: (new Date().getTime() - new Date(application.applied_at).getTime()) < 24 * 60 * 60 * 1000,
    metadata: { applicationId: application.id }
  });

  const transformInterview = (interview: any): ActivityItem => ({
    id: interview.id,
    type: 'interview',
    title: `Interview Scheduled`,
    message: `Interview scheduled for ${interview.jobs?.title} on ${new Date(interview.scheduled_at).toLocaleDateString()}`,
    timestamp: new Date(interview.created_at).toISOString(),
    jobId: interview.job_id,
    jobTitle: interview.jobs?.title,
    company: interview.jobs?.companies?.company_name,
    status: interview.status,
    isNew: (new Date().getTime() - new Date(interview.created_at).getTime()) < 24 * 60 * 60 * 1000,
    metadata: { interviewId: interview.id, scheduledAt: interview.scheduled_at }
  });

  const fetchActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch both in parallel - only needed columns
      const [appResult, intResult] = await Promise.all([
        // @ts-ignore
        supabase
          .from('job_applications')
          .select('id, applied_at, status, job_id, jobs!inner(title, companies!inner(company_name))')
          .eq('applicant_id', user.id)
          .order('applied_at', { ascending: false })
          .limit(Math.ceil(limit / 2)),
        // @ts-ignore
        supabase
          .from('interviews')
          .select('id, created_at, scheduled_at, status, job_id, mode, jobs!inner(title, companies!inner(company_name))')
          .eq('applicant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(Math.ceil(limit / 2))
      ]);

      const applicationActivities = (appResult.data || []).map(transformJobApplication);
      const interviewActivities = (intResult.data || []).map(transformInterview);

      const allActivities = [...applicationActivities, ...interviewActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      setActivities(allActivities);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    fetchActivities();
    // NO realtime subscriptions - saves significant IO
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    newActivityCount,
    clearNewActivityCount: () => setNewActivityCount(0),
    refreshActivities: fetchActivities,
    markActivityAsRead: (activityId: string) => {
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, isNew: false } : a));
    }
  };
};
