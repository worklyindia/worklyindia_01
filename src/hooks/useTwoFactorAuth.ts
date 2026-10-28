import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseTwoFactorAuthOptions {
  userType: 'job_seeker' | 'employer';
  userId: string | null;
}

export const useTwoFactorAuth = ({ userType, userId }: UseTwoFactorAuthOptions) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
      const { data, error } = await supabase
        .from(tableName)
        .select('two_factor_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIsEnabled(data?.two_factor_enabled ?? false);
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userType]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const check2FARequired = useCallback(async (email: string): Promise<{ required: boolean; userId: string | null }> => {
    try {
      // First, find the user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();

      if (userError || !userData) {
        // Try companies table for employers
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();

        if (companyError || !companyData) {
          return { required: false, userId: null };
        }

        // Check employer 2FA
        const { data: settings } = await supabase
          .from('employer_settings')
          .select('two_factor_enabled')
          .eq('user_id', companyData.user_id)
          .maybeSingle();

        return { 
          required: settings?.two_factor_enabled ?? false, 
          userId: companyData.user_id 
        };
      }

      // Check user 2FA
      const { data: settings } = await supabase
        .from('user_settings')
        .select('two_factor_enabled')
        .eq('user_id', userData.user_id)
        .maybeSingle();

      return { 
        required: settings?.two_factor_enabled ?? false, 
        userId: userData.user_id 
      };
    } catch (error) {
      console.error('Error checking 2FA requirement:', error);
      return { required: false, userId: null };
    }
  }, []);

  return {
    isEnabled,
    isLoading,
    check2FARequired,
    refetch: fetchStatus,
  };
};
