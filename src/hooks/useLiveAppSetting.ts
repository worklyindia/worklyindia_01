import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Reads one boolean app_settings key and follows owner changes live (realtime). */
export const useLiveAppSetting = (key: string) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', key)
          .maybeSingle();
        if (active) setEnabled((data?.setting_value ?? 'false') === 'true');
      } catch {
        if (active) setEnabled(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const channel = supabase
      .channel(`app_setting_${key}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `setting_key=eq.${key}` },
        (payload) => {
          const row = payload.new as { setting_value?: string } | null;
          if (active && row && 'setting_value' in row) setEnabled(row.setting_value === 'true');
          else void load();
        },
      )
      .subscribe((status) => { if (status === 'SUBSCRIBED') void load(); });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return { enabled, loading };
};

export default useLiveAppSetting;
