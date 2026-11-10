import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

interface RealTimeSyncProps {
  onFunctionLogsUpdate?: () => void;
  onEdgeFunctionsUpdate?: () => void;
  onSecretsUpdate?: () => void;
}

export const RealTimeSync = ({ 
  onFunctionLogsUpdate, 
  onEdgeFunctionsUpdate, 
  onSecretsUpdate 
}: RealTimeSyncProps) => {
  
  useEffect(() => {
    if (!shouldEnableRealtime()) {
      return;
    }

    // Set up real-time subscriptions for platform data
    const functionLogsChannel = supabase
      .channel('function-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'function_logs'
        },
        (payload) => {
          console.log('Function logs change:', payload);
          onFunctionLogsUpdate?.();
        }
      )
      .subscribe();

    const edgeFunctionsChannel = supabase
      .channel('edge-functions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edge_functions'
        },
        (payload) => {
          console.log('Edge functions change:', payload);
          onEdgeFunctionsUpdate?.();
        }
      )
      .subscribe();

    const secretsChannel = supabase
      .channel('secrets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'secrets_management'
        },
        (payload) => {
          console.log('Secrets change:', payload);
          onSecretsUpdate?.();
        }
      )
      .subscribe();

    // Auto-sync function deployments every 5 minutes
    const syncInterval = setInterval(async () => {
      try {
        // This would sync with actual Supabase Edge Functions API in production
        console.log('Auto-syncing edge functions status...');
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      supabase.removeChannel(functionLogsChannel);
      supabase.removeChannel(edgeFunctionsChannel);
      supabase.removeChannel(secretsChannel);
      clearInterval(syncInterval);
    };
  }, [onFunctionLogsUpdate, onEdgeFunctionsUpdate, onSecretsUpdate]);

  return null; // This is a utility component with no UI
};

export default RealTimeSync;