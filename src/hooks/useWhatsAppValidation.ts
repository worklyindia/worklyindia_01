import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { phoneDigits, toE164, isValidE164 } from '@/lib/phone';

type UserType = 'job_seeker' | 'employer';

interface ValidationState {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

/**
 * Normalize any input to E.164 for storage/checks.
 * Accepts international numbers from any country; 10-digit input still
 * defaults to India (+91) for backward compatibility.
 */
export const formatWhatsAppNumber = (number: string): string => {
  const e164 = toE164(number);
  return isValidE164(e164) ? e164 : number;
};

export const useWhatsAppValidation = (userType: UserType, currentUserId?: string, currentCompanyId?: string) => {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    error: null,
  });

  const checkWhatsAppExists = useCallback(async (number: string) => {
    const e164 = toE164(number);

    if (!isValidE164(e164)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    setValidationState({ isChecking: true, isAvailable: null, error: null });

    try {
      // Use Edge Function to bypass RLS for unauthenticated users (signup flow)
      const { data, error } = await supabase.functions.invoke('check-whatsapp', {
        body: {
          whatsapp_number: e164,
          user_type: userType,
          current_user_id: currentUserId || null,
          current_company_id: currentCompanyId || null,
        },
      });

      if (error) {
        console.error('WhatsApp validation error:', error);
        setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify number' });
        return;
      }

      if (data?.exists) {
        const errorMsg = userType === 'job_seeker'
          ? 'This number is already registered with another account'
          : 'This number is already registered with another account';
        setValidationState({ isChecking: false, isAvailable: false, error: errorMsg });
      } else {
        setValidationState({ isChecking: false, isAvailable: true, error: null });
      }
    } catch (err) {
      console.error('WhatsApp validation error:', err);
      setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify number' });
    }
  }, [userType, currentUserId, currentCompanyId]);

  // Debounced validation
  useEffect(() => {
    const e164 = toE164(whatsappNumber);

    if (!isValidE164(e164)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkWhatsAppExists(whatsappNumber);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [whatsappNumber, checkWhatsAppExists]);

  const handleNumberChange = useCallback((value: string) => {
    // Allow digits and a leading + for international format (E.164, max 15 digits)
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      setWhatsappNumber(`+${phoneDigits(cleaned).slice(0, 15)}`);
    } else {
      const digits = phoneDigits(cleaned).slice(0, 15);
      setWhatsappNumber(digits ? `+91${digits.slice(0, 10)}` : '');
    }
  }, []);

  const resetValidation = useCallback(() => {
    setWhatsappNumber('');
    setValidationState({ isChecking: false, isAvailable: null, error: null });
  }, []);

  // Get the formatted number for saving to database
  const getFormattedNumber = useCallback((): string => {
    return formatWhatsAppNumber(whatsappNumber);
  }, [whatsappNumber]);

  return {
    whatsappNumber,
    setWhatsappNumber: handleNumberChange,
    isChecking: validationState.isChecking,
    isAvailable: validationState.isAvailable,
    error: validationState.error,
    isValid: validationState.isAvailable === true,
    isDuplicate: validationState.isAvailable === false,
    resetValidation,
    getFormattedNumber,
  };
};
