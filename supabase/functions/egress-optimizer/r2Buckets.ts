import { z } from 'npm:zod@3';

export const r2BucketActions = new Set(['r2-sa-list-buckets', 'r2-sa-create-bucket', 'r2-sa-update-bucket', 'r2-sa-delete-bucket']);
const nameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, 'Use 3–63 lowercase letters, numbers or hyphens');
const schema = z.object({ action: z.string(), name: nameSchema.optional(), public: z.boolean().optional(), fileSizeLimitMb: z.number().min(0).max(5 * 1024 * 1024).optional() });
/** Cloudflare multipart uploads allow up to 5 TB per object; 0/unset means no app limit. */
export const R2_MAX_FILE_BYTES = 5 * 1024 ** 4;
export type R2Limits = { read(): Promise<Record<string, number>>; write(map: Record<string, number>): Promise<void> };
const json = (body: unknown, headers: Record<string, string>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

// Explicit Owner Secrets integration: no connector or environment credential fallback.
export function r2Management(accountId: string, token: string, fetcher: typeof fetch = fetch) {
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Check R2_ACCOUNT_ID on Owner Secrets');
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`;
  return async (suffix: string, method = 'GET', body?: unknown) => {
    const res = await fetcher(`${base}${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      const status = res.ok ? 502 : res.status;
      throw Object.assign(new Error(`Cloudflare R2 [${status}]: ${data?.errors?.map((e: { message: string }) => e.message).join('; ') || 'Request failed'}${status === 403 ? ' — token needs Workers R2 Storage Read/Edit access to this account.' : ''}`), { status });
    }
    return data.result;
  };
}

export async function handleR2Buckets(input: unknown, api: ReturnType<typeof r2Management>, headers: Record<string, string>, stats?: (name: string) => Promise<{ fileCount: number; totalSize: number }>, limits?: R2Limits, onDeleted?: (name: string) => Promise<void>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ success: false, error: 'Invalid bucket request', details: parsed.error.flatten() }, headers, 400);
  const body = parsed.data;
  const saved = limits ? await limits.read().catch(() => ({} as Record<string, number>)) : {};
  const limitOf = (name: string) => Number(saved[name]) > 0 ? Number(saved[name]) : null;
  const setLimit = async (name: string, mb?: number) => {
    if (!limits || mb === undefined) return;
    const next = { ...saved };
    if (mb > 0) next[name] = Math.round(mb * 1024 * 1024); else delete next[name];
    await limits.write(next);
  };
  if (body.action === 'r2-sa-list-buckets') {
    const buckets: { id: string; name: string; public: boolean; fileSizeLimit: number | null; fileCount?: number; totalSize?: number }[] = [];
    let cursor = '';
    do {
      const result = await api(`?per_page=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      for (const bucket of result.buckets || []) {
        const domain = await api(`/${encodeURIComponent(bucket.name)}/domains/managed`);
        buckets.push({ id: bucket.name, name: bucket.name, public: !!domain.enabled, fileSizeLimit: limitOf(bucket.name) });
      }
      cursor = result.cursor || '';
    } while (cursor);
    if (stats) await Promise.all(buckets.map(async (b) => {
      try { Object.assign(b, await stats(b.name)); } catch { b.fileCount = 0; b.totalSize = 0; }
    }));
    return json({ success: true, buckets }, headers);
  }
  if (!body.name) return json({ success: false, error: 'Bucket name required' }, headers, 400);
  const path = `/${encodeURIComponent(body.name)}`;
  if (body.action === 'r2-sa-create-bucket') {
    await api('', 'POST', { name: body.name }); // Private unless the owner explicitly switched Public on in the form.
    if (body.public === true) await api(`${path}/domains/managed`, 'PUT', { enabled: true });
    await setLimit(body.name, body.fileSizeLimitMb);
  } else if (body.action === 'r2-sa-update-bucket') {
    if (typeof body.public !== 'boolean' && body.fileSizeLimitMb === undefined) return json({ success: false, error: 'Public access or file size setting required' }, headers, 400);
    if (typeof body.public === 'boolean') await api(`${path}/domains/managed`, 'PUT', { enabled: body.public });
    await setLimit(body.name, body.fileSizeLimitMb);
  } else if (body.action === 'r2-sa-delete-bucket') {
    await api(path, 'DELETE'); // Cloudflare refuses non-empty buckets; never silently erase files.
    await setLimit(body.name, 0);
    await onDeleted?.(body.name);
  } else return json({ success: false, error: 'Unknown bucket action' }, headers, 400);
  return json({ success: true, name: body.name }, headers);
}