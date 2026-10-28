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
export const formatPhoneNumber = (number: string): string => {
  const e164 = toE164(number);
  return isValidE164(e164) ? e164 : number;
};

export const usePhoneValidation = (userType: UserType, currentUserId?: string, currentCompanyId?: string) => {
  const [phone, setPhoneState] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    error: null,
  });

  const checkPhoneExists = useCallback(async (phoneNumber: string) => {
    const e164 = toE164(phoneNumber);

    if (!isValidE164(e164)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    setValidationState({ isChecking: true, isAvailable: null, error: null });

    try {
      const { data, error } = await supabase.functions.invoke('check-whatsapp', {
        body: {
          check_type: 'phone',
          phone: e164,
          user_type: userType,
          current_user_id: currentUserId || null,
          current_company_id: currentCompanyId || null,
        },
      });

      if (error) {
        console.error('Phone validation error:', error);
        setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify phone number' });
        return;
      }

      if (data?.exists) {
        const errorMsg = userType === 'job_seeker'
          ? 'This phone number is already registered with another Job Seeker account'
          : 'This phone number is already registered with another Company account';
        setValidationState({ isChecking: false, isAvailable: false, error: errorMsg });
      } else {
        setValidationState({ isChecking: false, isAvailable: true, error: null });
      }
    } catch (err) {
      console.error('Phone validation error:', err);
      setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify phone number' });
    }
  }, [userType, currentUserId, currentCompanyId]);

  // Debounced validation
  useEffect(() => {
    const e164 = toE164(phone);

    if (!isValidE164(e164)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkPhoneExists(phone);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [phone, checkPhoneExists]);

  const handlePhoneChange = useCallback((value: string) => {
    // Allow digits and a leading + for international format (E.164, max 15 digits)
    const cleaned = value.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      setPhoneState(`+${phoneDigits(cleaned).slice(0, 15)}`);
    } else {
      const digits = phoneDigits(cleaned).slice(0, 15);
      setPhoneState(digits ? `+91${digits.slice(0, 10)}` : '');
    }
  }, []);

  const resetValidation = useCallback(() => {
    setPhoneState('');
    setValidationState({ isChecking: false, isAvailable: null, error: null });
  }, []);

  const getFormattedNumber = useCallback((): string => {
    return formatPhoneNumber(phone);
  }, [phone]);

  return {
    phone,
    setPhone: handlePhoneChange,
    isChecking: validationState.isChecking,
    isAvailable: validationState.isAvailable,
    error: validationState.error,
    isValid: validationState.isAvailable === true,
    isDuplicate: validationState.isAvailable === false,
    resetValidation,
    getFormattedNumber,
  };
};
