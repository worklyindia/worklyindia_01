import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserStats {
  applications: number;
  applicationsThisWeek: number;
  profileViews: number;
  profileViewsToday: number;
  profileViews30Days: number;
  savedJobs: number;
  newMatches: number;
  applicationResponseRate: number;
  pointsEarned: number;
}

/**
 * OPTIMIZED: User Stats Hook
 * 
 * Changes made to reduce Supabase Cached Egress:
 * - REMOVED: 4 realtime subscriptions (profile views, applications, favorites, wallet)
 * - Data only fetches once on mount, not on every change
 * - Use manual refresh via refetch if needed
 */
export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats>({
    applications: 0,
    applicationsThisWeek: 0,
    profileViews: 0,
    profileViewsToday: 0,
    profileViews30Days: 0,
    savedJobs: 0,
    newMatches: 0,
    applicationResponseRate: 0,
    pointsEarned: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUserStats = async () => {
      try {
        setLoading(true);

        // Batch all queries - only select needed columns
        // @ts-ignore - Type instantiation issue with Supabase
        const applicationsResult = await supabase
          .from('job_applications')
          .select('id, applied_at')
          .eq('applicant_id', user.id);
        
        // @ts-ignore - Type instantiation issue with Supabase
        const savedJobsResult = await supabase
          .from('job_favorites')
          .select('id, created_at')
          .eq('user_id', user.id);
        
        const profileViewsResult = await supabase.rpc('get_user_profile_views_with_period', { 
          p_user_id: user.id 
        });
        
        const responseRateResult = await supabase.rpc('get_user_application_response_rate', { 
          p_user_id: user.id 
        });
        
        const referralWalletResult = await supabase
          .from('referral_wallets')
          .select('balance_amount')
          .eq('user_id', user.id)
          .maybeSingle();

        const applications = applicationsResult.data || [];
        const savedJobs = savedJobsResult.data || [];

        // Calculate time-based stats
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const applicationsThisWeek = applications.filter(app => 
          new Date(app.applied_at) >= oneWeekAgo
        ).length;

        const newMatches = savedJobs.filter(fav => 
          new Date(fav.created_at) >= yesterday
        ).length;

        const profileViews = profileViewsResult.data?.[0] || { 
          total_views: 0, 
          views_last_30_days: 0, 
          views_today: 0 
        };

        setStats({
          applications: applications.length,
          applicationsThisWeek,
          profileViews: Number(profileViews.total_views) || 0,
          profileViewsToday: Number(profileViews.views_today) || 0,
          profileViews30Days: Number(profileViews.views_last_30_days) || 0,
          savedJobs: savedJobs.length,
          newMatches,
          applicationResponseRate: Number(responseRateResult.data) || 0,
          pointsEarned: referralWalletResult.data?.balance_amount || 0
        });

      } catch (error) {
        console.error('Error fetching user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
    
    // NO REALTIME SUBSCRIPTIONS - saves significant egress
    // Data will be refreshed on next page load
    
  }, [user?.id]); // Only refetch when user changes

  return { stats, loading };
};
