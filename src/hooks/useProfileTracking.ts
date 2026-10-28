import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { triggerTelegramEvent } from '@/hooks/useTelegramTrigger';

export const useProfileTracking = () => {
  const { user: employerUser } = useEmployerAuth();
  const { user } = useAuth();
  
  const trackProfileView = useCallback(async (profileUserId: string) => {
    const viewerId = employerUser?.id || user?.id;
    if (!viewerId || !profileUserId) {
      console.log('Profile view not tracked - missing data:', {
        hasEmployerUser: !!employerUser?.id,
        hasAuthUser: !!user?.id,
        hasViewerId: !!viewerId,
        hasProfileUserId: !!profileUserId,
      });
      return;
    }

    if (viewerId === profileUserId) {
      console.log('Profile view not tracked - self-view');
      return;
    }
    
    try {
      console.log('📊 Tracking profile view:', { profileUserId, viewerId });
      
      // Call the database function to log profile view
      const { error } = await supabase.rpc('log_profile_view', {
        p_profile_user_id: profileUserId,
        p_viewer_id: viewerId,
      });
      
      if (error) {
        console.error('❌ Error logging profile view:', error);
      } else {
        console.log('✅ Profile view tracked successfully');
        
        // Send Telegram notification to the profile owner
        // Get viewer's company name for context
        const { data: viewerCompany } = await supabase
          .from('companies')
          .select('company_name')
          .eq('user_id', viewerId)
          .maybeSingle();
        
        const { data: profileOwner } = await supabase
          .from('profiles')
          .select('full_name, telegram_chat_id')
          .eq('user_id', profileUserId)
          .maybeSingle();
        
        if (profileOwner?.telegram_chat_id) {
          try {
            await triggerTelegramEvent(
              'user_profile_viewed',
              profileUserId,
              'user',
              profileOwner.full_name || 'User',
              {
                viewer_name: viewerCompany?.company_name || 'An employer',
                company_name: viewerCompany?.company_name || 'A company',
                job_title: 'your profile'
              }
            );
            console.log('📱 Telegram trigger sent: user_profile_viewed');
          } catch (telegramError) {
            console.error('Failed to send profile view Telegram notification:', telegramError);
          }
        } else {
          console.log('⚠️ Profile view Telegram not sent - no telegram_chat_id for user:', profileUserId);
        }
      }
    } catch (error) {
      console.error('❌ Error tracking profile view:', error);
    }
  }, [employerUser?.id, user?.id]);

  return { trackProfileView };
};