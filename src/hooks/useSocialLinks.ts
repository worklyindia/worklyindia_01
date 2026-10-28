import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  telegram?: string;
  whatsapp?: string;
}

export const useSocialLinks = () => {
  const queryClient = useQueryClient();
  const id = useId();
  useEffect(() => {
    const channel = supabase.channel(`social-links-updates-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.social_links' }, () => {
      void queryClient.invalidateQueries({ queryKey: ['social-links'] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, queryClient]);
  const { data, isLoading, error } = useQuery({
    queryKey: ['social-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'social_links')
        .maybeSingle();

      if (error) {
        console.error('Error fetching social links:', error);
        return {} as SocialLinks;
      }

      return (data?.value || {}) as SocialLinks;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
    refetchOnReconnect: false,
    select: (remote) => {
      // Only return admin-configured links. No brand defaults — so icons
      // never open the wrong (default) URL, and unconfigured platforms
      // are simply hidden by the consumer.
      const out: SocialLinks = {};
      Object.entries(remote || {}).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim() && !k.endsWith('_handle')) {
          (out as Record<string, string>)[k] = v.trim();
        }
      });
      return out;
    },
  });

  return {
    socialLinks: (data || {}) as SocialLinks,
    isLoading,
    error
  };
};
