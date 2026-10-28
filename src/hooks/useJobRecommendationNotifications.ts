import { useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';

export const useJobRecommendationNotifications = () => {
  // Use context directly to avoid throwing if provider is missing
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;

  const fetchJobRecommendations = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .rpc('get_recommended_jobs', { p_user_id: user.id });

      if (error) {
        console.error('Error fetching job recommendations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in fetchJobRecommendations:', error);
      return [];
    }
  }, [user?.id]);

  return {
    fetchJobRecommendations
  };
};
