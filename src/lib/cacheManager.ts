/**
 * Cache Manager - Handles service worker and cache busting
 * Ensures users always get fresh code
 */

import { BUILD_VERSION } from './jobApplicationService';

const CACHE_VERSION_KEY = 'wfh_app_version';
const LAST_CHECK_KEY = 'wfh_last_cache_check';
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Push notification worker kabhi unregister nahi hona chahiye: uske hatne se
 * browser ki push subscription bhi mit jaati hai, aur user har visit par
 * unsubscribe → subscribe hota rehta tha.
 */
export const isPushWorkerUrl = (scriptURL: string | undefined | null): boolean =>
  Boolean(scriptURL && scriptURL.includes('firebase-messaging-sw.js'));

/**
 * Clear all caches and stale service worker registrations
 * (the push notification worker is always kept).
 */
export async function clearAllCaches(): Promise<void> {
  console.log('[CacheManager] Clearing all caches...');
  
  try {
    // Clear Cache Storage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log(`[CacheManager] Cleared ${cacheNames.length} cache(s)`);
    }
    
    // Unregister old service workers — but never the push notification worker.
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const stale = registrations.filter((reg) => {
        const worker = reg.active || reg.waiting || reg.installing;
        return !isPushWorkerUrl(worker?.scriptURL);
      });
      await Promise.all(stale.map(reg => reg.unregister()));
      console.log(`[CacheManager] Unregistered ${stale.length} service worker(s)`);
    }
    
    // Clear localStorage cache markers
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sw-') || key.startsWith('workbox-')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[CacheManager] All caches cleared');
  } catch (error) {
    console.error('[CacheManager] Error clearing caches:', error);
  }
}

/**
 * Check if we need to clear caches (version mismatch)
 */
export function checkAndClearStaleCache(): void {
  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  
  // Skip if checked recently
  if (lastCheck && (now - parseInt(lastCheck)) < CHECK_INTERVAL) {
    return;
  }
  
  localStorage.setItem(LAST_CHECK_KEY, now.toString());
  
  if (storedVersion && storedVersion !== BUILD_VERSION) {
    console.log(`[CacheManager] Version mismatch: ${storedVersion} -> ${BUILD_VERSION}`);
    // Clear caches silently in background — DO NOT reload the page.
    // BUILD_VERSION changes on every load (includes Date.now()), so reloading
    // here caused the app to auto-refresh once on every fresh open.
    clearAllCaches().then(() => {
      localStorage.setItem(CACHE_VERSION_KEY, BUILD_VERSION);
    });
  } else if (!storedVersion) {
    localStorage.setItem(CACHE_VERSION_KEY, BUILD_VERSION);
  }
}

/**
 * Force refresh with cache bust
 */
export function forceRefresh(): void {
  clearAllCaches().then(() => {
    // Clear session storage too
    sessionStorage.clear();
    // Navigate with cache bust
    window.location.href = window.location.pathname + '?v=' + Date.now();
  });
}

/**
 * Initialize cache manager on app load
 */
export function initCacheManager(): void {
  console.log(`[CacheManager] Initializing (Build: ${BUILD_VERSION})`);
  
  // Check for stale cache on load
  checkAndClearStaleCache();
  
  // Listen for update messages from service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'CACHE_UPDATED') {
        console.log('[CacheManager] Received cache update notification');
        // Optionally show a toast to user
      }
    });
  }
}
