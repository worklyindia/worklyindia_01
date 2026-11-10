import { XMLParser } from 'npm:fast-xml-parser@4.5.3';
import { z } from 'npm:zod@3';

type R2Config = {
  client: { fetch(input: Request): Promise<Response>; sign(input: Request, options?: { aws?: { signQuery?: boolean } }): Promise<Request> };
  bucket: string;
  accountId: string;
  publicUrl: string;
};

export const r2StorageActions = new Set([
  'r2-sa-list-buckets', 'r2-sa-list-objects', 'r2-sa-folder-stats',
  'r2-sa-create-folder', 'r2-sa-upload', 'r2-sa-delete', 'r2-sa-delete-folder', 'r2-sa-signed-url',
  'r2-sa-upload-init', 'r2-sa-upload-sign', 'r2-sa-upload-complete', 'r2-sa-upload-abort', 'r2-sa-recount',
]);

// `at` = upload time; folders remember their newest upload so lists can show newest first.
export type StatItem = { path: string; count: number; size: number; at?: string };
/** Saved per-bucket/per-folder counters, adjusted on every add/delete so lists never rescan the bucket. */
export type R2StatsStore = {
  apply(items: StatItem[]): Promise<void>;
  folders(parent: string): Promise<{ folder: string; fileCount: number; totalSize: number; latestAt?: string | null }[]>;
  reset(): Promise<void>;
};
export type R2StorageOptions = { limitBytes?: number | null; stats?: R2StatsStore };
const MIN_PART = 16 * 1024 * 1024;
export const partSizeFor = (size: number) => Math.max(MIN_PART, Math.ceil(size / 9000 / 1048576) * 1048576);

const pathSchema = z.string().max(1024).refine(
  (s) => !s.startsWith('/') && !/[\\\x00-\x1f]/.test(s) && !s.split('/').some((part) => part === '.' || part === '..'),
  'Invalid file path',
);
const schema = z.object({
  action: z.string(), bucket: z.string().optional(), prefix: pathSchema.optional(),
  path: pathSchema.optional(), name: pathSchema.optional(), search: z.string().max(255).optional(),
  cursor: z.string().max(4096).optional(), limit: z.number().int().min(1).max(1000).optional(),
  paths: z.array(pathSchema.refine((s) => s.length > 0)).min(1).max(200).optional(),
  dataBase64: z.string().max(28 * 1024 * 1024).optional(), contentType: z.string().max(255).optional(),
  download: z.boolean().optional(), overwrite: z.boolean().optional(),
  size: z.number().int().min(0).max(5 * 1024 ** 4).optional(), uploadId: z.string().max(1024).optional(),
  partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(100).optional(),
  parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10000), etag: z.string().max(200) })).min(1).max(10000).optional(),
});
const xmlEscape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const asArray = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const response = (body: unknown, headers: Record<string, string>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});

/** S3-compatible R2 API; credentials stay server-side and only the configured bucket is accessible. */
export async function handleR2Storage(input: unknown, config: R2Config, headers: Record<string, string>, opts: R2StorageOptions = {}) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return response({ success: false, error: 'Invalid storage request', details: parsed.error.flatten() }, headers, 400);
  const body = parsed.data;
  if (body.bucket && body.bucket !== config.bucket) return response({ success: false, error: 'Bucket is not configured in Owner Secrets' }, headers, 403);
  const root = `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}`;
  const keyUrl = (key: string) => `${root}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const publicUrl = (key: string) => config.publicUrl ? `${config.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}` : null;
  const request = async (url: string, init?: RequestInit) => {
    const res = await config.client.fetch(new Request(url, init));
    if (!res.ok) {
      const text = await res.text();
      const provider = parser.parse(text)?.Error;
      const error = new Error(`Cloudflare R2 [${res.status}]: ${provider?.Message || provider?.Code || res.statusText}${res.status === 403 ? ' — check R2 Object Read & Write permissions and bucket access.' : ''}`);
      throw Object.assign(error, { status: res.status, providerResponse: { code: provider?.Code, message: provider?.Message } });
    }
    return res;
  };
  const list = async (prefix: string, cursor?: string, delimiter?: string, limit = 100) => {
    const url = new URL(root);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('max-keys', String(limit));
    if (delimiter) url.searchParams.set('delimiter', delimiter);
    if (cursor) url.searchParams.set('continuation-token', cursor);
    const res = await request(url.toString());
    return parser.parse(await res.text()).ListBucketResult;
  };
  const prefix = body.prefix ? `${body.prefix.replace(/\/+$/, '')}/` : '';
  const headSize = async (key: string): Promise<number | null> => {
    const res = await config.client.fetch(new Request(keyUrl(key), { method: 'HEAD' }));
    if (res.status === 404) return null;
    if (!res.ok) throw Object.assign(new Error(`Cloudflare R2 [${res.status}]: could not read file`), { status: res.status });
    return Number(res.headers.get('content-length')) || 0;
  };
  const limitText = (b: number) => b >= 1073741824 ? `${+(b / 1073741824).toFixed(1)} GB` : `${Math.round(b / 1048576)} MB`;
  const isMarker = (key: string) => key === '.keep' || key.endsWith('/.keep');
  const deleteKeys = async (keys: string[]) => {
    // Bounded parallelism keeps large deletes fast without hammering the API.
    for (let i = 0; i < keys.length; i += 10) await Promise.all(keys.slice(i, i + 10).map((k) => request(keyUrl(k), { method: 'DELETE' })));
  };
  if (body.action === 'r2-sa-upload-init') {
    if (!body.path || body.size === undefined) return response({ success: false, error: 'File path and size required' }, headers, 400);
    if (opts.limitBytes && body.size > opts.limitBytes) return response({ success: false, error: `File is larger than this bucket's ${limitText(opts.limitBytes)} limit` }, headers, 413);
    const url = new URL(keyUrl(body.path)); url.searchParams.set('uploads', '');
    const res = await request(url.toString().replace('uploads=', 'uploads'), { method: 'POST', headers: { 'Content-Type': body.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' } });
    const uploadId = String(parser.parse(await res.text())?.InitiateMultipartUploadResult?.UploadId || '');
    if (!uploadId) return response({ success: false, error: 'Cloudflare did not start the upload' }, headers, 502);
    return response({ success: true, uploadId, partSize: partSizeFor(body.size) }, headers);
  }
  if (body.action === 'r2-sa-upload-sign') {
    if (!body.path || !body.uploadId || !body.partNumbers) return response({ success: false, error: 'Upload details required' }, headers, 400);
    const urls: Record<number, string> = {};
    for (const n of body.partNumbers) {
      const url = new URL(keyUrl(body.path));
      url.searchParams.set('partNumber', String(n)); url.searchParams.set('uploadId', body.uploadId); url.searchParams.set('X-Amz-Expires', '3600');
      urls[n] = (await config.client.sign(new Request(url, { method: 'PUT' }), { aws: { signQuery: true } })).url;
    }
    return response({ success: true, urls }, headers);
  }
  if (body.action === 'r2-sa-upload-abort') {
    if (!body.path || !body.uploadId) return response({ success: false, error: 'Upload details required' }, headers, 400);
    const url = new URL(keyUrl(body.path)); url.searchParams.set('uploadId', body.uploadId);
    await config.client.fetch(new Request(url.toString(), { method: 'DELETE' }));
    return response({ success: true }, headers);
  }
  if (body.action === 'r2-sa-upload-complete') {
    if (!body.path || !body.uploadId || !body.parts) return response({ success: false, error: 'Upload details required' }, headers, 400);
    const previous = await headSize(body.path);
    const url = new URL(keyUrl(body.path)); url.searchParams.set('uploadId', body.uploadId);
    const xml = `<CompleteMultipartUpload>${[...body.parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${xmlEscape(p.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
    const res = await request(url.toString(), { method: 'POST', body: xml, headers: { 'Content-Type': 'application/xml' } });
    const text = await res.text();
    if (/<Error>/.test(text)) return response({ success: false, error: 'Cloudflare could not finish the upload' }, headers, 502);
    const size = (await headSize(body.path)) ?? 0;
    // Server-side enforcement: a file over the bucket limit is removed even if the browser was bypassed.
    if (opts.limitBytes && size > opts.limitBytes) {
      await request(keyUrl(body.path), { method: 'DELETE' });
      if (previous !== null) await opts.stats?.apply([{ path: body.path, count: -1, size: -previous }]);
      return response({ success: false, error: `File is larger than this bucket's ${limitText(opts.limitBytes)} limit` }, headers, 413);
    }
    await opts.stats?.apply([{ path: body.path, count: previous === null ? 1 : 0, size: size - (previous ?? 0), at: new Date().toISOString() }]);
    return response({ success: true, path: body.path, size, publicUrl: publicUrl(body.path) }, headers);
  }
  if (body.action === 'r2-sa-recount') {
    // Resumable full recount: each call handles up to 20k objects; the browser continues with nextCursor.
    if (!opts.stats) return response({ success: false, error: 'Counters unavailable' }, headers, 500);
    if (!body.cursor) await opts.stats.reset();
    let cursor = body.cursor || '', pages = 0, more = false, scanned = 0;
    const items: StatItem[] = [];
    do {
      const result = await list('', cursor || undefined, undefined, 1000);
      for (const item of asArray<{ Key: string; Size: string; LastModified?: string }>(result.Contents)) {
        // Empty-folder markers add no count but keep the folder's created time.
        if (isMarker(String(item.Key))) { items.push({ path: String(item.Key), count: 0, size: 0, at: item.LastModified }); continue; }
        items.push({ path: String(item.Key), count: 1, size: Number(item.Size) || 0, at: item.LastModified }); scanned++;
      }
      more = String(result.IsTruncated) === 'true';
      cursor = more ? String(result.NextContinuationToken || '') : '';
      pages++;
    } while (more && cursor && pages < 20);
    for (let i = 0; i < items.length; i += 5000) await opts.stats.apply(items.slice(i, i + 5000));
    return response({ success: true, scanned, nextCursor: more ? cursor : '' }, headers);
  }
  if (body.action === 'r2-sa-list-buckets') {
    await list('', undefined, '/', 1); // Verify credentials and bucket without scanning the entire account.
    return response({ success: true, buckets: [{ id: config.bucket, name: config.bucket, public: true, fileSizeLimit: 20 * 1024 * 1024 }] }, headers);
  }
  if (body.action === 'r2-sa-folder-stats' && opts.stats) {
    return response({ success: true, stats: await opts.stats.folders(prefix.replace(/\/$/, '')) }, headers);
  }
  if (body.action === 'r2-sa-folder-stats') {
    // Aggregate every object below the prefix by its first-level folder (folder markers excluded), capped at 20k objects.
    const totals = new Map<string, { folder: string; fileCount: number; totalSize: number; latestAt: string | null }>();
    const newer = (a: string | null, b?: string) => (b && (!a || Date.parse(b) > Date.parse(a)) ? b : a);
    let cursor = '', pages = 0, more = false;
    do {
      const result = await list(prefix, cursor || undefined, undefined, 1000);
      for (const item of asArray<{ Key: string; Size: string; LastModified?: string }>(result.Contents)) {
        const rest = String(item.Key).slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash < 1 || rest.endsWith('/.keep')) {
          if (slash >= 1) {
            const entry = totals.get(rest.slice(0, slash)) || { folder: rest.slice(0, slash), fileCount: 0, totalSize: 0, latestAt: null };
            entry.latestAt = newer(entry.latestAt, item.LastModified);
            totals.set(entry.folder, entry);
          }
          continue;
        }
        const name = rest.slice(0, slash);
        const entry = totals.get(name) || { folder: name, fileCount: 0, totalSize: 0, latestAt: null };
        entry.fileCount += 1; entry.totalSize += Number(item.Size) || 0; entry.latestAt = newer(entry.latestAt, item.LastModified);
        totals.set(name, entry);
      }
      more = String(result.IsTruncated) === 'true';
      cursor = more ? String(result.NextContinuationToken || '') : '';
      pages += 1;
    } while (more && cursor && pages < 20);
    return response({ success: true, stats: [...totals.values()] }, headers);
  }
  if (body.action === 'r2-sa-list-objects') {
    const result = await list(prefix, body.cursor, '/', body.limit || 100);
    const folders = asArray<{ Prefix: string }>(result.CommonPrefixes).map((item) => {
      const p = String(item.Prefix).replace(/\/$/, '');
      return { name: p.slice(prefix.length), prefix: p };
    }).filter((f) => !body.search || f.name.toLowerCase().includes(body.search.toLowerCase()));
    const files = asArray<{ Key: string; Size: string; LastModified: string }>(result.Contents).map((item) => {
      const key = String(item.Key);
      return { name: key.slice(prefix.length), path: key, size: Number(item.Size), contentType: null, updatedAt: item.LastModified, publicUrl: publicUrl(key) };
    }).filter((f) => f.name && f.name !== '.keep' && (!body.search || f.name.toLowerCase().includes(body.search.toLowerCase())))
      // Newest upload first; same time falls back to name.
      .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || a.name.localeCompare(b.name));
    return response({ success: true, folders, files, hasMore: String(result.IsTruncated) === 'true', nextCursor: result.NextContinuationToken || '' }, headers);
  }
  if (body.action === 'r2-sa-signed-url') {
    if (!body.path) return response({ success: false, error: 'File path required' }, headers, 400);
    const url = new URL(keyUrl(body.path));
    url.searchParams.set('X-Amz-Expires', '3600');
    if (body.download) url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(body.path.split('/').pop() || 'file')}`);
    const signed = await config.client.sign(new Request(url), { aws: { signQuery: true } });
    return response({ success: true, url: signed.url }, headers);
  }
  if (body.action === 'r2-sa-create-folder' || body.action === 'r2-sa-upload') {
    const folder = body.action === 'r2-sa-create-folder';
    if (folder && (!body.name || body.name.includes('/'))) return response({ success: false, error: 'A single folder name is required' }, headers, 400);
    const key = folder ? `${prefix}${body.name}/.keep` : body.path;
    if (!key || (!folder && body.dataBase64 === undefined)) return response({ success: false, error: 'File path and content required' }, headers, 400);
    let bytes: Uint8Array;
    try { bytes = folder ? new Uint8Array() : Uint8Array.from(atob(body.dataBase64 || ''), (c) => c.charCodeAt(0)); }
    catch { return response({ success: false, error: 'Invalid file content' }, headers, 400); }
    if (bytes.byteLength > 20 * 1024 * 1024) return response({ success: false, error: 'Files over 20 MB use the direct upload' }, headers, 400);
    if (!folder && opts.limitBytes && bytes.byteLength > opts.limitBytes) return response({ success: false, error: `File is larger than this bucket's ${limitText(opts.limitBytes)} limit` }, headers, 413);
    const previous = folder || !opts.stats ? null : await headSize(key);
    await request(keyUrl(key), { method: 'PUT', body: new Blob([new Uint8Array(bytes).buffer]), headers: {
      'Content-Type': folder ? 'text/plain' : body.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
      ...(body.overwrite ? {} : { 'If-None-Match': '*' }),
    } });
    const at = new Date().toISOString();
    await opts.stats?.apply(folder ? [{ path: key, count: 0, size: 0, at }] : [{ path: key, count: previous === null ? 1 : 0, size: bytes.byteLength - (previous ?? 0), at }]);
    return response({ success: true, path: key, publicUrl: publicUrl(key) }, headers);
  }
  if (body.action === 'r2-sa-delete') {
    if (!body.paths) return response({ success: false, error: 'File paths required' }, headers, 400);
    const sizes = await Promise.all(body.paths.map((k) => headSize(k).catch(() => null)));
    await deleteKeys(body.paths);
    await opts.stats?.apply(body.paths.flatMap((path, i) => sizes[i] === null || isMarker(path) ? [] : [{ path, count: -1, size: -(sizes[i] as number) }]));
    return response({ success: true, deleted: body.paths.length }, headers);
  }
  if (body.action === 'r2-sa-delete-folder') {
    if (!prefix) return response({ success: false, error: 'Folder path required' }, headers, 400);
    // Deletes up to 1,000 objects per call; the browser repeats while `more` is true, so any folder size works.
    const result = await list(prefix, undefined, undefined, 1000);
    const objects = asArray<{ Key: string; Size: string }>(result.Contents).map((o) => ({ key: String(o.Key), size: Number(o.Size) || 0 }));
    await deleteKeys(objects.map((o) => o.key));
    await opts.stats?.apply(objects.filter((o) => !isMarker(o.key)).map((o) => ({ path: o.key, count: -1, size: -o.size })));
    return response({ success: true, deleted: objects.filter((o) => !isMarker(o.key)).length, more: String(result.IsTruncated) === 'true' }, headers);
  }
  return response({ success: false, error: 'Unknown Cloudflare storage action' }, headers, 400);
}

/** Counts real files (folder markers excluded) and bytes in one bucket, capped so a huge bucket cannot stall the list. */
export async function r2BucketStats(config: R2Config, maxPages = 20): Promise<{ fileCount: number; totalSize: number; truncated: boolean }> {
  const root = `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}`;
  let fileCount = 0, totalSize = 0, cursor = '', pages = 0, more = false;
  do {
    const url = new URL(root);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('max-keys', '1000');
    if (cursor) url.searchParams.set('continuation-token', cursor);
    const res = await config.client.fetch(new Request(url.toString()));
    if (!res.ok) throw new Error(`Cloudflare R2 [${res.status}]`);
    const result = parser.parse(await res.text()).ListBucketResult || {};
    for (const item of asArray<{ Key: string; Size: string }>(result.Contents)) {
      if (String(item.Key).endsWith('/.keep')) continue;
      fileCount += 1; totalSize += Number(item.Size) || 0;
    }
    more = String(result.IsTruncated) === 'true';
    cursor = more ? String(result.NextContinuationToken || '') : '';
    pages += 1;
  } while (more && cursor && pages < maxPages);
  return { fileCount, totalSize, truncated: more && !!cursor };
}
