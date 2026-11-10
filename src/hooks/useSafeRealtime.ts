import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseSafeRealtimeOptions<T> {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onData: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

/**
 * Safe realtime hook that handles errors gracefully
 * Won't break the app if realtime connection fails
 */
export const useSafeRealtime = <T extends Record<string, unknown>>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onData,
  enabled = true,
}: UseSafeRealtimeOptions<T>) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log(`🔌 Cleaning up realtime channel for ${table}`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [table]);

  const subscribe = useCallback(() => {
    // Don't subscribe if not enabled or already subscribed
    if (!enabled || channelRef.current) return;
    
    // Don't retry too many times
    if (retryCountRef.current >= maxRetries) {
      console.warn(`⚠️ Max retries reached for ${table} realtime, giving up`);
      return;
    }

    try {
      const channelName = `safe-${table}-${Date.now()}`;
      
      const channelConfig: any = {
        event,
        schema,
        table,
      };
      
      if (filter) {
        channelConfig.filter = filter;
      }

      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          channelConfig,
          (payload) => {
            // Reset retry count on successful message
            retryCountRef.current = 0;
            onData(payload as RealtimePostgresChangesPayload<T>);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Realtime subscribed to ${table}`);
            retryCountRef.current = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Realtime ${status} for ${table}:`, err);
            cleanup();
            
            // Retry with exponential backoff
            retryCountRef.current++;
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
            
            if (retryCountRef.current < maxRetries) {
              console.log(`🔄 Retrying ${table} realtime in ${delay}ms...`);
              setTimeout(subscribe, delay);
            }
          } else if (status === 'CLOSED') {
            console.log(`📴 Realtime closed for ${table}`);
          }
        });
    } catch (error) {
      console.error(`❌ Failed to setup realtime for ${table}:`, error);
    }
  }, [table, schema, event, filter, onData, enabled, cleanup]);

  useEffect(() => {
    // Only subscribe if online
    if (!navigator.onLine) {
      console.log(`⏸️ Skipping realtime for ${table} - offline`);
      return;
    }

    subscribe();

    // Handle online/offline
    const handleOnline = () => {
      console.log(`🌐 Back online, reconnecting ${table}...`);
      retryCountRef.current = 0;
      subscribe();
    };

    const handleOffline = () => {
      console.log(`📴 Offline, pausing ${table} realtime`);
      cleanup();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cleanup();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [subscribe, cleanup, table]);

  return {
    isConnected: !!channelRef.current,
    reconnect: () => {
      retryCountRef.current = 0;
      cleanup();
      subscribe();
    },
  };
};
