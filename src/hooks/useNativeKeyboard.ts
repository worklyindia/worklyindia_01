import { useEffect } from 'react';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

/**
 * Keep focused controls visible while the Android WebView resizes for the IME.
 * Do not fixed-position the body: that prevents the resized viewport from
 * scrolling and can leave chat composers hidden behind the keyboard.
 */
export const useNativeKeyboard = () => {
  useEffect(() => {
    if (!isWorklyAndroidApp()) return;

    const viewport = window.visualViewport;
    let frame = 0;
    let keyboardOpen = false;

    const getActiveEditor = (): HTMLElement | null => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable) return active;
      return null;
    };

    const revealActiveEditor = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = getActiveEditor();
        if (!active || !keyboardOpen) return;
        // Nearest avoids jumping the whole page when the editor is inside a
        // scrollable chat panel, modal, drawer, or mail composer.
        active.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      });
    };

    const updateKeyboardState = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = (viewport?.offsetTop ?? 0) + viewportHeight;
      const keyboardHeight = Math.max(0, Math.round(window.innerHeight - viewportBottom));
      const nextOpen = keyboardHeight > 120;

      keyboardOpen = nextOpen;
      document.body.classList.toggle('keyboard-open', nextOpen);
      document.documentElement.style.setProperty('--workly-keyboard-height', nextOpen ? `${keyboardHeight}px` : '0px');

      if (nextOpen) revealActiveEditor();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) {
        // Wait for Android to begin resizing the WebView before scrolling.
        requestAnimationFrame(updateKeyboardState);
        requestAnimationFrame(revealActiveEditor);
      }
    };

    const handleFocusOut = () => {
      // Some keyboards animate closed over multiple viewport resize events.
      requestAnimationFrame(updateKeyboardState);
    };

    viewport?.addEventListener('resize', updateKeyboardState);
    viewport?.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    const handleNativeHide = () => {
      keyboardOpen = false;
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--workly-keyboard-height', '0px');
    };
    window.addEventListener('workly-native-keyboard-hidden', handleNativeHide);
    updateKeyboardState();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', updateKeyboardState);
      viewport?.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('workly-native-keyboard-hidden', handleNativeHide);
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--workly-keyboard-height');
    };
  }, []);

  const hideKeyboard = async () => {
    getWorklyAndroidBridge()?.hideKeyboard();
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  return { hideKeyboard };
};
