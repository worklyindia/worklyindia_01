import { z } from 'npm:zod@3';
import { decodeBannerImage } from './bannerImage.ts';

export const LOGIN_BUCKET = 'workly-login-images';
export const loginImageActions = new Set(['r2-save-login-image', 'r2-remove-login-image', 'r2-migrate-login-images']);
export const loginKeys = ['job_seeker_login_avatar', 'employer_login_avatar', 'home_hero_image', 'home_seekers_image'] as const;
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('r2-save-login-image'), settingKey: z.enum(loginKeys), file: z.string().max(14 * 1024 * 1024) }),
  z.object({ action: z.literal('r2-remove-login-image'), settingKey: z.enum(loginKeys) }),
  z.object({ action: z.literal('r2-migrate-login-images') }),
]);
type ImageBytes = { bytes: Uint8Array; contentType: string; extension: string };
export interface LoginImageDeps {
  prepare: () => Promise<void>;
  read: (key: string) => Promise<string | null>;
  save: (key: string, url: string | null, previous: string | null) => Promise<void>;
  upload: (image: ImageBytes, key: string) => Promise<string>;
  cleanup: (url: string | null) => Promise<void>;
  downloadLegacy: (url: string) => Promise<ImageBytes | null>;
}
export async function handleLoginImages(input: unknown, deps: LoginImageDeps) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw Object.assign(new Error('Invalid login image request'), { status: 400 });
  const body = parsed.data;
  const warnings: string[] = [];
  let changed = 0;
  // Only prepare a public bucket for upload/migration, never for removal.
  let prepared = false;
  for (const settingKey of body.action === 'r2-migrate-login-images' ? loginKeys : [body.settingKey]) {
    const previous = await deps.read(settingKey);
    let image: ImageBytes | null = null;
    if (body.action === 'r2-migrate-login-images') {
      if (!previous) continue;
      image = await deps.downloadLegacy(previous);
      if (!image) continue;
    } else if (body.action === 'r2-save-login-image') {
      image = decodeBannerImage(body.file);
    }
    let url: string | null = null;
    if (image) {
      if (!prepared) { await deps.prepare(); prepared = true; }
      url = await deps.upload(image, `login-images/${settingKey}-${crypto.randomUUID()}.${image.extension}`);
    }
    try { await deps.save(settingKey, url, previous); }
    catch (error) { if (url) await deps.cleanup(url).catch(() => {}); throw error; }
    changed++;
    // Never delete the old file until the replacement is verified and committed.
    try { await deps.cleanup(previous); }
    catch { warnings.push(`${settingKey}: image saved; previous file cleanup needs retry`); }
  }
  return { ok: true, changed, warnings };
}

export function legacyLoginPath(value: string, supabaseUrl: string) {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/brand-assets\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    if (!/^(?:brand-assets\/)?auth-avatars\//.test(path) || path.split('/').some(p => p === '..' || p === '.')) return null;
    return path;
  } catch { return null; }
}