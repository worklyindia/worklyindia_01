import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Re-runs `onChange` whenever the given public table changes (insert/update/delete). */
export function useLiveTableRefresh(table: string, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const channel = supabase
      .channel(`live-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table }, () => cb.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table]);
}
