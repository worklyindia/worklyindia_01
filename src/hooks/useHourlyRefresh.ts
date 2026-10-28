import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabasePublishableKey, supabaseUrl } from '@/constants/supabase';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Shared, server-anchored hourly refresh countdown.
 *
 * The countdown is aligned to the top of every clock hour using the Supabase
 * server clock, so every user sees exactly the same remaining time and a page
 * refresh never restarts it. When it reaches 0 the leaderboard queries are
 * invalidated so fresh data is shown immediately.
 */
export const useHourlyRefresh = (queryKeys: string[]) => {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0); // serverNow - clientNow (ms)
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    Math.ceil((HOUR_MS - (Date.now() % HOUR_MS)) / 1000)
  );
  const lastBoundary = useRef<number | null>(null);
  const keys = queryKeys.join('|');

  // Sync with the Supabase server clock once on mount.
  useEffect(() => {
    let cancelled = false;
    const syncClock = async () => {
      try {
        const url = supabaseUrl();
        const key = supabasePublishableKey();
        if (!url || !key) return;
        const res = await fetch(`${url}/rest/v1/`, {
          method: 'HEAD',
          headers: { apikey: key },
        });
        const dateHeader = res.headers.get('date');
        if (!dateHeader || cancelled) return;
        const serverNow = new Date(dateHeader).getTime();
        if (!Number.isNaN(serverNow)) setOffset(serverNow - Date.now());
      } catch {
        // Fall back to the device clock; hour boundaries still align.
      }
    };
    syncClock();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + offset;
      const boundary = Math.floor(now / HOUR_MS) * HOUR_MS;

      if (lastBoundary.current === null) {
        lastBoundary.current = boundary;
      } else if (boundary > lastBoundary.current) {
        lastBoundary.current = boundary;
        keys.split('|').forEach((k) =>
          queryClient.invalidateQueries({ queryKey: [k] })
        );
      }

      setSecondsLeft(Math.ceil((boundary + HOUR_MS - now) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [offset, keys, queryClient]);

  return { secondsLeft };
};
