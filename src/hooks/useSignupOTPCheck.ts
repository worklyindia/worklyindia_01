import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TriggerEvent = 'user_signup_otp' | 'company_signup_otp';

interface SignupOTPCheckState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useSignupOTPCheck = (triggerEvent: TriggerEvent) => {
  const [state, setState] = useState<SignupOTPCheckState>({
    isActive: false,
    isLoading: true,
    error: null,
  });

  const checkTriggerStatus = useCallback(async () => {
    console.log('🔍 [useSignupOTPCheck] Checking trigger:', triggerEvent);
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_automation_rules')
        .select('is_active, trigger_event')
        .eq('trigger_event', triggerEvent)
        .maybeSingle();

      console.log('📊 [useSignupOTPCheck] Query result:', { 
        triggerEvent, 
        data, 
        error,
        isActive: data?.is_active 
      });

      if (error) {
        console.error('❌ [useSignupOTPCheck] Error:', error);
        setState({
          isActive: false,
          isLoading: false,
          error: error.message,
        });
        return;
      }

      const isActive = data?.is_active ?? false;
      console.log('✅ [useSignupOTPCheck] Final state:', { triggerEvent, isActive });
      
      setState({
        isActive,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('❌ [useSignupOTPCheck] Exception:', err);
      setState({
        isActive: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [triggerEvent]);

  useEffect(() => {
    checkTriggerStatus();
  }, [checkTriggerStatus]);

  return {
    ...state,
    refetch: checkTriggerStatus,
  };
};
