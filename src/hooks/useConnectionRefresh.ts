import { useEffect, useRef } from 'react';
import { subscribeConnectionUpdates } from '@/lib/connectionUpdates';

/** Re-read through the existing authorized status reader, never trust a tab's data. */
export function useConnectionRefresh(refresh: () => void | Promise<unknown>, enabled = true) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    return subscribeConnectionUpdates(() => current.current());
  }, [enabled]);
}