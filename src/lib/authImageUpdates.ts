export const AUTH_IMAGE_CACHE_KEY = 'auth_images';
export const AUTH_IMAGE_UPDATED_EVENT = 'workly:auth-images-updated';
export const AUTH_IMAGE_STORAGE_KEY = 'workly:auth-images-revision';

export function notifyAuthImageUpdate(): void {
  try {
    localStorage.removeItem('wkly_cache_' + AUTH_IMAGE_CACHE_KEY);
    localStorage.setItem(AUTH_IMAGE_STORAGE_KEY, crypto.randomUUID());
  } catch { /* Notifications still work without storage. */ }
  window.dispatchEvent(new Event(AUTH_IMAGE_UPDATED_EVENT));
}