import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const useNativeHaptics = () => {
  const isNative = Capacitor.isNativePlatform();

  const lightImpact = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const mediumImpact = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const heavyImpact = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const successHaptic = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const warningHaptic = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const errorHaptic = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

  const selectionHaptic = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionStart();
      setTimeout(async () => {
        await Haptics.selectionEnd();
      }, 100);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }, [isNative]);

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
