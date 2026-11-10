import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useReferralProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['referralProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('referral_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
  });
};