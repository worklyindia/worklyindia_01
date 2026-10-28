/**
 * Offline-first cache layer using localStorage
 * Ensures app works even when network is slow or unavailable
 */

const CACHE_PREFIX = 'wkly_cache_';
const CACHE_TTL_KEY = '_ttl';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // ms
}

/**
 * Save data to localStorage cache
 */
export const setCacheData = <T>(key: string, data: T, ttlMs: number = 30 * 60 * 1000): void => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // localStorage full or unavailable — ignore
  }
};

/**
 * Get data from localStorage cache (returns null if expired or missing)
 */
export const getCacheData = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;

    // Return data even if "expired" — stale data > no data on slow networks
    // But mark it so caller can decide to refetch
    if (age < entry.ttl * 3) {
      return entry.data;
    }

    // Too old — remove
    localStorage.removeItem(CACHE_PREFIX + key);
    return null;
  } catch {
    return null;
  }
};

/**
 * Check if cached data is still fresh (within TTL)
 */
export const isCacheFresh = (key: string): boolean => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return false;
    const entry = JSON.parse(raw);
    return (Date.now() - entry.timestamp) < entry.ttl;
  } catch {
    return false;
  }
};

/**
 * Clear all app cache
 */
export const clearAllCache = (): void => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
};
