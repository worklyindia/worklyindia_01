import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  company_name: string;
  logo_url: string | null;
  active_referrals_count: number;
  last_referral_at: string | null;
}

interface UserPosition {
  rank: number;
  active_referrals_count: number;
  next_rank_gap: number;
  cycle_id: string;
  cycle_end: string;
}

interface LeaderboardHistory {
  cycle_id: string;
  cycle_start: string;
  cycle_end: string;
  user_id: string;
  company_name: string;
  final_rank: number;
  active_referrals_count: number;
  reward_amount: number;
  created_at: string;
}

export const useCurrentLeaderboard = (limit: number = 999999) => {
  return useQuery({
    queryKey: ['currentLeaderboard', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_current_leaderboard', { p_limit: limit });

      if (error) throw error;
      return data as LeaderboardEntry[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour stale time
    refetchInterval: 1000 * 60 * 60, // Refresh every 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useMyLeaderboardPosition = () => {
  return useQuery({
    queryKey: ['myLeaderboardPosition'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .rpc('get_user_leaderboard_position', { p_user_id: user.id });

      if (error) throw error;
      return data && data.length > 0 ? (data[0] as UserPosition) : null;
    },
    staleTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 60, // Every 1 hour
    refetchOnWindowFocus: false,
  });
};

export const useLeaderboardHistory = (userId?: string) => {
  return useQuery({
    queryKey: ['leaderboardHistory', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_leaderboard_history', { p_user_id: userId || null });

      if (error) throw error;
      return data as LeaderboardHistory[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour stale time
    refetchOnWindowFocus: false,
  });
};

export const useLeaderboardTimer = () => {
  return useQuery({
    queryKey: ['leaderboardTimer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_leaderboard_cycles')
        .select('cycle_start, cycle_end')
        .eq('status', 'active')
        .order('cycle_start', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data ? {
        start: new Date(data.cycle_start),
        end: new Date(data.cycle_end)
      } : null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - timer calculated client-side anyway
    refetchInterval: 1000 * 60 * 60, // Every 1 hour
    refetchOnWindowFocus: false,
  });
};
