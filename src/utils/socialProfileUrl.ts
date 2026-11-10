/**
 * Helpers to build *valid* public profile URLs from OAuth identity data.
 *
 * Providers are inconsistent: GitLab may put the person's full name in
 * `user_name`, LinkedIn only exposes an opaque `sub` id, and some providers
 * send nothing usable at all. Saving those raw values produced broken profile
 * links (e.g. https://gitlab.com/Vishal Gohil), so every value is validated
 * before a URL is built — if we can't build a real link, we save nothing.
 */

const HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9-_.]{0,38}$/;

/** Returns a clean username, or null when the value can't be a handle. */
export const sanitizeHandle = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (!v) return null;
  if (v.includes('@') || /\s/.test(v)) return null; // emails / full names
  v = v.replace(/^\/+|\/+$/g, '');
  if (v.includes('/')) return null;
  if (!HANDLE_RE.test(v)) return null;
  return v;
};

/**
 * Validates an absolute profile URL for a given host (and its subdomains).
 * Requires a non-empty path so bare "https://github.com" is rejected.
 */
export const sanitizeProfileUrl = (value: unknown, host: string): string | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const h = url.hostname.toLowerCase().replace(/^www\./, '');
    if (h !== host && !h.endsWith(`.${host}`)) return null;
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return null;
    return `https://${url.hostname.replace(/^www\./, '')}/${path}`;
  } catch {
    return null;
  }
};

const firstHandle = (d: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const h = sanitizeHandle(d[k]);
    if (h) return h;
  }
  return null;
};

export const buildGithubUrl = (d: Record<string, unknown> = {}): string | null => {
  const url = sanitizeProfileUrl(d.html_url ?? d.profile_url ?? d.url, 'github.com');
  if (url) return url;
  const handle = firstHandle(d, ['user_name', 'preferred_username', 'nickname', 'login']);
  return handle ? `https://github.com/${handle}` : null;
};

export const buildGitlabUrl = (d: Record<string, unknown> = {}): string | null => {
  const url = sanitizeProfileUrl(d.web_url ?? d.profile_url ?? d.profile, 'gitlab.com');
  if (url) return url;
  // GitLab often puts the display name in `user_name`, so prefer nickname first.
  const handle = firstHandle(d, ['nickname', 'preferred_username', 'username', 'user_name']);
  return handle ? `https://gitlab.com/${handle}` : null;
};

export const buildLinkedInUrl = (d: Record<string, unknown> = {}): string | null => {
  const url = sanitizeProfileUrl(d.profile_url ?? d.publicProfileUrl ?? d.url, 'linkedin.com');
  if (url) return url;
  const vanity = sanitizeHandle(d.vanity_name);
  return vanity ? `https://www.linkedin.com/in/${vanity}` : null;
};

/** True when an already-stored link points at a usable profile page. */
export const isValidPlatformLink = (value: unknown, host: string): boolean =>
  sanitizeProfileUrl(value, host) !== null;
