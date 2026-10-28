import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicPricing, PRICING_TABLES } from '@/lib/publicPricing.mjs';

export function usePublicPricing() {
  const query = useQuery({ queryKey: ['public-website-pricing'], queryFn: ({ signal }) => fetchPublicPricing(signal), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 30000, refetchIntervalInBackground: false });
  const { refetch } = query;
  useEffect(() => {
    const channel = supabase.channel(`public-pricing-${Math.random().toString(36).slice(2)}`);
    for (const table of PRICING_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void refetch(); });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refetch]);
  return query;
}