import { expect, test } from 'bun:test';
import { notifyAuthImageUpdate, AUTH_IMAGE_CACHE_KEY, AUTH_IMAGE_UPDATED_EVENT, AUTH_IMAGE_STORAGE_KEY } from './authImageUpdates';
import { getCacheData, setCacheData } from '../utils/offlineCache';

test('login images remain cached across visits until the owner changes them', () => {
  const storage = new Map<string, string>();
  const events = new EventTarget();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  let changes = 0;
  events.addEventListener(AUTH_IMAGE_UPDATED_EVENT, () => changes++);
  try {
    const images = { job_seeker_avatar: 'old.png', employer_avatar: 'employer.png' };
    setCacheData(AUTH_IMAGE_CACHE_KEY, images, Number.MAX_SAFE_INTEGER);
    const entry = JSON.parse(storage.get('wkly_cache_' + AUTH_IMAGE_CACHE_KEY) ?? '{}');
    entry.timestamp -= 365 * 24 * 60 * 60 * 1000;
    storage.set('wkly_cache_' + AUTH_IMAGE_CACHE_KEY, JSON.stringify(entry));
    expect(getCacheData(AUTH_IMAGE_CACHE_KEY)).toEqual(images);
    notifyAuthImageUpdate();
    expect(getCacheData(AUTH_IMAGE_CACHE_KEY)).toBeNull();
    expect(storage.has(AUTH_IMAGE_STORAGE_KEY)).toBe(true);
    expect(changes).toBe(1);
    setCacheData(AUTH_IMAGE_CACHE_KEY, { job_seeker_avatar: 'new.png', employer_avatar: null }, Number.MAX_SAFE_INTEGER);
    expect(getCacheData(AUTH_IMAGE_CACHE_KEY)).toEqual({ job_seeker_avatar: 'new.png', employer_avatar: null });
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});