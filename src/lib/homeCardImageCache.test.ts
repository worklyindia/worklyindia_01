import { expect, test } from 'bun:test';
import { readHomeCardImage } from './homeCardImageCache';
const imageResponse = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });

test('saved home photo is reused without any CDN request', async () => {
  let calls = 0;
  const storage = { open: async () => ({ match: async () => imageResponse() }) } as unknown as CacheStorage;
  const fetcher = (async () => { calls++; return imageResponse(); }) as typeof fetch;
  expect((await readHomeCardImage('https://photos.example/fresher.png', storage, fetcher)).size).toBe(3);
  expect(calls).toBe(0);
});

test('first visit saves bytes and next visit does not fetch again', async () => {
  let saved: Response | undefined;
  let calls = 0;
  const storage = { open: async () => ({ match: async () => saved?.clone(), put: async (_url: string, response: Response) => { saved = response.clone(); } }) } as unknown as CacheStorage;
  const fetcher = (async () => { calls++; return imageResponse(); }) as typeof fetch;
  await readHomeCardImage('/remote.png', storage, fetcher);
  expect((await readHomeCardImage('/remote.png', storage, fetcher)).size).toBe(3);
  expect(calls).toBe(1);
});

test('disabled browser storage still allows displaying a photo', async () => {
  const storage = { open: async () => { throw new Error('Storage disabled'); } };
  const fetcher = (async () => imageResponse()) as typeof fetch;
  expect((await readHomeCardImage('/photo.png', storage, fetcher)).size).toBe(3);
});

test('failed requests are not saved', async () => {
  let writes = 0;
  const storage = { open: async () => ({ match: async () => undefined, put: async () => { writes++; } }) } as unknown as CacheStorage;
  const fetcher = (async () => new Response('missing', { status: 404 })) as typeof fetch;
  await expect(readHomeCardImage('/missing.png', storage, fetcher)).rejects.toThrow();
  expect(writes).toBe(0);
});