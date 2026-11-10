import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shouldEnableRealtime } from '@/hooks/useEgressProtection';

interface UseProfileRealtimeOptions {
  userId?: string;
  tableName: 'profiles' | 'companies';
  idField?: 'user_id' | 'id';
  entityId?: string;
  onUpdate?: (data: any) => void;
}

/**
 * Hook for listening to real-time updates on profiles or companies tables
 * Useful for Telegram connection updates, profile changes, etc.
 */
export function useProfileRealtime({
  userId,
  tableName,
  idField = 'user_id',
  entityId,
  onUpdate
}: UseProfileRealtimeOptions) {
  const onUpdateRef = useRef(onUpdate);
  
  // Keep callback ref up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const filterValue = entityId || userId;

  useEffect(() => {
    if (!filterValue || !shouldEnableRealtime()) return;

    const channel = supabase
      .channel(`${tableName}-realtime-${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `${idField}=eq.${filterValue}`
        },
        (payload) => {
          console.log(`📡 [${tableName}] Real-time update received:`, payload.new);
          onUpdateRef.current?.(payload.new);
        }
      )
      .subscribe((status) => {
        console.log(`📡 [${tableName}] Subscription status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, idField, filterValue]);
}

/**
 * Hook specifically for job seeker profile real-time updates
 */
export function useJobSeekerProfileRealtime(
  userId: string | undefined,
  onUpdate: (data: any) => void
) {
  return useProfileRealtime({
    userId,
    tableName: 'profiles',
    idField: 'user_id',
    onUpdate
  });
}

/**
 * Hook specifically for company/employer profile real-time updates
 */
export function useCompanyProfileRealtime(
  companyId: string | undefined,
  onUpdate: (data: any) => void
) {
  return useProfileRealtime({
    tableName: 'companies',
    idField: 'id',
    entityId: companyId,
    onUpdate
  });
}
