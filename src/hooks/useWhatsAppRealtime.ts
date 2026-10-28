import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

interface MessageUpdate {
  id: string;
  status: string;
  phone_number: string;
  template_name?: string;
  updated_at: string;
}

interface RealtimeStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export function useWhatsAppRealtime() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<MessageUpdate | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats>({
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0
  });

  const handleMessageUpdate = useCallback((payload: any) => {
    const { new: newRecord, old: oldRecord, eventType } = payload;
    
    if (eventType === 'UPDATE' && newRecord) {
      const update: MessageUpdate = {
        id: newRecord.id,
        status: newRecord.status,
        phone_number: newRecord.phone_number,
        template_name: newRecord.template_name,
        updated_at: newRecord.updated_at
      };
      
      setLastUpdate(update);
      
      // Update stats based on status change
      if (oldRecord?.status !== newRecord.status) {
        setRealtimeStats(prev => {
          const stats = { ...prev };
          
          // Decrement old status count
          if (oldRecord?.status) {
            const oldKey = oldRecord.status.toLowerCase() as keyof RealtimeStats;
            if (stats[oldKey] !== undefined) {
              stats[oldKey] = Math.max(0, stats[oldKey] - 1);
            }
          }
          
          // Increment new status count
          const newKey = newRecord.status.toLowerCase() as keyof RealtimeStats;
          if (stats[newKey] !== undefined) {
            stats[newKey]++;
          }
          
          return stats;
        });
        
        // Show toast for status changes
        const statusEmoji = {
          delivered: '✅',
          read: '👁️',
          failed: '❌',
          sent: '📤'
        }[newRecord.status.toLowerCase()] || '📨';
        
        if (newRecord.status.toLowerCase() === 'failed') {
          toast.error(`${statusEmoji} Message failed to ${newRecord.phone_number}`);
        }
      }
    }
    
    if (eventType === 'INSERT' && newRecord) {
      setRealtimeStats(prev => ({
        ...prev,
        sent: prev.sent + 1
      }));
    }
  }, []);

  useEffect(() => {
    if (!shouldEnableRealtime()) return;

    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        handleMessageUpdate
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleMessageUpdate]);

  const refreshStats = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('status');
    
    if (!error && data) {
      const stats: RealtimeStats = { sent: 0, delivered: 0, read: 0, failed: 0 };
      data.forEach((msg: any) => {
        const key = msg.status?.toLowerCase() as keyof RealtimeStats;
        if (stats[key] !== undefined) {
          stats[key]++;
        }
      });
      setRealtimeStats(stats);
    }
  }, []);

  return {
    isConnected,
    lastUpdate,
    realtimeStats,
    refreshStats
  };
}

// Hook for listening to campaign progress
export function useCampaignRealtime(campaignId?: string) {
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!campaignId || !shouldEnableRealtime()) return;

    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_campaigns',
          filter: `id=eq.${campaignId}`
        },
        (payload) => {
          const { new: campaign } = payload;
          if (campaign) {
            setProgress({
              sent: campaign.sent_count || 0,
              total: campaign.total_recipients || 0
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return { progress, isConnected };
}

// Hook for trigger logs realtime
export function useTriggerLogsRealtime() {
  const [newLogs, setNewLogs] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!shouldEnableRealtime()) return;

    const channel = supabase
      .channel('trigger-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_trigger_logs'
        },
        (payload) => {
          setNewLogs(prev => [payload.new, ...prev].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_trigger_logs'
        },
        (payload) => {
          setNewLogs(prev => 
            prev.map(log => log.id === payload.new.id ? payload.new : log)
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const clearNewLogs = useCallback(() => {
    setNewLogs([]);
  }, []);

  return { newLogs, isConnected, clearNewLogs };
}
