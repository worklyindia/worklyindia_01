// Generic original-quality media on Cloudflare R2 (no resize/WebP).
// Keys: media/<scope>/<userId>/<timestamp>-<uuid>.<ext>
export const MEDIA_SCOPES = [
  'brand', 'template-email', 'template-whatsapp', 'template-telegram',
  'chat-email', 'chat-whatsapp', 'chat-instagram', 'chat-facebook', 'jobs',
] as const;
export type MediaScope = typeof MEDIA_SCOPES[number];
export const OWNER_SCOPES = new Set<string>(['brand', 'template-email', 'template-whatsapp', 'template-telegram']);
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm',
  'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/octet-stream': 'bin', 'application/zip': 'zip', 'text/csv': 'csv',
};

export function mediaExtension(contentType: string): string {
  return EXT[contentType.toLowerCase()] || 'bin';
}

export function ownsUploadKey(key: string, scope: string, userId: string): boolean {
  const parsed = parseMediaKey(key);
  return parsed?.scope === scope && parsed.userId === userId;
}

const KEY_RE = /^media\/([a-z-]+)\/([0-9a-f-]{36})\/[a-zA-Z0-9-]+\.[a-z0-9]{2,5}$/;

export function parseMediaKey(key: string): { scope: string; userId: string } | null {
  const m = key.match(KEY_RE);
  if (!m || !(MEDIA_SCOPES as readonly string[]).includes(m[1])) return null;
  return { scope: m[1], userId: m[2] };
}

/** Decode a data URL byte-for-byte; never re-encodes. */
export function decodeMedia(dataUrl: string) {
  const m = dataUrl.match(/^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!m) throw new Error('Invalid file data');
  const contentType = m[1].toLowerCase();
  const extension = EXT[contentType];
  if (!extension) throw new Error('This file type is not supported');
  const bin = atob(m[2]);
  if (!bin.length || bin.length > MAX_MEDIA_BYTES) throw new Error('File must be under 10MB');
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType, extension };
}

export function buildMediaKey(scope: string, userId: string, extension: string) {
  return `media/${scope}/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

/** Owners/admins may delete anything; users only their own keys. */
export function canDeleteMedia(key: string, userId: string, privileged: boolean) {
  const parsed = parseMediaKey(key);
  if (!parsed) return false;
  return privileged || parsed.userId === userId;
}
