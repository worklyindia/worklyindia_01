/**
 * Supabase Storage image transform helper.
 *
 * Free plan note: Supabase's built-in `/storage/v1/render/image/...`
 * endpoint is a paid feature (returns 403 on Free). We therefore proxy
 * public Storage URLs through wsrv.nl — a free, Cloudflare-backed image
 * resizer that auto-converts to WebP and caches globally. Result:
 * cached egress drops ~10× without any 3rd-party signup or secrets.
 *
 * Non-Supabase URLs (or empty strings) are returned unchanged so wrapping
 * any <img src=...> remains non-breaking.
 *
 * Usage:
 *   <img src={sbImage(user.avatar_url, { width: 128 })} />
 *   <img srcSet={sbSrcSet(banner, [400, 800, 1200])} />
 */

export type SbImageOpts = {
  width?: number;
  height?: number;
  /** 20-100, default 70 — WebP quality */
  quality?: number;
  /** "cover" (default) | "contain" | "fill" */
  resize?: "cover" | "contain" | "fill";
};

const WSRV_BASE = "https://wsrv.nl/";

function isSupabaseStorageUrl(url: string): boolean {
  return (
    (url.includes(".supabase.co/storage/") ||
      url.includes(".supabase.in/storage/")) &&
    /\/storage\/v1\/(object|render\/image)\/public\//.test(url)
  );
}

/**
 * Transform a Supabase Storage public URL into a resized + WebP variant
 * via the wsrv.nl free image proxy.
 */
export function sbImage(
  url: string | null | undefined,
  opts: SbImageOpts = {},
): string {
  if (!url) return "";
  if (!isSupabaseStorageUrl(url)) return url;

  // Make sure we send wsrv.nl a working upstream — the render endpoint
  // 403s on Free plan, so always use the object URL.
  const upstream = url.replace(
    "/storage/v1/render/image/public/",
    "/storage/v1/object/public/",
  );

  const params = new URLSearchParams();
  params.set("url", upstream.split("?")[0]);
  if (opts.width) params.set("w", String(Math.round(opts.width)));
  if (opts.height) params.set("h", String(Math.round(opts.height)));
  params.set("q", String(opts.quality ?? 70));
  params.set("output", "webp");
  params.set("dpr", "2");
  if (opts.resize === "cover" || !opts.resize) {
    params.set("fit", "cover");
  } else if (opts.resize === "contain") {
    params.set("fit", "contain");
  } else if (opts.resize === "fill") {
    params.set("fit", "fill");
  }
  return `${WSRV_BASE}?${params.toString()}`;
}

/** Responsive srcSet for <img srcSet="..."> */
export function sbSrcSet(
  url: string | null | undefined,
  widths: number[] = [320, 640, 960, 1280],
  opts: Omit<SbImageOpts, "width"> = {},
): string {
  if (!url || !isSupabaseStorageUrl(url)) return "";
  return widths
    .map((w) => `${sbImage(url, { ...opts, width: w })} ${w}w`)
    .join(", ");
}

/** Common preset: square avatar */
export const sbAvatar = (url: string | null | undefined, size = 128) =>
  sbImage(url, { width: size, height: size, resize: "cover", quality: 70 });

/** Common preset: card thumbnail */
export const sbThumb = (url: string | null | undefined, width = 400) =>
  sbImage(url, { width, quality: 70 });
