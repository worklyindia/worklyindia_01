import { useEffect, useRef } from 'react';
import { isFilePickerSuspended } from '@/lib/filePickerGuard';

/**
 * Refetches data when the tab/screen becomes visible again after being hidden
 * (e.g. mobile screen off -> on). Prevents pages getting stuck on skeleton/spinner
 * because in-flight Supabase requests were suspended by the browser.
 *
 * - Only fires when the tab was hidden for >800ms (avoids double-fetch on tab-blur)
 * - Also fires on window `focus` and `pageshow` (bfcache restore) as safety nets
 */
export function useWakeRefetch(refetch: (() => void) | undefined | null, enabled: boolean = true) {
  const hiddenAtRef = useRef<number | null>(null);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return;

    const trigger = () => {
      // Don't refetch when the user is just coming back from a file picker.
      if (isFilePickerSuspended()) return;
      try {
        refetchRef.current?.();
      } catch (e) {
        console.warn('useWakeRefetch: refetch failed', e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        if (hiddenFor > 800) trigger();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) trigger();
    };

    const onFocus = () => {
      // Fire only if we recorded a hide event (some mobile browsers skip visibilitychange)
      if (hiddenAtRef.current !== null) {
        const hiddenFor = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenFor > 800) trigger();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);
}
