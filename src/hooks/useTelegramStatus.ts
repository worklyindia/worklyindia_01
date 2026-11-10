import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSafeRealtime } from './useSafeRealtime';
import { useToast } from '@/hooks/use-toast';

interface TelegramStatus {
  telegramId: number | null;
  telegramUsername: string | null;
  telegramChatId: number | null;
  telegramConnectedAt: string | null;
  notificationsEnabled: boolean;
  isLoading: boolean;
}

interface UseTelegramStatusOptions {
  userType: 'profile' | 'company';
  userId: string | null;
  companyId?: string | null;
}

export const useTelegramStatus = ({ userType, userId, companyId }: UseTelegramStatusOptions) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<TelegramStatus>({
    telegramId: null,
    telegramUsername: null,
    telegramChatId: null,
    telegramConnectedAt: null,
    notificationsEnabled: false,
    isLoading: true,
  });

  const idValue = userType === 'profile' ? userId : companyId;

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    if (!idValue) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const query = userType === 'profile'
        ? supabase
            .from('profiles')
            .select('telegram_id, telegram_username, telegram_chat_id, telegram_connected_at, telegram_notifications_enabled')
            .eq('user_id', idValue)
            .maybeSingle()
        : supabase
            .from('companies')
            .select('telegram_id, telegram_username, telegram_chat_id, telegram_connected_at, telegram_notifications_enabled')
            .eq('id', idValue)
            .maybeSingle();

      const { data, error } = await query;

      if (error) throw error;

      setStatus({
        telegramId: data?.telegram_id || null,
        telegramUsername: data?.telegram_username || null,
        telegramChatId: data?.telegram_chat_id || null,
        telegramConnectedAt: data?.telegram_connected_at || null,
        notificationsEnabled: data?.telegram_notifications_enabled ?? false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching telegram status:', error);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, [userType, idValue]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Real-time updates
  useSafeRealtime({
    table: userType === 'profile' ? 'profiles' : 'companies',
    event: 'UPDATE',
    filter: `${userType === 'profile' ? 'user_id' : 'id'}=eq.${idValue}`,
    enabled: !!idValue,
    onData: (payload) => {
      const newRecord = payload.new as any;
      setStatus(prev => ({
        ...prev,
        telegramId: newRecord?.telegram_id ?? prev.telegramId,
        telegramUsername: newRecord?.telegram_username ?? prev.telegramUsername,
        telegramChatId: newRecord?.telegram_chat_id ?? prev.telegramChatId,
        telegramConnectedAt: newRecord?.telegram_connected_at ?? prev.telegramConnectedAt,
        notificationsEnabled: newRecord?.telegram_notifications_enabled ?? prev.notificationsEnabled,
      }));
    },
  });

  // Toggle notifications
  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!idValue) return;

    try {
      const updateQuery = userType === 'profile'
        ? supabase
            .from('profiles')
            .update({ telegram_notifications_enabled: enabled })
            .eq('user_id', idValue)
        : supabase
            .from('companies')
            .update({ telegram_notifications_enabled: enabled })
            .eq('id', idValue);

      const { error } = await updateQuery;

      if (error) throw error;

      setStatus(prev => ({ ...prev, notificationsEnabled: enabled }));
      
      toast({
        title: enabled ? "Telegram Notifications Enabled" : "Telegram Notifications Disabled",
        description: enabled 
          ? "You will receive notifications via Telegram" 
          : "Telegram notifications have been turned off",
      });
    } catch (error) {
      console.error('Error toggling telegram notifications:', error);
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    }
  }, [userType, idValue, toast]);

  // Disconnect Telegram
  const disconnectTelegram = useCallback(async () => {
    if (!idValue) return;

    // Website se disconnect karne par pehle Disconnect template bhejte hain.
    // Chat id hamesha state me nahi hota, isliye fresh row se resolve karte hain
    // (private chat me chat_id === telegram_id hota hai).
    try {
      const { data: row } = userType === 'profile'
        ? await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_id, full_name')
            .eq('user_id', idValue)
            .maybeSingle()
        : await supabase
            .from('companies')
            .select('telegram_chat_id, telegram_id, company_name')
            .eq('id', idValue)
            .maybeSingle();

      const chatId =
        (row as any)?.telegram_chat_id ??
        (row as any)?.telegram_id ??
        status.telegramChatId ??
        status.telegramId;

      if (chatId) {
        const name =
          (row as any)?.full_name ||
          (row as any)?.company_name ||
          status.telegramUsername ||
          'there';

        await supabase.functions.invoke('email-api/telegram', {
          body: {
            action: 'send_template',
            audience: userType === 'profile' ? 'job_seeker' : 'employer',
            chat_id: chatId,
            event_type: 'unsubscribe',
            variables: { name },
          },
        });
      }
    } catch (e) {
      console.warn('Disconnect template send failed:', e);
    }


    try {

      const updateQuery = userType === 'profile'
        ? supabase
            .from('profiles')
            .update({
              telegram_id: null,
              telegram_username: null,
              telegram_connected_at: null,
              telegram_notifications_enabled: false,
              telegram_chat_id: null,
            })
            .eq('user_id', idValue)
        : supabase
            .from('companies')
            .update({
              telegram_id: null,
              telegram_username: null,
              telegram_connected_at: null,
              telegram_notifications_enabled: false,
              telegram_chat_id: null,
            })
            .eq('id', idValue);

      const { error } = await updateQuery;

      if (error) throw error;

      setStatus({
        telegramId: null,
        telegramUsername: null,
        telegramChatId: null,
        telegramConnectedAt: null,
        notificationsEnabled: false,
        isLoading: false,
      });

      toast({
        title: "Telegram Disconnected",
        description: "Your Telegram account has been disconnected",
      });
    } catch (error) {
      console.error('Error disconnecting telegram:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Telegram",
        variant: "destructive",
      });
    }
  }, [userType, idValue, toast, status.telegramChatId, status.telegramId, status.telegramUsername]);


  return {
    ...status,
    isConnected: !!status.telegramId,
    isChatVerified: !!status.telegramChatId,
    toggleNotifications,
    disconnectTelegram,
    refetch: fetchStatus,
  };
};
