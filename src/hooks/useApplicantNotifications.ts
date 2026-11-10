import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useApplicantNotifications = () => {
  const [newApplicantCount, setNewApplicantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchApplicantNotificationCount();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchApplicantNotificationCount = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_employer_applicant_notification_count');

      if (error) throw error;

      setNewApplicantCount(data || 0);
    } catch (err) {
      console.error('Error fetching applicant notification count:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel(`applicant-notifications-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employer_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Only update for application type notifications
          if ((payload.new as any)?.type === 'application' || (payload.old as any)?.type === 'application') {
            fetchApplicantNotificationCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications'
        },
        () => {
          // Refresh count when new applications come in
          fetchApplicantNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markApplicantNotificationsAsRead = async () => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .rpc('mark_employer_applicant_notifications_read');

      if (error) throw error;

      setNewApplicantCount(0);
      return true;
    } catch (err) {
      console.error('Error marking applicant notifications as read:', err);
      return false;
    }
  };

  return {
    newApplicantCount,
    loading,
    markApplicantNotificationsAsRead,
    refetch: fetchApplicantNotificationCount
  };
};