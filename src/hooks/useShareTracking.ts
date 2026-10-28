import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Unlock thresholds for gamification
export const UNLOCK_THRESHOLDS = {
  ai_resume_builder: 3,    // 3 shares to unlock
  priority_applications: 5, // 5 shares to unlock
  advanced_filters: 2       // 2 shares to unlock
};

export type ShareType = 'job' | 'certificate' | 'referral' | 'app';
export type SharePlatform = 'whatsapp' | 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'copy' | 'other';

interface ShareStats {
  totalShares: number;
  sharesByType: Record<ShareType, number>;
  sharesByPlatform: Record<SharePlatform, number>;
  unlockedFeatures: string[];
}

export const useShareTracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const emptyStats: ShareStats = {
    totalShares: 0,
    sharesByType: { job: 0, certificate: 0, referral: 0, app: 0 },
    sharesByPlatform: { whatsapp: 0, facebook: 0, twitter: 0, instagram: 0, linkedin: 0, copy: 0, other: 0 },
    unlockedFeatures: []
  };

  const queryKey = ['user_shares_stats', user?.id ?? 'anon'];

  const { data: shareStats = emptyStats, isLoading: loading, refetch } = useQuery<ShareStats>({
    queryKey,
    enabled: !!user,
    // Free-plan protection: cache aggressively, no auto-refetch.
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!user) return emptyStats;
      const { data, error } = await supabase
        .from('user_shares')
        .select('share_type, platform')
        .eq('user_id', user.id);
      if (error) throw error;

      const shares = data || [];
      const totalShares = shares.length;
      const sharesByType: Record<ShareType, number> = { job: 0, certificate: 0, referral: 0, app: 0 };
      const sharesByPlatform: Record<SharePlatform, number> = { whatsapp: 0, facebook: 0, twitter: 0, instagram: 0, linkedin: 0, copy: 0, other: 0 };
      shares.forEach((share: any) => {
        if (share.share_type in sharesByType) sharesByType[share.share_type as ShareType]++;
        if (share.platform in sharesByPlatform) sharesByPlatform[share.platform as SharePlatform]++;
      });
      const unlockedFeatures: string[] = [];
      Object.entries(UNLOCK_THRESHOLDS).forEach(([feature, threshold]) => {
        if (totalShares >= threshold) unlockedFeatures.push(feature);
      });
      return { totalShares, sharesByType, sharesByPlatform, unlockedFeatures };
    },
  });

  const fetchShareStats = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Track a new share
  const trackShare = useCallback(async (
    shareType: ShareType,
    platform: SharePlatform,
    contentId?: string
  ) => {
    if (!user) {
      console.log('Share tracking: User not logged in, skipping database save');
      return { success: false, reason: 'not_logged_in' };
    }

    try {
      const { error } = await supabase
        .from('user_shares')
        .insert({
          user_id: user.id,
          share_type: shareType,
          platform: platform,
          content_id: contentId
        });

      if (error) throw error;

      // Refresh cached stats after successful share
      await queryClient.invalidateQueries({ queryKey });
      
      return { success: true };
    } catch (error) {
      console.error('Error tracking share:', error);
      return { success: false, reason: 'database_error' };
    }
  }, [user, queryClient, queryKey]);

  // Check if a feature is unlocked
  const isFeatureUnlocked = useCallback((feature: keyof typeof UNLOCK_THRESHOLDS) => {
    return shareStats.totalShares >= UNLOCK_THRESHOLDS[feature];
  }, [shareStats.totalShares]);

  // Get remaining shares needed for a feature
  const sharesNeededFor = useCallback((feature: keyof typeof UNLOCK_THRESHOLDS) => {
    const needed = UNLOCK_THRESHOLDS[feature] - shareStats.totalShares;
    return Math.max(0, needed);
  }, [shareStats.totalShares]);

  return {
    shareStats,
    loading,
    trackShare,
    isFeatureUnlocked,
    sharesNeededFor,
    refreshStats: fetchShareStats
  };
};
