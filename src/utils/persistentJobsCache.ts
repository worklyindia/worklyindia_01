/**
 * Persistent job feed cache (localStorage, 24h TTL).
 *
 * Purpose:
 *  - Save every page of jobs the user scrolls through, so on next visit
 *    the same jobs load instantly without re-hitting the API.
 *  - Auto-expire after 24h so old postings don't stay pinned and new
 *    jobs get a chance to surface.
 *
 * Storage key prefix: `pjc_v1_`. Older cache keys (sessionStorage) are
 * left untouched — they naturally clear when the tab closes.
 */

const PREFIX = 'pjc_v1_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  t: number; // timestamp (ms)
  d: T;      // data
}

/**
 * Persistent jobs cache is DISABLED — the Jobs page must always fetch
 * fresh data on every visit. This helper is kept as a no-op so existing
 * call sites (useLatestJobs, useTrendingJobs, useJoobleJobs) continue
 * to compile without change. Also purges any legacy cached entries once
 * per session so stale jobs don't linger from previous versions.
 */
export function readPersistentJobsCache<T = unknown>(_key: string): T | null {
  if (typeof window !== 'undefined') {
    try {
      const w = window as unknown as { __pjcPurgedAll?: boolean };
      if (!w.__pjcPurgedAll) {
        w.__pjcPurgedAll = true;
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX)) keys.push(k);
        }
        keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
      }
    } catch { /* ignore */ }
  }
  return null;
}

/** Write a value to the persistent cache. Silently ignores quota errors. */
export function writePersistentJobsCache<T = unknown>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { t: Date.now(), d: data };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded — prune old entries and retry once.
    try {
      prunePersistentJobsCache(true);
      const entry: CacheEntry<T> = { t: Date.now(), d: data };
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch { /* give up */ }
  }
}

/**
 * Delete expired entries. If `aggressive` is true, also drop the oldest
 * half to free space on quota errors.
 */
export function prunePersistentJobsCache(aggressive = false): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const entries: Array<{ key: string; t: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as CacheEntry<unknown>;
        if (!parsed || typeof parsed.t !== 'number' || now - parsed.t > TTL_MS) {
          localStorage.removeItem(k);
        } else {
          entries.push({ key: k, t: parsed.t });
        }
      } catch {
        localStorage.removeItem(k);
      }
    }
    if (aggressive && entries.length > 0) {
      entries.sort((a, b) => a.t - b.t);
      const dropCount = Math.ceil(entries.length / 2);
      entries.slice(0, dropCount).forEach((e) => {
        try { localStorage.removeItem(e.key); } catch { /* ignore */ }
      });
    }
  } catch { /* ignore */ }
}

// Prune stale entries once per session on load.
if (typeof window !== 'undefined') {
  const w = window as unknown as { __pjcPruned?: boolean };
  if (!w.__pjcPruned) {
    w.__pjcPruned = true;
    try { prunePersistentJobsCache(); } catch { /* ignore */ }
  }
}
