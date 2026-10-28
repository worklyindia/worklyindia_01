// egress-optimizer + media-cdn (merged)
// Default behavior: egress analysis (GET or POST with no action).
// New media-cdn actions (POST JSON { action }):
//   "health" | "upload-cloudinary" | "upload-imagekit" | "cf-purge" | "cf-purge-all"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { decodeBannerImage, isBannerKey } from './bannerImage.ts';
import { buildMediaKey, canDeleteMedia, decodeMedia, mediaExtension, ownsUploadKey, MEDIA_SCOPES, OWNER_SCOPES, parseMediaKey } from './mediaR2.ts';
import { deleteMedia, putMedia, mediaUploadConfig } from '../_shared/r2Media.ts';
import { getOwnerSecret } from '../_shared/ownerSecrets.ts';
import { handleR2Storage, r2StorageActions, type R2StatsStore, type StatItem } from './r2Storage.ts';
import { handleR2Buckets, r2BucketActions, r2Management, R2_MAX_FILE_BYTES, type R2Limits } from './r2Buckets.ts';
import { handleLoginImages, legacyLoginPath, loginImageActions, LOGIN_BUCKET } from './loginImages.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ===================== media-cdn helpers =====================
async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cloudinaryUpload(params: { file: string; folder?: string; publicId?: string }) {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing Cloudinary secrets: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign: Record<string, string> = { timestamp };
  if (params.folder) toSign.folder = params.folder;
  if (params.publicId) toSign.public_id = params.publicId;
  const signatureBase = Object.keys(toSign).sort().map((k) => `${k}=${toSign[k]}`).join('&');
  const signature = await sha1Hex(signatureBase + apiSecret);
  const form = new FormData();
  form.append('file', params.file);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  if (params.folder) form.append('folder', params.folder);
  if (params.publicId) form.append('public_id', params.publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`Cloudinary: ${JSON.stringify(data)}`);
  return data;
}

async function imagekitUpload(params: { file: string; fileName: string; folder?: string }) {
  const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
  if (!privateKey) throw new Error('Missing IMAGEKIT_PRIVATE_KEY');

  // If `file` is a URL, pre-validate it's reachable so we return a clean error
  // instead of a 500 from ImageKit's "We are not able to download file from url".
  if (/^https?:\/\//i.test(params.file)) {
    try {
      const head = await fetch(params.file, { method: 'HEAD' });
      if (!head.ok) {
        const err: any = new Error(`Source URL not reachable (${head.status}): ${params.file}`);
        err.code = 'SOURCE_URL_UNREACHABLE';
        err.status = 400;
        throw err;
      }
    } catch (e: any) {
      if (e.code === 'SOURCE_URL_UNREACHABLE') throw e;
      const err: any = new Error(`Source URL fetch failed: ${e?.message || e}`);
      err.code = 'SOURCE_URL_UNREACHABLE';
      err.status = 400;
      throw err;
    }
  }

  const form = new FormData();
  form.append('file', params.file);
  form.append('fileName', params.fileName);
  if (params.folder) form.append('folder', params.folder);
  form.append('useUniqueFileName', 'true');
  const auth = btoa(`${privateKey}:`);
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(`ImageKit: ${JSON.stringify(data)}`);
    err.code = 'IMAGEKIT_UPLOAD_FAILED';
    err.status = res.status === 400 ? 400 : 502;
    err.providerResponse = data;
    throw err;
  }
  return data;
}

async function cloudflarePurge(urls: string[] | 'all') {
  const token = Deno.env.get('CLOUDFLARE_API_TOKEN');
  const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
  if (!token || !zoneId) throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
  const body = urls === 'all' ? { purge_everything: true } : { files: urls };
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(`Cloudflare: ${JSON.stringify(data)}`);
  return data;
}

// ===================== Cloudflare R2 banner images =====================
// Website hero banners live in Cloudflare R2 (not Supabase Storage) so
// original banner files serve without conversion or Supabase Storage egress.
const R2_LIMITS_KEY = 'r2_bucket_limits';
const r2Limits: R2Limits = {
  read: async () => {
    const { data } = await adminClient().from('app_settings').select('setting_value').eq('setting_key', R2_LIMITS_KEY).maybeSingle();
    const v = data?.setting_value as unknown;
    try { return (typeof v === 'string' ? JSON.parse(v) : v) || {}; } catch { return {}; }
  },
  write: async (map) => {
    const { error } = await adminClient().from('app_settings').upsert({ setting_key: R2_LIMITS_KEY, setting_value: JSON.stringify(map), description: 'Cloudflare R2 per-bucket max file size (bytes)' }, { onConflict: 'setting_key' });
    if (error) throw error;
  },
};

// Saved file counters (public.storage_usage_stats) so bucket/folder totals never need a full rescan.
async function applyStats(provider: 'r2' | 'supabase', bucket: string, items: StatItem[]) {
  if (!items.length) return;
  const { error } = await adminClient().rpc('storage_stats_apply', { p_provider: provider, p_bucket: bucket, p_items: items });
  if (error) console.error('[storage-stats] apply failed:', error.message);
}
function r2Stats(bucket: string): R2StatsStore {
  return {
    apply: (items) => applyStats('r2', bucket, items),
    folders: async (parent) => {
      const { data, error } = await adminClient().from('storage_usage_stats').select('prefix, file_count, total_size, latest_at')
        .eq('provider', 'r2').eq('bucket', bucket).eq('parent', parent).limit(5000);
      if (error) throw error;
      return (data || []).map((r: any) => ({ folder: String(r.prefix).slice(parent ? parent.length + 1 : 0), fileCount: Number(r.file_count) || 0, totalSize: Number(r.total_size) || 0, latestAt: r.latest_at ?? null }));
    },
    reset: async () => {
      const { error } = await adminClient().from('storage_usage_stats').delete().eq('provider', 'r2').eq('bucket', bucket);
      if (error) throw error;
      await adminClient().from('storage_usage_stats').insert({ provider: 'r2', bucket, prefix: '', parent: null, file_count: 0, total_size: 0 });
    },
  };
}
async function r2SavedTotal(bucket: string) {
  const { data } = await adminClient().from('storage_usage_stats').select('file_count, total_size')
    .eq('provider', 'r2').eq('bucket', bucket).eq('prefix', '').maybeSingle();
  return data ? { fileCount: Number(data.file_count) || 0, totalSize: Number(data.total_size) || 0, counted: true } : { fileCount: 0, totalSize: 0, counted: false };
}
// Browser direct uploads need the bucket to allow PUT and expose ETag; existing CORS rules are kept.
async function ensureR2UploadCors(bucket: string) {
  const accountId = await getOwnerSecret('R2_ACCOUNT_ID');
  const token = await getOwnerSecret('R2_API_TOKEN');
  if (!accountId || !token) throw new Error('Save R2_ACCOUNT_ID and R2_API_TOKEN on Owner Secrets for direct uploads');
  const api = r2Management(accountId, token);
  const current = await api(`/${encodeURIComponent(bucket)}/cors`).catch(() => ({ rules: [] }));
  const rules = Array.isArray(current?.rules) ? current.rules : [];
  const ready = rules.some((r: any) => (r.allowed?.methods || []).includes('PUT') && (r.exposeHeaders || []).map((h: string) => h.toLowerCase()).includes('etag'));
  if (ready) return;
  await api(`/${encodeURIComponent(bucket)}/cors`, 'PUT', { rules: [...rules, { id: 'workly-direct-upload', allowed: { origins: ['*'], methods: ['PUT', 'GET', 'HEAD'], headers: ['*'] }, exposeHeaders: ['ETag'], maxAgeSeconds: 3600 }] });
}

async function r2Client(storageBucket?: string) {
  // R2 credentials come only from the Owner Secrets page (public.owner_secrets).
  const accountId = await getOwnerSecret('R2_ACCOUNT_ID');
  const accessKeyId = await getOwnerSecret('R2_ACCESS_KEY_ID');
  const secretAccessKey = await getOwnerSecret('R2_SECRET_ACCESS_KEY');
  const defaultBucket = await getOwnerSecret('R2_BUCKET_NAME');
  const bucket = storageBucket || defaultBucket;
  let publicUrl = await getOwnerSecret('R2_PUBLIC_URL');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || (!storageBucket && !publicUrl)) {
    throw new Error('R2 secrets missing — save them on the Owner Secrets page: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
  }
  if (storageBucket) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(storageBucket)) throw Object.assign(new Error('Invalid bucket name'), { status: 400 });
    const token = await getOwnerSecret('R2_API_TOKEN');
    if (!token) throw new Error('Save R2_API_TOKEN on Owner Secrets for bucket management');
    const domain = await r2Management(accountId, token)(`/${encodeURIComponent(storageBucket)}/domains/managed`);
    publicUrl = domain.enabled ? (storageBucket === defaultBucket && publicUrl ? publicUrl : `https://${domain.domain}`) : '';
  }
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
    bucket,
    accountId,
    publicUrl: (publicUrl || '').replace(/\/+$/, ''),
  };
}

async function handleR2Media(req: Request, raw: any): Promise<Response> {
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('r2-upload-media'), scope: z.enum(MEDIA_SCOPES), file: z.string().min(1).max(14 * 1024 * 1024) }),
    z.object({ action: z.literal('r2-delete-media'), keys: z.array(z.string().max(255)).min(1).max(50) }),
    z.object({ action: z.literal('r2-media-upload-init'), scope: z.enum(MEDIA_SCOPES), contentType: z.string().max(255), size: z.number().int().positive().max(R2_MAX_FILE_BYTES) }),
    z.object({ action: z.literal('r2-media-upload-sign'), scope: z.enum(MEDIA_SCOPES), path: z.string(), uploadId: z.string().max(1024), partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(100) }),
    z.object({ action: z.literal('r2-media-upload-complete'), scope: z.enum(MEDIA_SCOPES), path: z.string(), uploadId: z.string().max(1024), parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10000), etag: z.string().max(200) })).min(1).max(10000) }),
    z.object({ action: z.literal('r2-media-upload-abort'), scope: z.enum(MEDIA_SCOPES), path: z.string(), uploadId: z.string().max(1024) }),
  ]).safeParse(raw);
  if (!parsed.success) return json({ error: 'Invalid media request', details: parsed.error.flatten() }, 400);
  const body = parsed.data;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const asUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false } });
  const { data: u } = await asUser.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return json({ ok: false, error: 'Please sign in again' }, 401);
  const privileged = await isOwnerOrAdmin(req);

  if ('scope' in body && body.action.startsWith('r2-media-upload-')) {
    if (OWNER_SCOPES.has(body.scope) && !privileged) return json({ ok: false, error: 'Unauthorized' }, 403);
    const path = body.action === 'r2-media-upload-init'
      ? buildMediaKey(body.scope, uid, mediaExtension(body.contentType))
      : 'path' in body ? body.path : '';
    if (!ownsUploadKey(path, body.scope, uid)) return json({ ok: false, error: 'Unauthorized upload path' }, 403);
    const config = await mediaUploadConfig(body.scope);
    const limit = Number((await r2Limits.read())[config.bucket]) || R2_MAX_FILE_BYTES;
    if (body.action === 'r2-media-upload-init') await ensureR2UploadCors(config.bucket);
    const result = await handleR2Storage({ ...body, action: body.action.replace('r2-media-', 'r2-sa-'), path, bucket: config.bucket }, config, corsHeaders, { limitBytes: limit, stats: r2Stats(config.bucket) });
    const data = await result.json();
    return json({ ...data, key: path, path, url: data.publicUrl || `${config.publicUrl}/${path}` }, result.status);
  }

  if (body.action === 'r2-upload-media') {
    if (OWNER_SCOPES.has(body.scope) && !privileged) return json({ ok: false, error: 'Unauthorized' }, 403);
    let file;
    try { file = decodeMedia(body.file); }
    catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'Invalid file' }, 400); }
    try {
      const saved = await putMedia(body.scope, buildMediaKey(body.scope, uid, file.extension), file.bytes, file.contentType);
      // Keep the owner Cloudflare Storage page counters in sync.
      await applyStats('r2', saved.bucket, [{ path: saved.key, count: 1, size: file.bytes.length, at: new Date().toISOString() }]);
      return json({ ok: true, ...saved, contentType: file.contentType, size: file.bytes.length });
    } catch (e) {
      console.error('R2 media upload failed:', e);
      return json({ ok: false, error: e instanceof Error ? e.message : 'Cloudflare upload failed' }, (e as any)?.status || 500);
    }
  }

  if (body.action !== 'r2-delete-media') return json({ ok: false, error: 'Invalid media action' }, 400);
  const deleted: string[] = [];
  for (const key of body.keys) {
    const parsedKey = parseMediaKey(key);
    if (!parsedKey || !canDeleteMedia(key, uid, privileged)) continue;
    const gone = await deleteMedia(parsedKey.scope, key);
    if (!gone) continue;
    deleted.push(key);
    if (gone.size >= 0) await applyStats('r2', gone.bucket, [{ path: key, count: -1, size: -gone.size }]);
  }
  return json({ ok: true, deleted });
}

async function handleR2Banner(body: any): Promise<Response> {
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('r2-upload-banner'), file: z.string().min(1).max(14 * 1024 * 1024) }),
    z.object({ action: z.literal('r2-delete-banner'), key: z.string().max(255).refine(isBannerKey) }),
  ]).safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid banner image request', details: parsed.error.flatten() }, 400);
  body = parsed.data;
  const { client, bucket, accountId, publicUrl } = await r2Client();
  const r2Url = (key: string) =>
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  if (body.action === 'r2-upload-banner') {
    if (!body.file || typeof body.file !== 'string') return json({ error: 'file (data URL) required' }, 400);
    let image;
    try { image = decodeBannerImage(body.file); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid image' }, 400); }
    const { bytes, contentType, extension } = image;
    const key = `hero-banners/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const res = await client.fetch(
      new Request(r2Url(key), {
        method: 'PUT',
        body: new Blob([bytes], { type: contentType }),
        headers: { 'Content-Type': contentType },
      }),
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`R2 upload failed [${res.status}]: ${text}`);
      return json({ error: 'R2 upload failed', status: res.status, details: text }, res.status);
    }
    return json({ ok: true, key, url: `${publicUrl}/${key}` });
  }

  // r2-delete-banner
  const key = String(body.key || '');
  if (!isBannerKey(key)) {
    return json({ error: 'Valid hero-banners key is required' }, 400);
  }
  const res = await client.fetch(new Request(r2Url(key), { method: 'DELETE' }));
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    console.error(`R2 delete failed [${res.status}]: ${text}`);
    return json({ error: 'R2 delete failed', status: res.status, details: text }, res.status);
  }
  return json({ ok: true });
}

async function handleMediaCdn(body: any): Promise<Response> {
  const action = body.action as string;
  switch (action) {
    case 'migrate-images': {
      const target = (body.target || 'all') as 'profiles' | 'companies' | 'all';
      const limit = Math.min(Number(body.limit) || 200, 500);
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } },
      );
      const isSb = (u: string | null | undefined) =>
        !u || u.includes('.supabase.co/storage/') || u.includes('.supabase.in/storage/');
      const extOf = (ct: string | null, url: string) => {
        const m = (url.split('?')[0] || '').match(/\.([a-z0-9]{2,5})$/i);
        if (m) return m[1].toLowerCase();
        if (ct?.includes('png')) return 'png';
        if (ct?.includes('webp')) return 'webp';
        if (ct?.includes('gif')) return 'gif';
        return 'jpg';
      };
      const reupload = async (url: string, bucket: string, folder: string) => {
        try {
          const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 image-migrator' } });
          if (!res.ok) return null;
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength < 200) return null;
          const ct = res.headers.get('content-type');
          const ext = extOf(ct, url);
          const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
          const { error } = await admin.storage.from(bucket).upload(path, buf, {
            contentType: ct || `image/${ext}`,
            upsert: true,
            cacheControl: '31536000',
          });
          if (error) { console.error('upload', error); return null; }
          return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        } catch (e) {
          console.warn('reupload failed', url, e);
          return null;
        }
      };
      const result: Record<string, any> = {};
      if (target === 'profiles' || target === 'all') {
        const { data } = await admin
          .from('profiles')
          .select('user_id, profile_image_url')
          .not('profile_image_url', 'is', null)
          .not('profile_image_url', 'ilike', '%supabase.co/storage/%')
          .not('profile_image_url', 'ilike', '%supabase.in/storage/%')
          .not('profile_image_url', 'ilike', '%media.licdn.com%')
          .limit(limit);
        const out: any[] = [];
        for (const row of data || []) {
          const cur = (row.profile_image_url || '').trim();
          if (!cur || isSb(cur)) continue;
          const newUrl = await reupload(cur, 'profile-photos', row.user_id);
          if (newUrl) {
            await admin.from('profiles').update({ profile_image_url: newUrl }).eq('user_id', row.user_id);
            out.push({ user_id: row.user_id, ok: true });
          } else {
            out.push({ user_id: row.user_id, ok: false });
          }
        }
        result.profiles = { count: out.length, ok: out.filter(x => x.ok).length, items: out };
      }
      if (target === 'companies' || target === 'all') {
        const { data } = await admin
          .from('companies')
          .select('id, user_id, logo_url')
          .not('logo_url', 'is', null)
          .not('logo_url', 'ilike', '%supabase.co/storage/%')
          .not('logo_url', 'ilike', '%supabase.in/storage/%')
          .limit(limit);
        const out: any[] = [];
        for (const row of data || []) {
          const cur = (row.logo_url || '').trim();
          if (!cur || isSb(cur)) continue;
          const folder = row.user_id || row.id;
          const newUrl = await reupload(cur, 'company-logos', folder);
          if (newUrl) {
            await admin.from('companies').update({ logo_url: newUrl }).eq('id', row.id);
            out.push({ id: row.id, ok: true });
          } else {
            out.push({ id: row.id, ok: false });
          }
        }
        result.companies = { count: out.length, ok: out.filter(x => x.ok).length, items: out };
      }
      return json({ ok: true, result });
    }
    case 'health':
      return json({
        ok: true,
        secrets: {
          CLOUDINARY_API_KEY: !!Deno.env.get('CLOUDINARY_API_KEY'),
          CLOUDINARY_CLOUD_NAME: !!Deno.env.get('CLOUDINARY_CLOUD_NAME'),
          CLOUDINARY_API_SECRET: !!Deno.env.get('CLOUDINARY_API_SECRET'),
          IMAGEKIT_PUBLIC_KEY: !!Deno.env.get('IMAGEKIT_PUBLIC_KEY'),
          IMAGEKIT_PRIVATE_KEY: !!Deno.env.get('IMAGEKIT_PRIVATE_KEY'),
          IMAGEKIT_URL_ENDPOINT: !!Deno.env.get('IMAGEKIT_URL_ENDPOINT'),
          CLOUDFLARE_API_TOKEN: !!Deno.env.get('CLOUDFLARE_API_TOKEN'),
          CLOUDFLARE_ACCOUNT_ID: !!Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),
          CLOUDFLARE_ZONE_ID: !!Deno.env.get('CLOUDFLARE_ZONE_ID'),
        },
      });
    case 'upload-cloudinary': {
      if (!body.file) return json({ error: 'file required' }, 400);
      const data = await cloudinaryUpload({ file: body.file, folder: body.folder, publicId: body.publicId });
      return json({ ok: true, provider: 'cloudinary', data });
    }
    case 'upload-imagekit': {
      if (!body.file || !body.fileName) return json({ error: 'file & fileName required' }, 400);
      const data = await imagekitUpload({ file: body.file, fileName: body.fileName, folder: body.folder });
      return json({ ok: true, provider: 'imagekit', data });
    }
    case 'cf-purge': {
      if (!Array.isArray(body.urls) || body.urls.length === 0) return json({ error: 'urls[] required' }, 400);
      return json({ ok: true, data: await cloudflarePurge(body.urls) });
    }
    case 'cf-purge-all':
      return json({ ok: true, data: await cloudflarePurge('all') });
    case 'compress-storage':
      return await handleCompressStorage(body);
    default:
      return json({ error: 'Unknown action', actions: ['health', 'upload-cloudinary', 'upload-imagekit', 'cf-purge', 'cf-purge-all', 'compress-storage'] }, 400);
  }
}

// ===================== egress analysis (original) =====================
interface EgressAnalysis {
  category: string;
  issue: string;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
  estimated_savings: string;
}

async function handleEgressAnalysis(): Promise<Response> {
  console.log('📊 Analyzing egress optimization opportunities...');
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const analysis: EgressAnalysis[] = [];
  const highFrequencyTables = ['live_sessions', 'job_interactions', 'whatsapp_webhook_logs', 'function_logs', 'api_request_logs', 'daily_unique_visitors'];
  for (const tableName of highFrequencyTables) {
    try {
      const { count } = await supabaseClient.from(tableName).select('*', { count: 'exact', head: true });
      if (count && count > 500) {
        analysis.push({
          category: 'high_volume_table',
          issue: `${tableName} में ${count} rows हैं`,
          impact: count > 2000 ? 'high' : count > 1000 ? 'medium' : 'low',
          suggestion: `${tableName} का retention period कम करें या aggressive cleanup enable करें`,
          estimated_savings: `~${Math.round((count * 0.5) / 1000)}KB egress per query`,
        });
      }
    } catch { /* table missing */ }
  }

  const { count: activeSessions } = await supabaseClient
    .from('live_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
  if (activeSessions && activeSessions > 50) {
    analysis.push({
      category: 'realtime_subscriptions',
      issue: `${activeSessions} active realtime connections`,
      impact: 'high',
      suggestion: 'Realtime subscriptions को optimize करें - सिर्फ ज़रूरी tables पर use करें',
      estimated_savings: '~20-40% egress reduction',
    });
  }

  for (const tableName of ['jobs', 'companies', 'profiles']) {
    try {
      const { count } = await supabaseClient.from(tableName).select('*', { count: 'exact', head: true });
      if (count && count > 100) {
        analysis.push({
          category: 'large_response',
          issue: `${tableName} table में ${count} rows - full selects से heavy egress`,
          impact: 'medium',
          suggestion: `${tableName} queries में pagination और specific column selection use करें`,
          estimated_savings: '~30-50% egress reduction per query',
        });
      }
    } catch { /* skip */ }
  }

  const { data: tips } = await supabaseClient
    .from('egress_optimization_tips')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  let egressScore = 50;
  analysis.forEach((item) => {
    if (item.impact === 'high') egressScore += 15;
    else if (item.impact === 'medium') egressScore += 8;
    else egressScore += 3;
  });
  egressScore = Math.min(100, egressScore);

  const recommendations: any[] = [];
  if (egressScore > 70) recommendations.push({ priority: 1, action: 'immediate_cleanup', title: 'तुरंत Aggressive Cleanup चलाएं', description: 'High egress risk - सभी old data delete करें' });
  if (analysis.some((a) => a.category === 'realtime_subscriptions')) recommendations.push({ priority: 2, action: 'reduce_realtime', title: 'Realtime Subscriptions Review करें', description: 'जहाँ ज़रूरी नहीं, polling या manual refresh use करें' });
  if (analysis.some((a) => a.category === 'large_response')) recommendations.push({ priority: 3, action: 'optimize_queries', title: 'Query Optimization', description: 'Pagination और specific columns select करें' });
  recommendations.push({ priority: 4, action: 'enable_caching', title: 'Client-side Caching', description: 'React Query staleTime बढ़ाएं (5-10 minutes)' });

  console.log(`✅ Egress analysis complete. Score: ${egressScore}/100`);
  return json({
    success: true,
    timestamp: new Date().toISOString(),
    egress_score: egressScore,
    score_label: egressScore > 70 ? 'Critical' : egressScore > 50 ? 'Warning' : 'Good',
    analysis,
    recommendations,
    tips: tips || [],
  });
}

// ===================== storage auto cleanup =====================
// Removes Storage files the website no longer references anywhere in the
// database (replaced profile photos, removed job images, deleted banners,
// leftover generated images...). "Referenced" is computed in SQL by scanning
// every text/json column of the public schema, so new tables and columns are
// covered automatically. Files younger than `grace_hours` are never touched,
// so an upload that is still being saved stays safe.
async function handleStorageCleanup(body: any): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ success: false, error: 'Missing Supabase env' }, 500);

  const graceHours = Number(body.grace_hours ?? 24);
  const maxRows = Math.min(Number(body.max_rows ?? 300), 1000);
  const dryRun = body.dry_run === true;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc('storage_orphan_objects', {
    grace_hours: graceHours,
    max_rows: maxRows,
  });
  if (error) return json({ success: false, error: error.message }, 500);

  const rows = (data || []) as Array<{ bucket_id: string; object_name: string; size_bytes: number | null }>;
  if (!rows.length) {
    return json({ success: true, dry_run: dryRun, scanned: 0, deleted: 0, freed_mb: 0 });
  }

  const byBucket = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byBucket.get(r.bucket_id) ?? [];
    list.push(r);
    byBucket.set(r.bucket_id, list);
  }

  let deleted = 0;
  let freed = 0;
  const failures: string[] = [];

  if (!dryRun) {
    for (const [bucket, list] of byBucket) {
      for (let i = 0; i < list.length; i += 50) {
        const chunk = list.slice(i, i + 50);
        const { error: rmError } = await admin.storage
          .from(bucket)
          .remove(chunk.map((c) => c.object_name));
        if (rmError) { failures.push(`${bucket}: ${rmError.message}`); continue; }
        deleted += chunk.length;
        freed += chunk.reduce((s, c) => s + (c.size_bytes || 0), 0);
        await admin.from('storage_cleanup_log').insert(
          chunk.map((c) => ({
            bucket_id: bucket,
            object_name: c.object_name,
            size_bytes: c.size_bytes,
            reason: 'unreferenced',
          })),
        );
      }
    }
  }

  return json({
    success: true,
    dry_run: dryRun,
    scanned: rows.length,
    deleted,
    freed_mb: Math.round((freed / 1048576) * 100) / 100,
    failures,
    sample: rows.slice(0, 10).map((r) => `${r.bucket_id}/${r.object_name}`),
  });
}

// ===================== storage image compression =====================
// Re-compresses oversized images that already live in public Storage buckets.
// Each file is re-uploaded to the SAME path with the SAME content type, so all
// existing public URLs keep working — only the byte size drops (cached egress).
// Compression is done via the free wsrv.nl image proxy (already used by the app).
const COMPRESS_DEFAULT_BUCKETS = ['brand-assets', 'public-assets', 'ai-engagement-images', 'job-images'];

// Auto-discovery: every bucket in the project (including buckets created later)
// is scanned, so new folders / new buckets are covered without a code change.
// Public AND private buckets are included: private files are fetched with the
// service-role key and uploaded to the image proxy directly (no public URL).
async function discoverBuckets(admin: any): Promise<{ names: string[]; publicNames: Set<string> }> {
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error || !Array.isArray(data) || !data.length) {
      return { names: COMPRESS_DEFAULT_BUCKETS, publicNames: new Set(COMPRESS_DEFAULT_BUCKETS) };
    }
    const names = data.map((b: any) => b.name || b.id).filter(Boolean);
    const publicNames = new Set(data.filter((b: any) => b.public).map((b: any) => b.name || b.id));
    return names.length ? { names, publicNames } : { names: COMPRESS_DEFAULT_BUCKETS, publicNames: new Set(COMPRESS_DEFAULT_BUCKETS) };
  } catch {
    return { names: COMPRESS_DEFAULT_BUCKETS, publicNames: new Set(COMPRESS_DEFAULT_BUCKETS) };
  }
}

// Per-asset rules. Keeps maximum compatibility:
//  - favicon / og image stay PNG (social scrapers + browsers expect png/jpeg there)
//  - everything else becomes WebP bytes at the SAME path with content-type image/webp
//    (browsers follow content-type, so existing URLs keep rendering)
function compressPlanFor(path: string, contentType?: string, defWidth = 1600, defQuality = 78):
  { output: 'png' | 'jpg' | 'webp'; width: number; quality: number } | null {
  const p = path.toLowerCase();
  const ext = (p.split('?')[0].split('.').pop() || '');
  const ct = (contentType || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) || /png|jpeg|webp/.test(ct);
  if (!isImage) return null; // svg / gif / unknown -> untouched

  if (p.includes('favicon')) return { output: 'png', width: 256, quality: 90 };
  // Social preview images: JPEG (universally accepted by WhatsApp/Facebook/X scrapers)
  if (p.includes('og_image') || p.includes('og-image')) return { output: 'jpg', width: 1200, quality: 82 };
  if (p.includes('logo')) return { output: 'webp', width: 640, quality: 88 };
  if (p.includes('hero') || p.includes('banner')) return { output: 'webp', width: defWidth, quality: 80 };
  return { output: 'webp', width: Math.min(defWidth, 1200), quality: defQuality };
}

async function handleCompressStorage(body: any): Promise<Response> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
  const discovered = await discoverBuckets(admin);
  const buckets: string[] = Array.isArray(body.buckets) && body.buckets.length
    ? body.buckets
    : discovered.names;
  const publicBuckets: Set<string> = Array.isArray(body.buckets) && body.buckets.length
    ? new Set([...discovered.publicNames].filter((n) => (body.buckets as string[]).includes(n)))
    : discovered.publicNames;
  const minBytes = Number(body.minBytes) || 250 * 1024;
  // Any non-WebP image above this size is converted even if it is below minBytes,
  // so nothing stays as raw PNG/JPEG in Storage.
  const webpMinBytes = Number(body.webpMinBytes) || 40 * 1024;
  const maxWidth = Number(body.maxWidth) || 1600;
  const quality = Number(body.quality) || 78;
  const limit = Math.min(Number(body.limit) || 25, 200);
  const dryRun = body.dryRun === true;

  const items: any[] = [];
  let processed = 0;
  let saved = 0;

  const isWebp = (path: string, ct?: string) =>
    path.toLowerCase().split('?')[0].endsWith('.webp') || (ct || '').toLowerCase().includes('webp');

  for (const bucket of buckets) {
    if (processed >= limit) break;
    const collected: { path: string; size: number; contentType?: string }[] = [];
    const walk = async (prefix: string, depth: number) => {
      if (depth > 5) return;
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (error) return;
      for (const entry of data || []) {
        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const meta = entry.metadata as { size?: number; mimetype?: string } | null;
        if (meta && typeof meta.size === 'number') {
          collected.push({ path: entryPath, size: meta.size, contentType: meta.mimetype });
        } else {
          await walk(entryPath, depth + 1);
        }
      }
    };
    await walk('', 0);

    const targets = collected
      .filter((o) => o.size >= minBytes || (!isWebp(o.path, o.contentType) && o.size >= webpMinBytes))
      .sort((a, b) => b.size - a.size);
    for (const obj of targets) {
      if (processed >= limit) break;
      const plan = compressPlanFor(obj.path, obj.contentType, maxWidth, quality);
      if (!plan) continue;
      const output = plan.output;
      processed++;
      const proxy = new URL('https://wsrv.nl/');
      proxy.searchParams.set('w', String(plan.width));
      proxy.searchParams.set('we', '');
      proxy.searchParams.set('q', String(plan.quality));
      proxy.searchParams.set('output', output);
      if (output === 'png') proxy.searchParams.set('l', '9');
      try {
        let res: Response;
        if (publicBuckets.has(bucket)) {
          // Public bucket: proxy fetches the file itself via its public URL.
          proxy.searchParams.set('url', admin.storage.from(bucket).getPublicUrl(obj.path).data.publicUrl);
          res = await fetch(proxy.toString());
        } else {
          // Private bucket: mint a short-lived signed URL (5 min) that the
          // proxy can fetch once, then re-upload the compressed bytes in place.
          const { data: signed, error: signErr } = await admin.storage.from(bucket).createSignedUrl(obj.path, 300);
          if (signErr || !signed?.signedUrl) {
            items.push({ bucket, path: obj.path, before: obj.size, ok: false, skipped: `signed-url: ${signErr?.message || 'no url'}` });
            continue;
          }
          proxy.searchParams.set('url', signed.signedUrl);
          res = await fetch(proxy.toString());
        }
        if (!res.ok) {
          items.push({ bucket, path: obj.path, before: obj.size, ok: false, skipped: `proxy ${res.status}` });
          continue;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Safety: only replace when the new file is valid and clearly smaller.
        if (bytes.byteLength < 1024 || bytes.byteLength >= obj.size * 0.9) {
          items.push({ bucket, path: obj.path, before: obj.size, after: bytes.byteLength, ok: false, skipped: 'no meaningful saving' });
          continue;
        }
        if (dryRun) {
          saved += obj.size - bytes.byteLength;
          items.push({ bucket, path: obj.path, before: obj.size, after: bytes.byteLength, ok: true, skipped: 'dry run' });
          continue;
        }
        const contentType = output === 'jpg' ? 'image/jpeg' : `image/${output}`;
        const { error: upErr } = await admin.storage.from(bucket).upload(obj.path, bytes, {
          contentType,
          upsert: true,
          cacheControl: '31536000',
        });
        if (upErr) {
          items.push({ bucket, path: obj.path, before: obj.size, ok: false, skipped: upErr.message });
          continue;
        }
        saved += obj.size - bytes.byteLength;
        items.push({ bucket, path: obj.path, before: obj.size, after: bytes.byteLength, ok: true });
      } catch (e) {
        items.push({ bucket, path: obj.path, before: obj.size, ok: false, skipped: String(e) });
      }
    }
  }

  return json({
    ok: true,
    dry_run: dryRun,
    processed,
    replaced: items.filter((i) => i.ok && !i.skipped).length,
    saved_mb: Math.round((saved / 1048576) * 100) / 100,
    items,
  });
}

// ===================== storage admin (owner portal file browser) =====================
const STORAGE_ADMIN_ACTIONS = new Set([
  'sa-list-buckets',
  'sa-list-objects',
  'sa-signed-url',
  'sa-delete',
  'sa-delete-folder',
  'sa-upload',
  'sa-create-bucket',
  'sa-update-bucket',
  'sa-delete-bucket',
  'sa-create-folder',
  'sa-folder-stats',
  'sa-upload-url',
  'sa-upload-done',
]);
const SUPABASE_STATS_AT = 'supabase_storage_stats_at';
const SUPABASE_STATS_MAX_AGE_MS = 15 * 60 * 1000;

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

async function isOwnerOrAdmin(req: Request): Promise<boolean> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('authorization') ?? '';
  if (!auth) {
    console.warn('[storage-admin] no authorization header');
    return false;
  }
  if (serviceKey && auth.replace(/^Bearer\s+/i, '').trim() === serviceKey) return true;

  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { auth: { persistSession: false } },
  );
  const { data, error } = await asUser.auth.getUser(token);
  const uid = data?.user?.id;
  if (!uid) {
    console.warn('[storage-admin] token not resolvable to a user:', error?.message);
    return false;
  }
  const db = adminClient();
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', uid);
  if ((roles || []).some((r: any) => ['owner', 'admin'].includes(String(r.role)))) return true;
  const { data: au } = await db.from('admin_users').select('role').eq('user_id', uid).maybeSingle();
  if (au && ['owner', 'admin'].includes(String((au as any).role))) return true;
  console.warn('[storage-admin] user has no owner/admin role:', uid);
  return false;
}


async function handleStorageAdmin(body: any) {
  const db = adminClient();
  const action = String(body.action);

  if (action === 'sa-list-buckets') {
    const { data, error } = await db.storage.listBuckets();
    if (error) throw error;
    // Serve saved totals; a full recount runs only on Refresh or when the snapshot is older than 15 minutes
    // (catches uploads made elsewhere in the app). A failed recount keeps the last saved numbers.
    const { data: at } = await db.from('app_settings').select('setting_value').eq('setting_key', SUPABASE_STATS_AT).maybeSingle();
    const last = Date.parse(String(at?.setting_value ?? '').replace(/"/g, '')) || 0;
    if (body.refresh === true || Date.now() - last > SUPABASE_STATS_MAX_AGE_MS) {
      const { data: fresh, error: statsErr } = await db.rpc('admin_storage_bucket_stats');
      if (!statsErr) {
        const rows = ((fresh as any[]) || []).map((r) => ({ provider: 'supabase', bucket: String(r.bucket_id), prefix: '', parent: null, file_count: Number(r.file_count) || 0, total_size: Number(r.total_size) || 0, updated_at: new Date().toISOString() }));
        const known = new Set(rows.map((r) => r.bucket));
        for (const b of data || []) if (!known.has(b.name)) rows.push({ provider: 'supabase', bucket: b.name, prefix: '', parent: null, file_count: 0, total_size: 0, updated_at: new Date().toISOString() });
        if (rows.length) await db.from('storage_usage_stats').upsert(rows, { onConflict: 'provider,bucket,prefix' });
        await db.from('app_settings').upsert({ setting_key: SUPABASE_STATS_AT, setting_value: JSON.stringify(new Date().toISOString()), description: 'Last full Supabase storage recount' }, { onConflict: 'setting_key' });
      } else console.error('[storage-stats] recount failed, serving saved totals:', statsErr.message);
    }
    const { data: savedRows } = await db.from('storage_usage_stats').select('bucket, file_count, total_size').eq('provider', 'supabase').eq('prefix', '');
    const byBucket = new Map<string, { file_count: number; total_size: number }>();
    for (const row of (savedRows as any[]) || []) {
      byBucket.set(String(row.bucket), { file_count: Number(row.file_count) || 0, total_size: Number(row.total_size) || 0 });
    }
    return json({
      success: true,
      buckets: (data || []).map((b: any) => {
        const s = byBucket.get(b.name) || byBucket.get(b.id) || { file_count: 0, total_size: 0 };
        return {
          id: b.id,
          name: b.name,
          public: !!b.public,
          fileSizeLimit: b.file_size_limit ?? null,
          fileCount: s.file_count,
          totalSize: s.total_size,
        };
      }),
    });
  }

  if (action === 'sa-create-bucket') {
    const name = String(body.name || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) {
      return json({ success: false, error: 'Use 3-63 lowercase letters, numbers or hyphens' }, 400);
    }
    const limitMb = Number(body.fileSizeLimitMb) || 0;
    const { error } = await db.storage.createBucket(name, {
      public: !!body.public,
      fileSizeLimit: limitMb > 0 ? limitMb * 1024 * 1024 : undefined,
    });
    if (error) throw error;
    return json({ success: true, name });
  }

  if (action === 'sa-update-bucket') {
    const name = String(body.name || '');
    if (!name) return json({ success: false, error: 'name required' }, 400);
    const opts: Record<string, unknown> = {};
    if (typeof body.public === 'boolean') opts.public = body.public;
    if (body.fileSizeLimitMb !== undefined && body.fileSizeLimitMb !== null) {
      const mb = Number(body.fileSizeLimitMb);
      opts.fileSizeLimit = mb > 0 ? mb * 1024 * 1024 : null;
    }
    const { error } = await db.storage.updateBucket(name, opts as any);
    if (error) throw error;
    return json({ success: true });
  }

  if (action === 'sa-delete-bucket') {
    const name = String(body.name || '');
    if (!name) return json({ success: false, error: 'name required' }, 400);
    const { error: emptyErr } = await db.storage.emptyBucket(name);
    if (emptyErr) throw emptyErr;
    const { error } = await db.storage.deleteBucket(name);
    if (error) throw error;
    await db.from('storage_usage_stats').delete().eq('provider', 'supabase').eq('bucket', name);
    return json({ success: true });
  }

  if (action === 'sa-create-folder') {
    const bucket = String(body.bucket || '');
    const rawName = String(body.name || '').trim().replace(/^\/+|\/+$/g, '');
    const parent = String(body.prefix || '').replace(/\/+$/, '');
    if (!bucket || !rawName) return json({ success: false, error: 'bucket and name required' }, 400);
    if (/[\\]/.test(rawName)) return json({ success: false, error: 'Invalid folder name' }, 400);
    const path = `${parent ? parent + '/' : ''}${rawName}/.keep`;
    const { error } = await db.storage
      .from(bucket)
      .upload(path, new Uint8Array(0), { contentType: 'text/plain', upsert: true });
    if (error) throw error;
    return json({ success: true, path });
  }

  if (action === 'sa-folder-stats') {
    const bucket = String(body.bucket || '');
    if (!bucket) return json({ success: false, error: 'bucket required' }, 400);
    const prefix = String(body.prefix || '');
    const { data, error } = await db.rpc('admin_storage_folder_stats', {
      p_bucket: bucket,
      p_prefix: prefix,
    });
    if (error) throw error;
    return json({
      success: true,
      stats: ((data as any[]) || []).map((r) => ({
        folder: String(r.folder),
        fileCount: Number(r.file_count) || 0,
        totalSize: Number(r.total_size) || 0,
        latestAt: r.latest_at ?? null,
      })),
    });
  }

  if (action === 'sa-list-objects') {
    const bucket = String(body.bucket || '');
    if (!bucket) return json({ success: false, error: 'bucket required' }, 400);
    const prefix = String(body.prefix || '');
    const limit = Math.min(Number(body.limit) || 100, 200);
    const offset = Number(body.offset) || 0;
    const search = String(body.search || '');
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit,
      offset,
      search: search || undefined,
      // Newest upload first so the owner sees recent files on top.
      sortBy: { column: 'updated_at', order: 'desc' },
    });
    if (error) throw error;
    const folders: any[] = [];
    const files: any[] = [];
    for (const item of data || []) {
      const path = prefix ? `${prefix.replace(/\/+$/, '')}/${item.name}` : item.name;
      if (!(item as any).id) {
        folders.push({ name: item.name, prefix: path });
        continue;
      }
      const { data: pub } = db.storage.from(bucket).getPublicUrl(path);
      files.push({
        name: item.name,
        path,
        size: (item as any).metadata?.size ?? null,
        contentType: (item as any).metadata?.mimetype ?? null,
        updatedAt: (item as any).updated_at ?? (item as any).created_at ?? null,
        publicUrl: pub?.publicUrl ?? null,
      });
    }
    return json({ success: true, folders, files, hasMore: (data || []).length === limit });
  }

  if (action === 'sa-signed-url') {
    const bucket = String(body.bucket || '');
    const path = String(body.path || '');
    if (!bucket || !path) return json({ success: false, error: 'bucket and path required' }, 400);
    const opts = body.download ? { download: path.split('/').pop() || true } : undefined;
    const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600, opts as any);
    if (error) throw error;
    return json({ success: true, url: data?.signedUrl });
  }

  if (action === 'sa-delete') {
    const bucket = String(body.bucket || '');
    const paths: string[] = Array.isArray(body.paths) ? body.paths.map(String) : [];
    if (!bucket || paths.length === 0) return json({ success: false, error: 'bucket and paths required' }, 400);
    const { data, error } = await db.storage.from(bucket).remove(paths);
    if (error) throw error;
    await applyStats('supabase', bucket, (data || []).filter((o: any) => !String(o.name).endsWith('.keep')).map((o: any) => ({ path: String(o.name), count: -1, size: -(Number(o.metadata?.size) || 0) })));
    return json({ success: true, deleted: data?.length || 0 });
  }

  if (action === 'sa-delete-folder') {
    const bucket = String(body.bucket || '');
    const prefix = String(body.prefix || '');
    if (!bucket || !prefix) return json({ success: false, error: 'bucket and prefix required' }, 400);
    let deleted = 0;
    const walk = async (dir: string) => {
      const { data, error } = await db.storage.from(bucket).list(dir, { limit: 1000 });
      if (error) throw error;
      const filePaths: string[] = [];
      const items: StatItem[] = [];
      for (const item of data || []) {
        const path = `${dir}/${item.name}`.replace(/\/+/g, '/');
        if ((item as any).id) {
          filePaths.push(path);
          if (item.name !== '.keep') items.push({ path, count: -1, size: -(Number((item as any).metadata?.size) || 0) });
        } else await walk(path);
      }
      if (filePaths.length) {
        const { error: delErr } = await db.storage.from(bucket).remove(filePaths);
        if (delErr) throw delErr;
        deleted += filePaths.length;
        await applyStats('supabase', bucket, items);
      }
      // A folder with more than 1,000 entries is listed again until empty.
      if ((data || []).length === 1000) await walk(dir);
    };
    await walk(prefix.replace(/\/+$/, ''));
    return json({ success: true, deleted });
  }

  if (action === 'sa-upload-url') {
    // Browser uploads straight to Supabase Storage (any size the bucket/project allows); Supabase enforces the bucket limit.
    const bucket = String(body.bucket || '');
    const path = String(body.path || '').replace(/^\/+/, '');
    if (!bucket || !path || path.split('/').some((p) => p === '..' || p === '.')) return json({ success: false, error: 'bucket and valid path required' }, 400);
    const size = Number(body.size) || 0;
    const { data: info } = await db.storage.getBucket(bucket);
    const limit = Number((info as any)?.file_size_limit) || 0;
    if (limit && size > limit) return json({ success: false, error: `File is larger than this bucket's ${Math.round(limit / 1048576)} MB limit` }, 413);
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    const { data: existing } = await db.storage.from(bucket).list(dir, { search: name, limit: 10 });
    const prev = (existing || []).find((f: any) => f.name === name && f.id);
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path, { upsert: true } as any);
    if (error) throw error;
    return json({ success: true, path, token: data?.token, previousSize: prev ? Number((prev as any).metadata?.size) || 0 : null });
  }

  if (action === 'sa-upload-done') {
    const bucket = String(body.bucket || '');
    const path = String(body.path || '');
    if (!bucket || !path) return json({ success: false, error: 'bucket and path required' }, 400);
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    const { data: found } = await db.storage.from(bucket).list(dir, { search: name, limit: 10 });
    const file = (found || []).find((f: any) => f.name === name && f.id);
    if (!file) return json({ success: false, error: 'Upload not found' }, 404);
    const size = Number((file as any).metadata?.size) || 0;
    const previous = body.previousSize === null || body.previousSize === undefined ? null : Number(body.previousSize) || 0;
    await applyStats('supabase', bucket, [{ path, count: previous === null ? 1 : 0, size: size - (previous ?? 0) }]);
    return json({ success: true, size });
  }

  if (action === 'sa-upload') {
    const bucket = String(body.bucket || '');
    const path = String(body.path || '');
    const dataBase64 = String(body.dataBase64 || '');
    if (!bucket || !path || !dataBase64) return json({ success: false, error: 'bucket, path and dataBase64 required' }, 400);
    const bin = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
    const { error } = await db.storage.from(bucket).upload(path, bin, {
      contentType: String(body.contentType || 'application/octet-stream'),
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw error;
    const { data: pub } = db.storage.from(bucket).getPublicUrl(path);
    return json({ success: true, path, publicUrl: pub?.publicUrl ?? null });
  }

  return json({ success: false, error: `Unknown action: ${action}` }, 400);
}

// ===================== Automatic orphan cleanup =====================
// Finds storage files that are not referenced anywhere in the database
// (or hardcoded in the app) and removes them. Runs daily via cron.

const ORPHAN_SCAN_BUCKETS = [
  'profile-photos',
  'brand-assets',
  'public-assets',
  'company-logos',
  'job-images',
  'notification-cards',
  'ai-engagement-images',
  'temp-downloads',
];

// Files referenced only from code / e-mail HTML (never from a DB row) must never be auto-removed.
const ORPHAN_PROTECTED = [
  'workly-email-mascot',
  'notifications/',
  'email/resume-templates/',
  'email/cover-templates/',
  'brand-assets/',
  'hero-banners/',
  'site/',
];

const ORPHAN_MIN_AGE_HOURS: Record<string, number> = {
  'temp-downloads': 24,
};
const ORPHAN_DEFAULT_MIN_AGE_HOURS = 72;

const ORPHAN_REF_SOURCES: Array<{ table: string; columns: string[] }> = [
  { table: 'profiles', columns: ['profile_image_url'] },
  // Developer and referral profiles keep their own photos; without these the
  // daily sweep deleted them after 72h and the profile fell back to a letter.
  { table: 'developer_profiles', columns: ['avatar_url'] },
  { table: 'developer_partner_profiles', columns: ['avatar_url'] },
  { table: 'referral_profiles', columns: ['photo_url'] },
  { table: 'companies', columns: ['logo_url'] },
  { table: 'job_images', columns: ['image_url'] },
  { table: 'blog_posts', columns: ['image_url'] },
  { table: 'donation_campaigns', columns: ['image_url'] },
  { table: 'hero_banners', columns: ['image_url'] },
  { table: 'home_trust_badges', columns: ['image_url'] },
  { table: 'platform_settings', columns: ['logo_url', 'logo_dark_url', 'favicon_url', 'og_image_url'] },
  { table: 'app_settings', columns: ['setting_value'] },
  { table: 'push_lifecycle_templates', columns: ['image_url', 'icon_url'] },
  { table: 'email_lifecycle_templates', columns: ['image_url'] },
  { table: 'telegram_lifecycle_templates', columns: ['image_url'] },
  { table: 'onesignal_automation_rules', columns: ['image_url', 'icon_url'] },
  { table: 'proactive_engagement_schedule', columns: ['image_url'] },
  { table: 'ai_generated_images', columns: ['public_url'] },
  { table: 'cached_audio', columns: ['audio_url'] },
  { table: 'job_applications', columns: ['resume_url'] },
  { table: 'user_scheduled_notifications', columns: ['attachment_url'] },
  { table: 'onesignal_message_queue', columns: ['url'] },
];

async function collectStorageReferences(db: any): Promise<string> {
  const parts: string[] = [];
  for (const src of ORPHAN_REF_SOURCES) {
    try {
      const { data, error } = await db.from(src.table).select(src.columns.join(',')).limit(100000);
      if (error) {
        console.warn(`[orphan] skip ${src.table}: ${error.message}`);
        continue;
      }
      for (const row of data || []) {
        for (const col of src.columns) {
          const v = (row as any)[col];
          if (typeof v === 'string' && v.length > 3) parts.push(v);
        }
      }
    } catch (e: any) {
      console.warn(`[orphan] error ${src.table}: ${e?.message}`);
    }
  }
  return parts.join('\n');
}

async function listAllObjects(db: any, bucket: string, prefix = ''): Promise<Array<{ path: string; created: string }>> {
  const out: Array<{ path: string; created: string }> = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      console.warn(`[orphan] list ${bucket}/${prefix}: ${error.message}`);
      break;
    }
    const items = data || [];
    for (const item of items) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (!(item as any).id) {
        out.push(...(await listAllObjects(db, bucket, full)));
      } else {
        out.push({ path: full, created: (item as any).created_at || (item as any).updated_at || new Date().toISOString() });
      }
    }
    if (items.length < 1000) break;
    offset += items.length;
  }
  return out;
}

async function handleStorageOrphanCleanup(body: any) {
  const db = adminClient();
  const dryRun = body?.dry_run === true;
  const refBlob = await collectStorageReferences(db);
  const report: Record<string, { scanned: number; orphans: number; deleted: number }> = {};
  let totalDeleted = 0;
  const now = Date.now();

  for (const bucket of ORPHAN_SCAN_BUCKETS) {
    const files = await listAllObjects(db, bucket);
    const minAgeMs = (ORPHAN_MIN_AGE_HOURS[bucket] ?? ORPHAN_DEFAULT_MIN_AGE_HOURS) * 3600 * 1000;
    const orphans = files
      .filter((f) => {
        if (ORPHAN_PROTECTED.some((p) => f.path.includes(p))) return false;
        if (now - new Date(f.created).getTime() < minAgeMs) return false;
        const name = f.path.split('/').pop() || f.path;
        return !refBlob.includes(f.path) && !refBlob.includes(name);
      })
      .map((f) => f.path);

    report[bucket] = { scanned: files.length, orphans: orphans.length, deleted: 0 };

    if (!dryRun && orphans.length) {
      for (let i = 0; i < orphans.length; i += 100) {
        const chunk = orphans.slice(i, i + 100);
        const { error } = await db.storage.from(bucket).remove(chunk);
        if (error) {
          console.warn(`[orphan] delete ${bucket}: ${error.message}`);
        } else {
          report[bucket].deleted += chunk.length;
          totalDeleted += chunk.length;
        }
      }
    }
    console.log(`[orphan] ${bucket}: scanned ${files.length}, orphans ${orphans.length}`);
  }

  return json({ success: true, dry_run: dryRun, total_deleted: totalDeleted, report });
}

// ===================== Login page images (dedicated R2 bucket) =====================
async function runLoginImages(body: unknown): Promise<Response> {
  const admin = adminClient();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let r2: Awaited<ReturnType<typeof r2Client>> | null = null;
  const getR2 = async () => (r2 ??= await r2Client(LOGIN_BUCKET));
  const objectUrl = (c: { accountId: string; bucket: string }, key: string) => `https://${c.accountId}.r2.cloudflarestorage.com/${c.bucket}/${key}`;
  const result = await handleLoginImages(body, {
    prepare: async () => {
      const accountId = await getOwnerSecret('R2_ACCOUNT_ID');
      const token = await getOwnerSecret('R2_API_TOKEN');
      if (!accountId || !token) throw new Error('Save R2_ACCOUNT_ID and R2_API_TOKEN on Owner Secrets');
      const api = r2Management(accountId, token);
      try { await api(`/${LOGIN_BUCKET}`); } catch { await api('', 'POST', { name: LOGIN_BUCKET }); }
      const domain = await api(`/${LOGIN_BUCKET}/domains/managed`);
      if (!domain.enabled) await api(`/${LOGIN_BUCKET}/domains/managed`, 'PUT', { enabled: true });
      r2 = null;
    },
    read: async (key) => {
      const { data } = await admin.from('app_settings').select('setting_value').eq('setting_key', key).maybeSingle();
      return data?.setting_value ?? null;
    },
    save: async (key, url) => {
      const { error } = await admin.from('app_settings').upsert({ setting_key: key, setting_value: url, description: key }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    upload: async (image, key) => {
      const c = await getR2();
      if (!c.publicUrl) throw new Error('Login image bucket has no public URL yet');
      const res = await c.client.fetch(new Request(objectUrl(c, key), { method: 'PUT', body: new Blob([new Uint8Array(image.bytes)], { type: image.contentType }), headers: { 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } }));
      if (!res.ok) throw new Error(`R2 upload failed [${res.status}]`);
      return `${c.publicUrl}/${key}`;
    },
    cleanup: async (url) => {
      if (!url) return;
      const legacy = legacyLoginPath(url, supabaseUrl);
      if (legacy) { const { error } = await admin.storage.from('brand-assets').remove([legacy]); if (error) throw error; return; }
      const c = await getR2();
      const clean = url.split('?')[0];
      if (!c.publicUrl || !clean.startsWith(`${c.publicUrl}/login-images/`)) return;
      const key = clean.slice(c.publicUrl.length + 1);
      const res = await c.client.fetch(new Request(objectUrl(c, key), { method: 'DELETE' }));
      if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed [${res.status}]`);
    },
    downloadLegacy: async (url) => {
      if (!legacyLoginPath(url, supabaseUrl)) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = (res.headers.get('content-type') || 'image/png').split(';')[0];
      const ext: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' };
      if (!ext[contentType]) return null;
      return { bytes: new Uint8Array(await res.arrayBuffer()), contentType, extension: ext[contentType] };
    },
  });
  return json(result);
}

// ===================== Router =====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    // Parse body only for POST; if `action` present, route to media-cdn.
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === 'object' && body.action === 'compress-storage') {
        // Owner/admin only (or service role key).
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const auth = req.headers.get('authorization') ?? '';
        let allowed = !!serviceKey && auth.includes(serviceKey);
        if (!allowed && auth) {
          const asUser = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
          );
          const { data: userData } = await asUser.auth.getUser();
          const uid = userData?.user?.id;
          if (uid) {
            const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, { auth: { persistSession: false } });
            const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', uid);
            allowed = (roles || []).some((r: any) => ['owner', 'admin'].includes(String(r.role)));
          }
        }
        if (!allowed) {
          const cronSecret = req.headers.get('x-cron-secret') ?? '';
          if (cronSecret) {
            const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, { auth: { persistSession: false } });
            const { data: tokenRow } = await admin.from('domain_cron_auth').select('token').limit(1).maybeSingle();
            allowed = !!tokenRow?.token && tokenRow.token === cronSecret;
          }
        }
        if (!allowed) return json({ success: false, error: 'Unauthorized' }, 401);
        return await handleCompressStorage(body);
      }
      if (body && typeof body === 'object' && body.action === 'storage-orphan-cleanup') {
        // Destructive — service role key, internal cron token, or owner/admin.
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const auth = req.headers.get('authorization') ?? '';
        const apikey = req.headers.get('apikey') ?? '';
        const cronSecret = req.headers.get('x-cron-secret') ?? '';
        let allowed = !!serviceKey && (auth.includes(serviceKey) || apikey === serviceKey);
        if (!allowed && cronSecret) {
          const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, { auth: { persistSession: false } });
          const { data: tokenRow } = await admin.from('domain_cron_auth').select('token').limit(1).maybeSingle();
          allowed = !!tokenRow?.token && tokenRow.token === cronSecret;
        }
        if (!allowed) allowed = await isOwnerOrAdmin(req);
        if (!allowed) return json({ success: false, error: 'Unauthorized' }, 401);
        return await handleStorageOrphanCleanup(body);
      }
      if (body && typeof body === 'object' && body.action === 'storage-cleanup') {
        // Destructive — service role key or the internal cron token only.
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const auth = req.headers.get('authorization') ?? '';
        const apikey = req.headers.get('apikey') ?? '';
        const cronSecret = req.headers.get('x-cron-secret') ?? '';
        let allowed = !!serviceKey && (auth.includes(serviceKey) || apikey === serviceKey);
        if (!allowed && cronSecret) {
          const admin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceKey,
            { auth: { persistSession: false } },
          );
          const { data: tokenRow } = await admin
            .from('domain_cron_auth')
            .select('token')
            .limit(1)
            .maybeSingle();
          allowed = !!tokenRow?.token && tokenRow.token === cronSecret;
        }
        if (!allowed) {
          return json({ success: false, error: 'Unauthorized' }, 401);
        }
        return await handleStorageCleanup(body);
      }
      if (body && typeof body === 'object' && r2BucketActions.has(String(body.action))) {
        if (!(await isOwnerOrAdmin(req))) return json({ success: false, error: 'Unauthorized' }, 401);
        const accountId = await getOwnerSecret('R2_ACCOUNT_ID');
        const token = await getOwnerSecret('R2_API_TOKEN');
        if (!accountId || !token) return json({ success: false, error: 'Save R2_ACCOUNT_ID and R2_API_TOKEN on Owner Secrets for bucket management' }, 400);
        return await handleR2Buckets(body, r2Management(accountId, token), corsHeaders, r2SavedTotal, r2Limits,
          async (name) => { await adminClient().from('storage_usage_stats').delete().eq('provider', 'r2').eq('bucket', name); });
      }
      if (body && typeof body === 'object' && r2StorageActions.has(String(body.action))) {
        if (!(await isOwnerOrAdmin(req))) return json({ success: false, error: 'Unauthorized' }, 401);
        const bucketName = String(body.bucket || '');
        const saved = Number((await r2Limits.read().catch(() => ({} as Record<string, number>)))[bucketName]) || 0;
        if (body.action === 'r2-sa-upload-init') await ensureR2UploadCors(bucketName);
        return await handleR2Storage(body, await r2Client(body.bucket), corsHeaders, { limitBytes: saved > 0 ? Math.min(saved, R2_MAX_FILE_BYTES) : R2_MAX_FILE_BYTES, stats: r2Stats(bucketName) });
      }
      if (body && typeof body === 'object' && STORAGE_ADMIN_ACTIONS.has(String(body.action))) {
        if (!(await isOwnerOrAdmin(req))) return json({ success: false, error: 'Unauthorized' }, 401);
        return await handleStorageAdmin(body);
      }
      if (body && typeof body === 'object' && loginImageActions.has(String(body.action))) {
        if (!(await isOwnerOrAdmin(req))) return json({ success: false, error: 'Unauthorized' }, 401);
        try { return await runLoginImages(body); }
        catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : 'Login image failed' }, (e as any)?.status || 500); }
      }
      if (body && typeof body === 'object' && (['r2-upload-media', 'r2-delete-media'].includes(String(body.action)) || String(body.action).startsWith('r2-media-upload-'))) {
        return await handleR2Media(req, body);
      }
      if (body && typeof body === 'object' && ['r2-upload-banner', 'r2-delete-banner'].includes(String(body.action))) {
        // Banner images go to Cloudflare R2 — owner/admin only.
        if (!(await isOwnerOrAdmin(req))) return json({ success: false, error: 'Unauthorized' }, 401);
        return await handleR2Banner(body);
      }
      if (body && typeof body === 'object' && body.action) {

        return await handleMediaCdn(body);
      }
    }
    return await handleEgressAnalysis();
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    if (status >= 500) console.error('❌ egress-optimizer error:', error);
    else console.warn('⚠️ egress-optimizer client error:', error?.message);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: error?.code,
      providerResponse: error?.providerResponse,
      fallback: true,
    }, status);
  }
});
