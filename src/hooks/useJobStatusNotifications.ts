import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { JobStatusNotificationService } from '@/services/JobStatusNotificationService';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

export const useJobStatusNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!shouldEnableRealtime()) return;

    console.log('🔔 Setting up job status notification listeners for user:', user.id);

    // Listen for job application status changes
    const applicationChannel = supabase
      .channel(`job-application-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_applications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 Job application status changed:', payload);
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Only notify if status actually changed
          if (newData.status !== oldData.status) {
            await JobStatusNotificationService.handleApplicationStatusChange({
              user_id: newData.user_id,
              job_id: newData.job_id,
              status: newData.status,
              previous_status: oldData.status
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 New job application created:', payload);
          const newData = payload.new as any;
          
          await JobStatusNotificationService.handleApplicationStatusChange({
            user_id: newData.user_id,
            job_id: newData.job_id,
            status: newData.status
          });
        }
      )
      .subscribe();

    // Listen for interview changes
    const interviewChannel = supabase
      .channel(`interview-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews',
          filter: `applicant_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 Interview status changed:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const interviewData = payload.new as any;
            await JobStatusNotificationService.handleInterviewStatusChange(interviewData);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up job status notification listeners');
      supabase.removeChannel(applicationChannel);
      supabase.removeChannel(interviewChannel);
    };
  }, [user]);

  return {
    // Utility methods for manual notifications
    notifyApplicationStatus: JobStatusNotificationService.notifyApplicationStatusChange,
    notifyInterviewStatus: JobStatusNotificationService.notifyInterviewStatusChange,
    notifyJobRecommendation: JobStatusNotificationService.notifyJobRecommendation
  };
};