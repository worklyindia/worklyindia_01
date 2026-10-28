/**
 * Persistent localStorage cache for job feed queries.
 *
 * - Stores job list results in localStorage with a 24-hour TTL.
 * - On mount, hooks read from here to instantly show previously seen jobs
 *   without hitting the API again (until the entry expires).
 * - After 24h, entries are auto-cleared so users see fresh jobs.
 */

const PREFIX = "workly:jobsCache:v1:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 40; // keep localStorage bounded

interface CacheEntry<T> {
  value: T;
  savedAt: number;
  expiresAt: number;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function makeJobsCacheKey(parts: unknown): string {
  try {
    return PREFIX + JSON.stringify(parts);
  } catch {
    return PREFIX + String(parts);
  }
}

export function readJobsCache<T>(key: string): T | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (!entry || typeof entry.expiresAt !== "number") return null;
    if (Date.now() > entry.expiresAt) {
      store.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeJobsCache<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const store = safeStorage();
  if (!store) return;
  try {
    const entry: CacheEntry<T> = {
      value,
      savedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    store.setItem(key, JSON.stringify(entry));
    trimCache(store);
  } catch {
    // Quota exceeded or serialization failed — best-effort clear and skip
    try {
      purgeExpired(store);
      store.setItem(key, JSON.stringify({
        value,
        savedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      }));
    } catch {
      /* ignore */
    }
  }
}

function purgeExpired(store: Storage): void {
  const now = Date.now();
  const toRemove: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    try {
      const entry = JSON.parse(store.getItem(k) || "null");
      if (!entry || typeof entry.expiresAt !== "number" || now > entry.expiresAt) {
        toRemove.push(k);
      }
    } catch {
      toRemove.push(k);
    }
  }
  toRemove.forEach((k) => store.removeItem(k));
}

function trimCache(store: Storage): void {
  const entries: { key: string; savedAt: number }[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    try {
      const e = JSON.parse(store.getItem(k) || "null");
      entries.push({ key: k, savedAt: e?.savedAt ?? 0 });
    } catch {
      store.removeItem(k);
    }
  }
  if (entries.length <= MAX_ENTRIES) return;
  entries.sort((a, b) => a.savedAt - b.savedAt);
  const drop = entries.slice(0, entries.length - MAX_ENTRIES);
  drop.forEach((e) => store.removeItem(e.key));
}

/** Call once on app start to remove any expired entries. */
export function cleanupExpiredJobsCache(): void {
  const store = safeStorage();
  if (!store) return;
  purgeExpired(store);
}