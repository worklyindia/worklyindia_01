import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import type { User } from '@supabase/supabase-js';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  action_url?: string;
  metadata: any;
  created_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Use context directly to avoid throwing if provider is missing
  const authContext = useContext(AuthContext);
  const user: User | null = authContext?.user ?? null;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      console.log('🔔 No user, clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      console.log('🔔 Fetching job seeker notifications for user:', user.id);
      
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          metadata,
          companies!left(account_status)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      console.log('🔔 Raw notifications data:', data);
      
      // Filter out notifications from banned companies
      const filteredData = (data || []).filter((item: any) => {
        if (item.metadata?.company_id && item.companies?.account_status === 'banned') {
          console.log('🔔 Filtering out notification from banned company:', item.metadata.company_id);
          return false;
        }
        return true;
      });
      
      const mappedNotifications = filteredData.map((item: any) => ({
        ...item,
        type: item.type as 'info' | 'success' | 'warning' | 'error'
      }));
      
      console.log('🔔 Mapped job seeker notifications:', mappedNotifications);
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('🔔 Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      console.log('🔔 No user for unread count, setting to 0');
      setUnreadCount(0);
      return;
    }

    try {
      console.log('🔔 Fetching unread count for job seeker:', user.id);
      
      // Get all unread notifications with company data
      const { data: unreadNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select(`
          *,
          metadata,
          companies!left(account_status)
        `)
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (fetchError) throw fetchError;

      // Filter out notifications from banned companies
      const filteredNotifications = (unreadNotifications || []).filter((notif: any) => {
        if (notif.metadata?.company_id && notif.companies?.account_status === 'banned') {
          return false;
        }
        return true;
      });

      const actualUnreadCount = filteredNotifications.length;

      console.log('🔔 Filtered unread notifications count:', actualUnreadCount);
      setUnreadCount(actualUnreadCount);
      
    } catch (error) {
      console.error('🔔 Error fetching unread count:', error);
      setUnreadCount(0);
    }
  }, [user]);

  // Clear stale data on mount and user changes with mounting guards
  useEffect(() => {
    let isMounted = true;
    console.log('🔔 useNotifications (job seeker) hook mounted/user changed, user:', user?.id || 'undefined');
    
    // Immediately clear state to prevent stale notifications
    setNotifications([]);
    setUnreadCount(0);
    
    // Force clear any stale state immediately
    if (!user) {
      console.log('🔔 Clearing all notification state - no user');
      setLoading(false);
      return;
    }
    
    console.log('🔔 Fetching fresh notification data for job seeker:', user.id);
    setLoading(true);
    
    // Add small delay to prevent race conditions
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

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      );

      // Update unread count
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user, fetchUnreadCount]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('🔔 Delete error:', error);
        throw error;
      }

      console.log('🔔 Notification deleted successfully:', notificationId);

      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );

      // Update unread count immediately
      fetchUnreadCount();

      return true;
    } catch (error) {
      console.error('🔔 Error deleting notification:', error);
      return false;
    }
  }, [user, fetchUnreadCount]);

  // Set up real-time subscription for new notifications and company changes
  useEffect(() => {
    if (!user) {
      // Ensure clean state when no user
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!shouldEnableRealtime()) return;

    console.log('🔔 Setting up real-time subscription for job seeker:', user.id);

    const channelName = `notifications-changes-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 Real-time insert detected:', payload.new);
          const newNotification = payload.new as Notification;
          
          // Check if notification is from a banned company
          if ((newNotification as any).metadata?.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('account_status')
              .eq('id', (newNotification as any).metadata.company_id)
              .maybeSingle();
              
            if (company?.account_status === 'banned') {
              console.log('🔔 Ignoring notification from banned company');
              return;
            }
          }
          
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time update detected:', payload.new);
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
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Real-time delete detected:', payload.old);
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          setUnreadCount(prev => {
            const deletedNotification = payload.old as any;
            return !deletedNotification.is_read ? Math.max(0, prev - 1) : prev;
          });
        }
      )
      // Listen for company status changes to refresh notification counts
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
        },
        (payload) => {
          console.log('🔔 Company status change detected:', payload.new);
          if (payload.new.account_status === 'banned' || payload.old?.account_status === 'banned') {
            console.log('🔔 Company ban status changed, refreshing notifications');
            fetchNotifications();
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up real-time subscription for job seeker:', user.id);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createNotification = useCallback(async ({ 
    userId, 
    title, 
    message, 
    type = 'info', 
    actionUrl 
  }: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    actionUrl?: string;
  }) => {
    try {
      // Insert notification into database (this will trigger the push notification automatically via database trigger)
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          action_url: actionUrl,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('🔔 Notification created successfully:', data);
      return data;
    } catch (error) {
      console.error('🔔 Error creating notification:', error);
      throw error;
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    refetch: fetchNotifications
  };
};