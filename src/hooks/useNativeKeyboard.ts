import { useEffect } from 'react';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

export const useNativeKeyboard = () => {
  useEffect(() => {
    if (!isWorklyAndroidApp()) return;

    const viewport = window.visualViewport;
    let previousHeight = viewport?.height ?? window.innerHeight;
    const updateKeyboardState = () => {
      const nextHeight = viewport?.height ?? window.innerHeight;
      const keyboardOpen = previousHeight - nextHeight > 120 ||
        window.innerHeight - nextHeight > 120;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
      if (keyboardOpen) {
        const active = document.activeElement as HTMLElement | null;
        if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
          requestAnimationFrame(() => active.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        }
      }
      previousHeight = nextHeight;
    };

    viewport?.addEventListener('resize', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    const handleNativeHide = () => document.body.classList.remove('keyboard-open');
    window.addEventListener('workly-native-keyboard-hidden', handleNativeHide);
    return () => {
      viewport?.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('workly-native-keyboard-hidden', handleNativeHide);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  const hideKeyboard = async () => {
    getWorklyAndroidBridge()?.hideKeyboard();
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  return { hideKeyboard };
};
