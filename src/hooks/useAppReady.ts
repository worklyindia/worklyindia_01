import { useState, useEffect } from 'react';

/**
 * Wait only for authentication and the signed-in user's profile.
 * Home banners and jobs load in their own query hooks, so issuing extra
 * "warm-up" requests here only delays the first screen on mobile networks.
 * A safety timeout ensures a stalled auth/profile request never traps users
 * on the startup splash.
 */
export const useAppReady = (authLoading: boolean, profileLoading: boolean, user: any) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const isNativeAndroid = typeof navigator !== 'undefined' &&
      /WorklyIndiaApp\/1\.0/i.test(navigator.userAgent);
    // If the device is offline, do not keep the app splash waiting for
    // network-only profile checks; show the locally cached app after a short grace period.
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const maxWait = isOffline ? 1500 : (isNativeAndroid ? 15000 : 5000);
    const timer = setTimeout(() => setTimedOut(true), maxWait);
    return () => clearTimeout(timer);
  }, []);

  const authReady = !authLoading;
  const profileReady = !user || !profileLoading;

  return timedOut || (authReady && profileReady);
};
