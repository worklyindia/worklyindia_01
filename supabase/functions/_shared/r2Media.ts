// Per-section Cloudflare R2 buckets for original-quality media.
// Each scope has its own bucket (created on first use with public access);
// object keys stay `media/<scope>/<userId>/<file>` so deletes know the bucket.
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { getOwnerSecret } from './ownerSecrets.ts';

export const MEDIA_BUCKETS: Record<string, string> = {
  'brand': 'workly-brand',
  'template-email': 'workly-template-email',
  'template-whatsapp': 'workly-template-whatsapp',
  'template-telegram': 'workly-template-telegram',
  'chat-email': 'workly-chat-email',
  'chat-whatsapp': 'workly-chat-whatsapp',
  'chat-instagram': 'workly-chat-instagram',
  'chat-facebook': 'workly-chat-facebook',
  'jobs': 'workly-jobs',
};

const ready = new Map<string, string>(); // bucket -> public base URL

async function cfApi(accountId: string, token: string, suffix: string, method = 'GET', body?: unknown) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets${suffix}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok && !!data?.success, status: res.status, data };
}

async function creds() {
  const [accountId, accessKeyId, secretAccessKey, token] = await Promise.all([
    getOwnerSecret('R2_ACCOUNT_ID'), getOwnerSecret('R2_ACCESS_KEY_ID'),
    getOwnerSecret('R2_SECRET_ACCESS_KEY'), getOwnerSecret('R2_API_TOKEN'),
  ]);
  if (!accountId || !accessKeyId || !secretAccessKey || !token) {
    throw new Error('Save R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_API_TOKEN on Owner Secrets');
  }
  return { accountId, token, client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }) };
}

/** Private email attachments never enable a public R2 domain. */
export async function privateMailStorage() {
  const { accountId, token, client } = await creds();
  const bucket = 'workly-chat-email-private';
  const exists = await cfApi(accountId, token, `/${bucket}`);
  if (exists.status === 404) {
    const created = await cfApi(accountId, token, '', 'POST', { name: bucket });
    if (!created.ok) throw new Error(`Private email storage unavailable [${created.status}]`);
  } else if (!exists.ok) throw new Error(`Private email storage unavailable [${exists.status}]`);
  const domain = await cfApi(accountId, token, `/${bucket}/domains/managed`);
  if (!domain.ok || domain.data?.result?.enabled) throw new Error('Email attachments require a private Cloudflare bucket');
  return { client, bucket, root: `https://${accountId}.r2.cloudflarestorage.com/${bucket}` };
}

/** Scope-bound browser-direct uploads reuse the proven multipart implementation. */
export async function mediaUploadConfig(scope: string) {
  const bucket = MEDIA_BUCKETS[scope];
  if (!bucket) throw new Error('Unknown media scope');
  const { accountId, token, client } = await creds();
  const publicUrl = await ensureBucket(accountId, token, bucket);
  return { client, bucket, accountId, publicUrl };
}

/** Create the scope's bucket if missing and make sure public access is on. */
async function ensureBucket(accountId: string, token: string, bucket: string): Promise<string> {
  const cached = ready.get(bucket);
  if (cached) return cached;
  const exists = await cfApi(accountId, token, `/${bucket}`);
  if (!exists.ok) {
    const created = await cfApi(accountId, token, '', 'POST', { name: bucket });
    if (!created.ok && !JSON.stringify(created.data?.errors || '').includes('already exists')) {
      throw new Error(`Cloudflare bucket ${bucket} could not be created [${created.status}]: ${created.data?.errors?.map((e: any) => e.message).join('; ') || 'unknown'}`);
    }
  }
  let domain = await cfApi(accountId, token, `/${bucket}/domains/managed`);
  if (!domain.data?.result?.enabled) domain = await cfApi(accountId, token, `/${bucket}/domains/managed`, 'PUT', { enabled: true });
  const host = domain.data?.result?.domain;
  if (!domain.ok || !host) throw new Error(`Public access for ${bucket} could not be enabled [${domain.status}]`);
  const base = `https://${host}`;
  ready.set(bucket, base);
  return base;
}

export async function putMedia(scope: string, key: string, bytes: Uint8Array | Blob, contentType: string) {
  const bucket = MEDIA_BUCKETS[scope];
  if (!bucket) throw new Error('Unknown media scope');
  const { accountId, token, client } = await creds();
  const base = await ensureBucket(accountId, token, bucket);
  const res = await client.fetch(new Request(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`, {
    method: 'PUT',
    body: bytes instanceof Blob ? bytes : new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }),
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  }));
  if (!res.ok) throw Object.assign(new Error(`Cloudflare upload failed [${res.status}]: ${await res.text()}`), { status: res.status });
  return { bucket, key, url: `${base}/${key}` };
}

/** Deletes the object; returns its previous size (0 if already gone) or null on failure. */
export async function deleteMedia(scope: string, key: string): Promise<{ bucket: string; size: number } | null> {
  const bucket = MEDIA_BUCKETS[scope];
  if (!bucket) return null;
  const { accountId, client } = await creds();
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  const head = await client.fetch(new Request(url, { method: 'HEAD' }));
  const size = head.ok ? Number(head.headers.get('content-length')) || 0 : 0;
  const res = await client.fetch(new Request(url, { method: 'DELETE' }));
  if (!res.ok && res.status !== 404) {
    console.error(`R2 media delete failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  return { bucket, size: head.ok ? size : -1 };
}
