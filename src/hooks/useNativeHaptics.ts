import { useCallback } from 'react';

// Web-safe haptic feedback. The native Kotlin app provides its own Android haptics.
export const useNativeHaptics = () => {
  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (error) {
      console.warn('Haptic feedback is not available:', error);
    }
  }, []);

  const lightImpact = useCallback(async () => vibrate(8), [vibrate]);
  const mediumImpact = useCallback(async () => vibrate(16), [vibrate]);
  const heavyImpact = useCallback(async () => vibrate(28), [vibrate]);
  const successHaptic = useCallback(async () => vibrate([12, 35, 12]), [vibrate]);
  const warningHaptic = useCallback(async () => vibrate([18, 45, 18]), [vibrate]);
  const errorHaptic = useCallback(async () => vibrate([25, 40, 25]), [vibrate]);
  const selectionHaptic = useCallback(async () => vibrate(5), [vibrate]);

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successHaptic,
    warningHaptic,
    errorHaptic,
    selectionHaptic,
  };
};
