import { useEffect } from 'react';

/**
 * Safety net: if a component stays in `loading = true` for longer than `ms`,
 * force it to false. Prevents forever-skeleton on mobile when in-flight
 * Supabase requests get suspended by the browser during screen-off.
 *
 * The consuming page should already render a sensible empty/error state when
 * loading turns false without data — the timeout just unsticks the UI.
 */
export function useLoadingTimeout(
  loading: boolean,
  setLoading: (v: boolean) => void,
  ms: number = 8000,
) {
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      setLoading(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [loading, setLoading, ms]);
}

export default useLoadingTimeout;