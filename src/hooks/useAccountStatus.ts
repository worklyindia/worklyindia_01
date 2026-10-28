import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState<string>('active');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAccountStatus = async () => {
      if (!user) {
        setAccountStatus('active');
        return;
      }

      setIsLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_status')
          .eq('user_id', user.id)
          .maybeSingle();

        setAccountStatus(profile?.account_status || 'active');
      } catch (error) {
        console.error('Error fetching account status:', error);
        setAccountStatus('active');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountStatus();
  }, [user]);

  const isJobBanned = accountStatus === 'job_banned';
  const isBanned = accountStatus === 'banned';
  const canApplyJobs = !isJobBanned && !isBanned;

  return {
    accountStatus,
    isJobBanned,
    isBanned,
    canApplyJobs,
    isLoading
  };
};