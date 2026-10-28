import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ValidationState {
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}

export const useCompanyNameValidation = (currentUserId?: string, currentCompanyId?: string) => {
  const [companyName, setCompanyName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>({
    isChecking: false,
    isAvailable: null,
    error: null,
  });

  // Allow setting initial name (the already-saved name) so we skip validation for it
  const setCompanyNameWithInit = useCallback((name: string, isInit = false) => {
    setCompanyName(name);
    if (isInit) {
      setInitialName(name);
    }
  }, []);

  const checkCompanyNameExists = useCallback(async (name: string) => {
    const trimmed = name.trim().toLowerCase();
    
    if (trimmed.length < 2) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    // If the name matches the initially loaded (saved) name, it's the user's own — mark as valid
    if (initialName && trimmed === initialName.trim().toLowerCase()) {
      setValidationState({ isChecking: false, isAvailable: true, error: null });
      return;
    }

    setValidationState({ isChecking: true, isAvailable: null, error: null });

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, user_id')
        .ilike('company_name', trimmed);

      if (error) {
        console.error('Company name validation error:', error);
        setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify company name' });
        return;
      }

      // Filter out current user's own company
      const otherCompanies = (data || []).filter(c => {
        if (currentCompanyId && c.id === currentCompanyId) return false;
        if (currentUserId && c.user_id === currentUserId) return false;
        return true;
      });

      if (otherCompanies.length > 0) {
        setValidationState({ 
          isChecking: false, 
          isAvailable: false, 
          error: 'This company name is already registered by another account' 
        });
      } else {
        setValidationState({ isChecking: false, isAvailable: true, error: null });
      }
    } catch (err) {
      console.error('Company name validation error:', err);
      setValidationState({ isChecking: false, isAvailable: null, error: 'Unable to verify company name' });
    }
  }, [currentUserId, currentCompanyId, initialName]);

  // Debounced validation
  useEffect(() => {
    const trimmed = companyName.trim();
    
    if (trimmed.length < 2) {
      setValidationState({ isChecking: false, isAvailable: null, error: null });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkCompanyNameExists(companyName);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [companyName, checkCompanyNameExists]);

  const resetValidation = useCallback(() => {
    setCompanyName('');
    setValidationState({ isChecking: false, isAvailable: null, error: null });
  }, []);

  return {
    companyName,
    setCompanyName: setCompanyNameWithInit,
    isChecking: validationState.isChecking,
    isAvailable: validationState.isAvailable,
    error: validationState.error,
    isValid: validationState.isAvailable === true,
    isDuplicate: validationState.isAvailable === false,
    resetValidation,
  };
};
