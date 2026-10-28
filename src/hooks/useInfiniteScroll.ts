import { useEffect, useRef } from 'react';
import { jobPreloadDistance, shouldLoadJobPage } from '@/lib/jobScrollPreload';

interface UseInfiniteScrollOptions {
  callback: () => void;
  loading: boolean;
  hasMore: boolean;
  enabled?: boolean;
  threshold?: number; // pixels from bottom to trigger load
  contentKey?: string | number;
}

export const useInfiniteScroll = ({
  callback,
  loading,
  hasMore,
  enabled = true,
  threshold = 300,
  contentKey
}: UseInfiniteScrollOptions) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (!enabled || loading || !hasMore) return;
    let requested = false;
    let frame = 0;
    let previousY = window.scrollY;
    let previousTime = performance.now();
    const check = () => {
      frame = 0;
      if (requested) return;
      const y = window.scrollY || document.documentElement.scrollTop;
      const now = performance.now();
      const speed = Math.max(0, y - previousY) / Math.max(1, now - previousTime);
      previousY = y;
      previousTime = now;
      const distance = jobPreloadDistance(window.innerHeight, threshold, speed);
      if (shouldLoadJobPage(y, window.innerHeight, document.documentElement.scrollHeight, distance)) {
        requested = true;
        callbackRef.current();
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [loading, hasMore, enabled, threshold, contentKey]);
};
