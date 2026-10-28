import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type UserType = 'job_seeker' | 'employer';

interface ValidationState {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
  providers: string[];
}

export const useEmailValidation = (userType: UserType, currentUserId?: string) => {
  const [email, setEmail] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    error: null,
    providers: [],
  });

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const checkEmailExists = useCallback(async (emailToCheck: string) => {
    const cleanEmail = emailToCheck.trim().toLowerCase();
    
    if (!isValidEmail(cleanEmail)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null, providers: [] });
      return;
    }

    setValidationState({ isChecking: true, isAvailable: null, error: null, providers: [] });

    try {
      const { data, error } = await supabase.functions.invoke('unified-ai-tricks', {
        body: {
          action: 'check_email_exists',
          email: cleanEmail,
        },
      });

      if (error) {
        console.error('Email validation error:', error);
        setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify email', providers: [] });
        return;
      }

      if (data?.exists) {
        const errorMsg = 'This email is already linked to an existing account';
        setValidationState({ isChecking: false, isAvailable: false, error: errorMsg, providers: Array.isArray(data.providers) ? data.providers : [] });
      } else {
        setValidationState({ isChecking: false, isAvailable: true, error: null, providers: [] });
      }
    } catch (err) {
      console.error('Email validation error:', err);
      setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify email', providers: [] });
    }
  }, [userType, currentUserId]);

  // Debounced validation
  useEffect(() => {
    const cleanEmail = email.trim();
    
    if (!isValidEmail(cleanEmail)) {
      setValidationState({ isChecking: false, isAvailable: null, error: null, providers: [] });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkEmailExists(email);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, checkEmailExists]);

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value.trim());
  }, []);

  const resetValidation = useCallback(() => {
    setEmail('');
    setValidationState({ isChecking: false, isAvailable: null, error: null, providers: [] });
  }, []);

  /**
   * Authoritative check used right before submitting a signup form.
   * Returns true when the email is free to use, false when it already exists,
   * and null when the check could not be completed.
   */
  const verifyAvailabilityNow = useCallback(async (emailToCheck: string): Promise<boolean | null> => {
    const cleanEmail = emailToCheck.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return null;

    setValidationState({ isChecking: true, isAvailable: null, error: null, providers: [] });
    try {
      const { data, error } = await supabase.functions.invoke('unified-ai-tricks', {
        body: { action: 'check_email_exists', email: cleanEmail },
      });

      if (error || typeof data?.exists !== 'boolean') {
        setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify email', providers: [] });
        return null;
      }

      if (data.exists) {
        const errorMsg = 'This email is already linked to an existing account';
        setValidationState({ isChecking: false, isAvailable: false, error: errorMsg, providers: Array.isArray(data.providers) ? data.providers : [] });
        return false;
      }

      setValidationState({ isChecking: false, isAvailable: true, error: null, providers: [] });
      return true;
    } catch {
      setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify email', providers: [] });
      return null;
    }
  }, [userType]);

  return {
    verifyAvailabilityNow,
    email,
    setEmail: handleEmailChange,
    isChecking: validationState.isChecking,
    isAvailable: validationState.isAvailable,
    error: validationState.error,
    isValid: validationState.isAvailable === true,
    isDuplicate: validationState.isAvailable === false,
    providers: validationState.providers,
    resetValidation,
  };
};
