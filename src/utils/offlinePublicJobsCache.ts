/**
 * Small, bounded cache for read-only public job feed snapshots.
 * Kept separate from the normal freshness cache: this is used only as an
 * offline/error fallback and never suppresses a successful online refresh.
 */
const PREFIX = "workly:offline-public-jobs:v1:";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 8;

type Entry<T> = { savedAt: number; value: T };

export function readOfflinePublicJobs<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.savedAt !== "number" || Date.now() - entry.savedAt > TTL_MS) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.value ?? null;
  } catch {
    return null;
  }
}

export function writeOfflinePublicJobs<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
    const entries: Array<{ key: string; savedAt: number }> = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (!storageKey?.startsWith(PREFIX)) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
        if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > TTL_MS) {
          window.localStorage.removeItem(storageKey);
        } else {
          entries.push({ key: storageKey, savedAt: parsed.savedAt });
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    entries.sort((a, b) => b.savedAt - a.savedAt);
    entries.slice(MAX_ENTRIES).forEach(({ key: staleKey }) => window.localStorage.removeItem(staleKey));
  } catch {
    // Storage quota or privacy mode: offline caching is best-effort.
  }
}
