export const BANNER_CACHE_KEY = 'hero_banners';
export const BANNER_UPDATED_EVENT = 'workly:hero-banners-updated';
export const BANNER_STORAGE_KEY = 'workly:hero-banners-revision';
export function notifyBannerUpdate(): void {
  try {
    localStorage.removeItem('wkly_cache_' + BANNER_CACHE_KEY);
    localStorage.setItem(BANNER_STORAGE_KEY, crypto.randomUUID());
  } catch { /* Refresh still works without browser storage. */ }
  window.dispatchEvent(new Event(BANNER_UPDATED_EVENT));
}
