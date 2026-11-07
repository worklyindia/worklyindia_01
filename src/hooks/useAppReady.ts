import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks whether the app's critical data is loaded:
 * 1. Auth session resolved
 * 2. Profile loaded (if logged in)
 * 3. Hero banners prefetched
 * 4. Initial jobs data prefetched
 * 
 * Returns `isReady` — true when all critical data is available.
 * Includes a safety timeout so the app is never stuck loading.
 */
export const useAppReady = (authLoading: boolean, profileLoading: boolean, user: any) => {
  const [heroReady, setHeroReady] = useState(false);
  const [jobsReady, setJobsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const startedRef = useRef(false);

  // Prefetch hero banners and jobs data in parallel
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const fetchHero = async () => {
      try {
        await supabase.rpc('get_active_hero_banners');
      } catch {
        // Ignore errors — don't block app
      } finally {
        setHeroReady(true);
      }
    };

    const fetchJobs = async () => {
      try {
        await supabase
          .from('jobs')
          .select('id')
          .eq('status', 'open')
          .limit(1);
      } catch {
        // Ignore errors — don't block app
      } finally {
        setJobsReady(true);
      }
    };

    fetchHero();
    fetchJobs();
  }, []);

  // Give the native WebView longer to finish auth/profile and first-screen
  // data loading on mobile networks, while keeping the website's browser
  // fallback short so a slow request never leaves users stuck on a splash.
  useEffect(() => {
    const isNativeAndroid = typeof navigator !== 'undefined' &&
      /WorklyIndiaApp\/1\.0/i.test(navigator.userAgent);
    const maxWait = isNativeAndroid ? 15000 : 5000;
    const timer = setTimeout(() => setTimedOut(true), maxWait);
    return () => clearTimeout(timer);
  }, []);

  const authReady = !authLoading;
  const profileReady = !user || !profileLoading;

  const isReady = timedOut || (authReady && profileReady && heroReady && jobsReady);

  return isReady;
};
