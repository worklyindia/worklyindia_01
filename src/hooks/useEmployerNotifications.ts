import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';

export interface EmployerNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: any;
}

export const useEmployerNotifications = () => {
  const [notifications, setNotifications] = useState<EmployerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useEmployerAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      console.log('🔔 No employer user, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    try {
      setLoading(true);
      console.log('🔔 Fetching employer notifications for user:', user.id);
      
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('employer_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      console.log('🔔 Employer notifications fetched:', notificationsData);
      setNotifications(notificationsData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching employer notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch employer notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employer_notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      
      const count = (data || []).length;
      console.log('🔔 Employer unread count:', count);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching employer unread count:', err);
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    console.log('🔔 useEmployerNotifications hook mounted/user changed, user:', user?.id || 'undefined');
    
    setNotifications([]);
    setUnreadCount(0);
    
    if (!user) {
      console.log('🔔 Clearing all employer notification state - no user');
      setLoading(false);
      return;
    }
    
    console.log('🔔 Fetching fresh employer notification data for user:', user.id);
    setLoading(true);
    
    const fetchTimer = setTimeout(() => {
      if (isMounted && user) {
        Promise.all([
          fetchNotifications(),
          fetchUnreadCount()
        ]).finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(fetchTimer);
    };
  }, [user?.id, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    console.log('🔔 Setting up real-time subscription for employer:', user.id);

    const channel = supabase
      .channel(`employer-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employer_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time employer insert detected:', payload.new);
          const newNotification = payload.new as EmployerNotification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employer_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time employer update detected:', payload.new);
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? (payload.new as any) : n)
          );
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'employer_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time employer delete detected:', payload.old);
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          setUnreadCount(prev => {
            const deletedNotification = payload.old as any;
            return !deletedNotification.is_read ? Math.max(0, prev - 1) : prev;
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up real-time subscription for employer:', user.id);
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchUnreadCount]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('employer_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, is_read: true }
          : notif
      ));

      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('employer_notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(notif => ({ 
        ...notif, 
        is_read: true 
      })));

      return true;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      return false;
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('employer_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));

      return true;
    } catch (err) {
      console.error('Error deleting notification:', err);
      return false;
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('employer_notifications')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setNotifications([]);

      return true;
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      return false;
    }
  };

  const filterByType = (type: string) => {
    if (type === 'all') return notifications;
    return notifications.filter(n => n.type === type);
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    filterByType
  };
};