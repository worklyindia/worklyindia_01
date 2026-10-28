/** Email clients must never depend on a preview website to load artwork. */
export function emailImageSource(value: string, assetOrigin: string): string | null {
  try {
    const url = new URL(value, assetOrigin);
    if (url.protocol !== 'https:') return null;
    if (url.pathname.startsWith('/__l5e/assets-v1/')) {
      if (!url.hostname.endsWith('.lovable.app')) return null;
      return url.href;
    }
    // Owner-uploaded original-quality R2 images already have a stable public URL.
    // They are returned unchanged below, never fetched or copied to Supabase.
    if (url.hostname.endsWith('.r2.dev') && /^\/media\/(brand|template-email)\/[0-9a-f-]{36}\/[a-zA-Z0-9-]+\.[a-z0-9]{2,5}$/.test(url.pathname)) return url.href;
    // Only project storage images are fetched server-side, not arbitrary URLs.
    if (url.hostname === 'jubwzelupbntbetpajqb.supabase.co' && url.pathname.startsWith('/storage/v1/object/public/')) return url.href;
    return null;
  } catch { return null; }
}

/** Copy preview images once into public storage, retaining owner artwork. */
export async function publicEmailImage(sb: {
  storage: { from: (bucket: string) => {
    upload: (path: string, body: Uint8Array, options: { contentType: string; cacheControl: string; upsert: boolean }) => Promise<{ error: unknown }>;
    getPublicUrl: (path: string) => { data: { publicUrl: string } };
  } };
}, value: string, fallback: string, assetOrigin: string): Promise<string> {
  const source = emailImageSource(value || fallback, assetOrigin);
  if (!source) return fallback;
  const url = new URL(source);
  if (!url.pathname.startsWith('/__l5e/assets-v1/')) return source;
  const match = url.pathname.match(/^\/__l5e\/assets-v1\/([a-f0-9-]{36})\/([^/]+)$/i);
  if (!match) return fallback;
  const path = `email-public/${match[1]}/${match[2]}`;
  const bucket = sb.storage.from('brand-assets');
  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  try {
    const existing = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    if (existing.ok && existing.headers.get('content-type')?.startsWith('image/')) return publicUrl;
    const image = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(6000) });
    const contentType = image.headers.get('content-type') || '';
    if (!image.ok || !/^image\/(png|jpeg|webp|gif)(;|$)/i.test(contentType)) return fallback;
    const body = new Uint8Array(await image.arrayBuffer());
    if (body.byteLength > 5 * 1024 * 1024) return fallback;
    const { error } = await bucket.upload(path, body, { contentType, cacheControl: '31536000', upsert: false });
    if (!error) return publicUrl;
    // Another concurrent email may already have created this immutable copy.
    const concurrent = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return concurrent.ok ? publicUrl : fallback;
  } catch { return fallback; }
}