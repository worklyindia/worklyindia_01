import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPhoneIdentifier, normalizePhoneIdentifier } from '@/lib/loginIdentifier';

type UserType = 'job_seeker' | 'employer';

interface ValidationState {
  isChecking: boolean;
  exists: boolean | null;
  error: string | null;
  providers: string[];
}

export const useLoginEmailValidation = (userType: UserType) => {
  const [email, setEmail] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>({
    isChecking: false,
    exists: null,
    error: null,
    providers: [],
  });

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const isCheckable = (value: string) => isValidEmail(value) || isPhoneIdentifier(value);

  const checkEmailExists = useCallback(async (valueToCheck: string) => {
    const clean = valueToCheck.trim();
    const phoneMode = isPhoneIdentifier(clean);

    if (!isCheckable(clean)) {
      setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
      return;
    }

    setValidationState({ isChecking: true, exists: null, error: null, providers: [] });

    try {
      const { data, error } = phoneMode
        ? await supabase.functions.invoke('unified-ai-tricks', {
            body: { action: 'check_phone_exists', phone: normalizePhoneIdentifier(clean) },
          })
        : await supabase.functions.invoke('unified-ai-tricks', {
            body: { action: 'check_email_exists', email: clean.toLowerCase() },
          });


      if (error) {
        console.error('Login identifier validation error:', error);
        setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
        return;
      }

      if (data?.exists === true) {
        setValidationState({ isChecking: false, exists: true, error: null, providers: Array.isArray(data.providers) ? data.providers : [] });
      } else if (data?.exists === false) {
        const errorMsg = phoneMode
          ? 'This mobile number is not registered. Please sign up first.'
          : 'This email is not registered. Please sign up first.';
        setValidationState({ isChecking: false, exists: false, error: errorMsg, providers: [] });
      } else {
        // Check could not be completed — stay silent instead of wrongly
        // telling the user their account does not exist.
        setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
      }
    } catch (err) {
      console.error('Login identifier validation error:', err);
      setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
    }
  }, [userType]);

  // Debounced validation
  useEffect(() => {
    const clean = email.trim();

    if (!isCheckable(clean)) {
      setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkEmailExists(clean);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, checkEmailExists]);


  const handleEmailChange = useCallback((value: string) => {
    setEmail(value.trim());
  }, []);

  const resetValidation = useCallback(() => {
    setEmail('');
    setValidationState({ isChecking: false, exists: null, error: null, providers: [] });
  }, []);

  return {
    email,
    setEmail: handleEmailChange,
    isChecking: validationState.isChecking,
    exists: validationState.exists,
    error: validationState.error,
    isValid: validationState.exists === true,
    notRegistered: validationState.exists === false,
    providers: validationState.providers,
    resetValidation,
  };
};
