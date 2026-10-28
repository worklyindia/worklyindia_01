import { handleR2Storage } from './r2Storage.ts';

const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const config = (fetcher: (req: Request) => Promise<Response>) => ({
  bucket: 'website', accountId: 'test', publicUrl: 'https://cdn.example.com',
  client: { fetch: fetcher, sign: async (req: Request) => req },
});

Deno.test('R2 listing parses folders, XML entities and continuation cursor', async () => {
  const res = await handleR2Storage({ action: 'r2-sa-list-objects', bucket: 'website' }, config(async () => new Response(
    '<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next&amp;page</NextContinuationToken><CommonPrefixes><Prefix>photos/</Prefix></CommonPrefixes><Contents><Key>a&amp;b.png</Key><Size>42</Size><LastModified>2026-10-14T00:00:00Z</LastModified></Contents></ListBucketResult>',
  )), {});
  const data = await res.json();
  assert(data.folders[0].prefix === 'photos', 'folder');
  assert(data.files[0].path === 'a&b.png' && data.files[0].size === 42, 'file');
  assert(data.nextCursor === 'next&page' && data.hasMore, 'cursor');
});
Deno.test('R2 listing returns newest upload first, same date ordered by time', async () => {
  const res = await handleR2Storage({ action: 'r2-sa-list-objects', bucket: 'website' }, config(async () => new Response(
    '<ListBucketResult><IsTruncated>false</IsTruncated>' +
    '<Contents><Key>a.png</Key><Size>1</Size><LastModified>2026-10-01T10:00:00Z</LastModified></Contents>' +
    '<Contents><Key>b.png</Key><Size>1</Size><LastModified>2026-10-20T08:00:00Z</LastModified></Contents>' +
    '<Contents><Key>c.png</Key><Size>1</Size><LastModified>2026-10-20T18:00:00Z</LastModified></Contents>' +
    '</ListBucketResult>',
  )), {});
  const data = await res.json();
  assert(data.files.map((f: { name: string }) => f.name).join(',') === 'c.png,b.png,a.png', 'newest first');
});
Deno.test('R2 rejects other buckets and traversal before provider requests', async () => {
  let calls = 0;
  const c = config(async () => { calls++; return new Response(); });
  assert((await handleR2Storage({ action: 'r2-sa-list-objects', bucket: 'other' }, c, {})).status === 403, 'bucket access');
  assert((await handleR2Storage({ action: 'r2-sa-delete', paths: ['../secret'] }, c, {})).status === 400, 'traversal');
  assert(calls === 0, 'no provider calls');
});
Deno.test('R2 upload keeps bytes and prevents overwrite unless confirmed', async () => {
  const bytes = new Uint8Array([0, 255, 42]);
  const c = config(async (req) => {
    assert(req.headers.get('if-none-match') === '*', 'overwrite protection');
    const content = new Uint8Array(await req.arrayBuffer());
    assert(content.every((b, i) => b === bytes[i]), 'original bytes');
    return new Response();
  });
  const res = await handleR2Storage({ action: 'r2-sa-upload', path: 'files/test.bin', dataBase64: btoa(String.fromCharCode(...bytes)) }, c, {});
  assert(res.status === 200, 'upload success');
});
Deno.test('R2 folder stats count nested files per first-level folder and ignore folder markers', async () => {
  const res = await handleR2Storage({ action: 'r2-sa-folder-stats', bucket: 'website' }, config(async () => new Response(
    '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>hero/a.png</Key><Size>100</Size></Contents><Contents><Key>hero/sub/b.png</Key><Size>50</Size></Contents><Contents><Key>hero/.keep</Key><Size>0</Size></Contents><Contents><Key>empty/.keep</Key><Size>0</Size></Contents><Contents><Key>root.png</Key><Size>9</Size></Contents></ListBucketResult>',
  )), {});
  const stats = (await res.json()).stats;
  const hero = stats.find((s: { folder: string }) => s.folder === 'hero');
  const empty = stats.find((s: { folder: string }) => s.folder === 'empty');
  assert(hero.fileCount === 2 && hero.totalSize === 150, 'hero counts');
  assert(empty.fileCount === 0 && stats.length === 2, 'empty folder and root file ignored');
});
