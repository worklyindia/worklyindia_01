/**
 * Normalize image URLs coming from Supabase / app settings / user uploads
 * so they always render correctly on production (Vercel) regardless of how
 * they were saved (with or without protocol, with stray whitespace, or as
 * a bare storage path).
 */
const SUPABASE_PUBLIC_BASE =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://jubwzelupbntbetpajqb.supabase.co";

export function normalizeImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;

  // Protocol-relative URLs
  if (u.startsWith("//")) return `https:${u}`;

  // Absolute http(s) URL — force https for mixed-content safety
  if (/^https?:\/\//i.test(u)) {
    let normalized = u.replace(/^http:\/\//i, "https://");
    // Rewrite legacy/cross-project Supabase storage hosts to the current
    // project so photos uploaded before a remix still render.
    try {
      const parsed = new URL(normalized);
      const currentHost = new URL(SUPABASE_PUBLIC_BASE).host;
      if (
        /\.supabase\.co$/i.test(parsed.host) &&
        parsed.host !== currentHost &&
        parsed.pathname.startsWith("/storage/v1/")
      ) {
        parsed.host = currentHost;
        normalized = parsed.toString();
      }
    } catch {
      /* not a parseable URL — leave as-is */
    }
    return normalized;
  }


  // Bare Supabase storage path
  if (u.startsWith("/storage/v1/")) {
    return `${SUPABASE_PUBLIC_BASE}${u}`;
  }
  if (u.startsWith("storage/v1/")) {
    return `${SUPABASE_PUBLIC_BASE}/${u}`;
  }

  // Local app asset / public folder
  if (u.startsWith("/")) return u;

  // Data / blob URLs
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;

  // Otherwise assume it's a Supabase storage object key
  return `${SUPABASE_PUBLIC_BASE}/storage/v1/object/public/${u}`;
}

/**
 * Route Supabase Storage images through wsrv.nl — a free,
 * Cloudflare-backed image proxy that resizes on the fly and converts
 * to WebP. We use this because Supabase's built-in image transform
 * endpoint is a paid feature (returns 403 on the Free plan), and
 * serving full-size originals was burning ~1 GB/day of cached egress.
 *
 * wsrv.nl has no rate limit, no signup, and caches responses globally
 * so Supabase Storage egress drops to ~one fetch per image per region.
 *
 * Non-Supabase URLs (Cloudinary, ImageKit, asset CDN, data:, blob:,
 * local /assets) are returned unchanged so this is safe to wrap any
 * <img src=...> with.
 */
const WSRV_BASE = "https://wsrv.nl/";

function isSupabaseStorageHttpUrl(u: string): boolean {
  return (
    /^https?:\/\//.test(u) &&
    (u.includes(".supabase.co/storage/") ||
      u.includes(".supabase.in/storage/")) &&
    /\/storage\/v1\/(object|render\/image)\/public\//.test(u)
  );
}

function isOAuthAvatarHost(u: string): boolean {
  try {
    const host = new URL(u).host.toLowerCase();
    return (
      host.endsWith("googleusercontent.com") ||
      host.endsWith("licdn.com") ||
      host.endsWith("linkedin.com")
    );
  } catch {
    return false;
  }
}

export function storageImageUrl(
  url: string | null | undefined,
  width = 400,
  quality = 70,
): string | null {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return null;

  const isSupabase = isSupabaseStorageHttpUrl(normalized);
  const isOAuth = !isSupabase && isOAuthAvatarHost(normalized);

  // Only proxy Supabase Storage or OAuth-provider avatars (Google/LinkedIn).
  // Google/LinkedIn hotlinks frequently 429/403 on Vercel; routing through
  // wsrv.nl strips the Referer and globally caches the result.
  if (!isSupabase && !isOAuth) return normalized;

  // Supabase: downgrade render-endpoint URLs to object URLs so wsrv.nl
  // gets a stable upstream (render endpoint 403s on Free plan).
  const cleaned = isSupabase
    ? normalized.replace(
        "/storage/v1/render/image/public/",
        "/storage/v1/object/public/",
      )
    : normalized;

  const params = new URLSearchParams();
  params.set("url", cleaned);
  if (width) params.set("w", String(Math.round(width)));
  params.set("q", String(Math.max(20, Math.min(100, Math.round(quality)))));
  params.set("output", "webp");
  params.set("dpr", "2");
  return `${WSRV_BASE}?${params.toString()}`;
}

