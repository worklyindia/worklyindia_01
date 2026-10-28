import { useEffect, useCallback } from 'react';

/**
 * Hook to persist and restore form state across page refreshes and tab switches
 * @param key - Unique key for this form's storage
 * @param state - Current form state to persist
 * @param setState - Function to update state
 * @param enabled - Whether persistence is enabled (default: true)
 */
export const useFormPersistence = <T extends Record<string, any>>(
  key: string,
  state: T,
  setState: (state: T) => void,
  enabled: boolean = true
) => {
  // Load saved state on mount
  useEffect(() => {
    if (!enabled) return;
    
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setState(parsedState);
        console.log(`🔄 Restored form state for: ${key}`);
      }
    } catch (error) {
      console.warn(`Failed to restore form state for ${key}:`, error);
    }
  }, [key, enabled]);

  // Save state whenever it changes
  useEffect(() => {
    if (!enabled) return;
    
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to save form state for ${key}:`, error);
    }
  }, [key, state, enabled]);

  // Clear saved state
  const clearSavedState = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
      console.log(`🗑️ Cleared saved state for: ${key}`);
    } catch (error) {
      console.warn(`Failed to clear saved state for ${key}:`, error);
    }
  }, [key]);

  return { clearSavedState };
};
