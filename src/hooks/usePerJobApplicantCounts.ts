import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface JobApplicantCount {
  job_id: string;
  total_applicants: number;
  unread_count: number;
  last_viewed_at: string | null;
}

export const usePerJobApplicantCounts = () => {
  const [counts, setCounts] = useState<Record<string, JobApplicantCount>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCounts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_unread_applicants_per_job', { p_employer_id: user.id });

      if (error) throw error;

      // Convert array to object for easy lookup by job_id
      const countsMap: Record<string, JobApplicantCount> = {};
      data?.forEach((item: any) => {
        countsMap[item.job_id] = {
          job_id: item.job_id,
          total_applicants: Number(item.total_applicants || 0),
          unread_count: Number(item.unread_count || 0),
          last_viewed_at: item.last_viewed_at
        };
      });
      
      setCounts(countsMap);
    } catch (err) {
      console.error('Error fetching per-job applicant counts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCounts();
    }
  }, [user]);

  // Subscribe to new applications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('job-applications-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications'
        },
        () => {
          // Refresh counts when new application arrives
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markJobAsViewed = async (jobId: string) => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .rpc('mark_job_applicants_viewed', { 
          p_job_id: jobId,
          p_employer_id: user.id 
        });

      if (error) throw error;

      // Update local state
      setCounts(prev => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          unread_count: 0,
          last_viewed_at: new Date().toISOString()
        }
      }));

      return true;
    } catch (err) {
      console.error('Error marking job applicants as viewed:', err);
      return false;
    }
  };

  return {
    counts,
    loading,
    refetch: fetchCounts,
    markJobAsViewed
  };
};
