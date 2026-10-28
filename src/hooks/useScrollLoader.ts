import { useEffect, useRef } from "react";

/** Observe the end of a list inside its own scrolling panel. */
export function useScrollLoader(loadMore: () => void, hasMore: boolean, loading: boolean) {
  const rootRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || loading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        observer.disconnect();
        loadMore();
      }
    }, { root: rootRef.current, rootMargin: "0px 0px 240px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);
  return { rootRef, sentinelRef };
}