import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveSocialIcons, SOCIAL_ICON_FIELDS, SOCIAL_ICON_QUERY_KEY } from '@/lib/emailSocialIcons';

export const useEmailSocialIcons = () => {
  const queryClient = useQueryClient();
  const id = useId();
  useEffect(() => {
    const channel = supabase.channel(`email-social-icons-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, payload => {
        const row = payload.new as { setting_key?: string };
        const old = payload.old as { setting_key?: string };
        const key = row.setting_key || old.setting_key;
        if (!key || SOCIAL_ICON_FIELDS.includes(key)) {
          void queryClient.invalidateQueries({ queryKey: SOCIAL_ICON_QUERY_KEY });
        }
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient]);
  const query = useQuery({
    queryKey: SOCIAL_ICON_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings')
        .select('setting_key, setting_value').in('setting_key', SOCIAL_ICON_FIELDS);
      if (error) throw error;
      return Object.fromEntries((data || []).map(row => [row.setting_key, row.setting_value || '']));
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: 'always',
  });
  return { ...query, socialIcons: resolveSocialIcons(query.data || {}) };
};