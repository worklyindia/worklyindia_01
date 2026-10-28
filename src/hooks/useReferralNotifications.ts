import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { FirebasePushService } from '@/services/FirebasePushService';
import { toast } from 'sonner';

export const useReferralNotifications = () => {
  const { user: jobSeekerUser } = useAuth();
  const { user: employerUser } = useEmployerAuth(); 
  const { createNotification } = useNotifications();

  const currentUser = jobSeekerUser || employerUser;

  // Send referral join notification
  const sendReferralJoinNotification = useCallback(async (
    referrerId: string,
    referredUserId: string,
    referralCode: string
  ) => {
    try {
      // Get user names
      const { data: referrerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', referrerId)
        .single();

      const { data: referredProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', referredUserId)
        .single();

      const referrerName = referrerProfile?.full_name || 'Someone';
      const referredName = referredProfile?.full_name || 'New User';

      // Create in-app notifications
      await Promise.all([
        createNotification({
          userId: referrerId,
          title: '🎉 New Referral Joined!',
          message: `${referredName} joined using your referral code! You'll earn commission on their purchases.`,
          type: 'success',
          actionUrl: '/employer/referral'
        }),
        createNotification({
          userId: referredUserId,
          title: '🎁 Welcome! Referral Bonus Applied',
          message: `Welcome to Workly India! You joined via ${referrerName}'s referral. Enjoy exclusive benefits!`,
          type: 'success',
          actionUrl: '/rewards'
        })
      ]);

      // Send push notifications via Edge Function
      await supabase.functions.invoke('email-api', {
        body: {
          action: 'referral_notification',
          event_type: 'referral_join',
          referrer_id: referrerId,
          referred_user_id: referredUserId,
          referrer_name: referrerName,
          referred_name: referredName
        }
      });

      console.log('✅ Referral join notifications sent successfully');
    } catch (error) {
      console.error('Error sending referral join notifications:', error);
    }
  }, [createNotification]);

  // Send commission earned notification
  const sendCommissionEarnedNotification = useCallback(async (
    referrerId: string,
    commissionAmount: number,
    totalCommissions: number
  ) => {
    try {
      // Create in-app notification
      await createNotification({
        userId: referrerId,
        title: '💰 Commission Earned!',
        message: `You earned ₹${commissionAmount} commission! Total earned: ₹${totalCommissions}`,
        type: 'success',
        actionUrl: '/employer/referral'
      });

      // Send push notification
      await supabase.functions.invoke('email-api', {
        body: {
          action: 'referral_notification',
          event_type: 'commission_earned',
          referrer_id: referrerId,
          commission_amount: commissionAmount,
          total_commissions: totalCommissions
        }
      });

      console.log('✅ Commission notification sent successfully');
    } catch (error) {
      console.error('Error sending commission notification:', error);
    }
  }, [createNotification]);

  // Send milestone achievement notification
  const sendMilestoneNotification = useCallback(async (
    referrerId: string,
    milestone: number,
    totalReferrals: number
  ) => {
    try {
      const milestoneEmoji = milestone === 1 ? '🥇' : milestone === 5 ? '🎯' : milestone === 10 ? '🔥' : '🏆';
      
      // Create in-app notification
      await createNotification({
        userId: referrerId,
        title: `${milestoneEmoji} Referral Milestone Achieved!`,
        message: `Congratulations! You've reached ${milestone} referrals! Keep sharing to earn more.`,
        type: 'success',
        actionUrl: '/employer/referral'
      });

      // Send push notification
      await supabase.functions.invoke('email-api', {
        body: {
          action: 'referral_notification',
          event_type: 'milestone_achieved',
          referrer_id: referrerId,
          milestone: milestone,
          total_referrals: totalReferrals
        }
      });

      console.log('✅ Milestone notification sent successfully');
    } catch (error) {
      console.error('Error sending milestone notification:', error);
    }
  }, [createNotification]);

  // Send marketing notifications
  const sendMarketingNotifications = useCallback(async (
    userIds: string[],
    messageType: 'no_referrals' | 'inactive_referrer' | 'boost_referrals'
  ) => {
    try {
      await supabase.functions.invoke('email-api', {
        body: {
          action: 'referral_notification',
          event_type: 'marketing_referral',
          user_ids: userIds,
          message_type: messageType
        }
      });

      console.log('✅ Marketing notifications sent successfully');
    } catch (error) {
      console.error('Error sending marketing notifications:', error);
    }
  }, []);

  // Trigger marketing campaign
  const triggerMarketingCampaign = useCallback(async () => {
    try {
      await supabase.functions.invoke('email-api', { body: { action: 'referral_notification', event_type: 'marketing_referral' } });
      console.log('✅ Marketing campaign triggered successfully');
    } catch (error) {
      console.error('Error triggering marketing campaign:', error);
    }
  }, []);

  // Set up real-time listeners for referral events
  useEffect(() => {
    if (!currentUser) return;

    const setupReferralListeners = () => {
      // Listen for new referrals
      const referralsChannel = supabase
        .channel('referral-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_referrals'
          },
          async (payload) => {
            const referral = payload.new as any;
            
            await sendReferralJoinNotification(
              referral.referrer_id,
              referral.referred_user_id,
              referral.referral_code || ''
            );
          }
        )
        .subscribe();

      // Listen for commission updates
      const commissionsChannel = supabase
        .channel('commission-notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'referral_commissions'
          },
          async (payload) => {
            const { new: newCommission, old: oldCommission } = payload as any;
            
            if (newCommission.status === 'completed' && oldCommission.status !== 'completed') {
              // Get total commissions
              const { data: commissionsData } = await supabase
                .from('referral_commissions')
                .select('commission_amount')
                .eq('referrer_id', newCommission.referrer_id)
                .eq('status', 'completed');

              const totalCommissions = commissionsData?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

              await sendCommissionEarnedNotification(
                newCommission.referrer_id,
                Number(newCommission.commission_amount),
                totalCommissions
              );
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(referralsChannel);
        supabase.removeChannel(commissionsChannel);
      };
    };

    const cleanup = setupReferralListeners();
    return cleanup;
  }, [
    currentUser,
    sendReferralJoinNotification,
    sendCommissionEarnedNotification
  ]);

  return {
    sendReferralJoinNotification,
    sendCommissionEarnedNotification,
    sendMilestoneNotification,
    sendMarketingNotifications,
    triggerMarketingCampaign
  };
};