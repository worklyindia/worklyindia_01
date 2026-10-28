import { expect, test } from 'bun:test';
import { decodeBannerImage, isBannerKey } from '../../supabase/functions/egress-optimizer/bannerImage';
import { notifyBannerUpdate, BANNER_UPDATED_EVENT, BANNER_STORAGE_KEY } from './bannerUpdates';

test('PNG banner stays PNG with exactly the uploaded bytes', () => {
  const original = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255]);
  const result = decodeBannerImage('data:image/png;base64,' + btoa(String.fromCharCode(...original)));
  expect(result.extension).toBe('png');
  expect(result.contentType).toBe('image/png');
  expect(result.bytes).toEqual(original);
});

test('JPEG banner is not converted to WebP', () => {
  const result = decodeBannerImage('data:image/jpeg;base64,/9j/2Q==');
  expect(result.extension).toBe('jpg');
  expect(Array.from(result.bytes)).toEqual([255, 216, 255, 217]);
});

test('original and legacy banner keys can be deleted, unrelated paths cannot', () => {
  for (const extension of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']) {
    expect(isBannerKey(`hero-banners/123-abc.${extension}`)).toBe(true);
  }
  expect(isBannerKey('hero-banners/../other.png')).toBe(false);
  expect(isBannerKey('profiles/123.png')).toBe(false);
});

test('saving a banner clears stale cache and notifies open website views', () => {
  const storage = new Map([['wkly_cache_hero_banners', 'old image']]);
  const events = new EventTarget();
  let refreshed = false;
  events.addEventListener(BANNER_UPDATED_EVENT, () => { refreshed = true; });
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  try {
    notifyBannerUpdate();
    expect(storage.has('wkly_cache_hero_banners')).toBe(false);
    expect(storage.has(BANNER_STORAGE_KEY)).toBe(true);
    expect(refreshed).toBe(true);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});