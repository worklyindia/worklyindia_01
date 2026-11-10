import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TriggerPurpose = 'user_profile_whatsapp_verify' | 'company_profile_whatsapp_verify';

interface UseWhatsAppTriggerCheckResult {
  isVerificationRequired: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if WhatsApp OTP verification is enabled for a specific trigger purpose
 * Checks the whatsapp_automation_rules table for active rules
 */
export const useWhatsAppTriggerCheck = (purpose: TriggerPurpose): UseWhatsAppTriggerCheckResult => {
  const [isVerificationRequired, setIsVerificationRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkTriggerSetting = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('whatsapp_automation_rules')
          .select('is_active')
          .eq('trigger_event', purpose)
          .maybeSingle();

        if (error) {
          console.error('Error checking WhatsApp trigger setting:', error);
          // Default to not requiring verification if there's an error
          setIsVerificationRequired(false);
          return;
        }

        // If rule exists and is active, verification is required
        setIsVerificationRequired(data?.is_active ?? false);
      } catch (err) {
        console.error('Error in useWhatsAppTriggerCheck:', err);
        setIsVerificationRequired(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkTriggerSetting();
  }, [purpose]);

  return { isVerificationRequired, isLoading };
};
