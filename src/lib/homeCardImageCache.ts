const CACHE_NAME = 'workly-home-card-photos-v1';
const pending = new Map<string, Promise<Blob>>();

export async function readHomeCardImage(url: string, storage: Pick<CacheStorage, 'open'> | undefined = globalThis.caches, fetchImage: typeof fetch = globalThis.fetch): Promise<Blob> {
  let cache: Cache | undefined;
  try {
    cache = await storage?.open(CACHE_NAME);
    const saved = await cache?.match(url);
    if (saved?.ok) return await saved.blob();
  } catch { /* Private mode may disable storage. */ }
  const response = await fetchImage(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error('Home photo could not be loaded');
  const blob = await response.clone().blob();
  if (!blob.type.startsWith('image/')) throw new Error('Invalid home photo');
  try { await cache?.put(url, response); } catch { /* Still display photos when storage is full. */ }
  return blob;
}

export function loadHomeCardImage(url: string): Promise<Blob> {
  const existing = pending.get(url);
  if (existing) return existing;
  const request = readHomeCardImage(url).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}