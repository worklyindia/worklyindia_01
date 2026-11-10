/**
 * Media CDN helper — uploads + URL transformation for Cloudinary, ImageKit
 * and Cloudflare. Use this INSTEAD of Supabase Storage for any user-facing
 * image/video to keep cached egress low.
 *
 * Quick examples:
 *   const { url } = await uploadImage(file, { folder: "company-logos" });
 *   const thumb = cldImage(url, { w: 400, h: 400, c: "fill", q: "auto", f: "auto" });
 *   const og    = cldOgImage("Frontend Developer", "Acme Corp");
 */
import { supabase } from "@/integrations/supabase/client";

type CloudinaryResult = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

type ImageKitResult = {
  url: string;
  fileId: string;
  filePath: string;
  name: string;
  size: number;
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ============================================================
// UPLOAD
// ============================================================

export async function uploadToCloudinary(
  file: File | string,
  opts: { folder?: string; publicId?: string } = {},
): Promise<{ data: CloudinaryResult }> {
  const payload = typeof file === "string" ? file : await fileToDataUrl(file);
  const { data, error } = await supabase.functions.invoke("egress-optimizer", {
    body: {
      action: "upload-cloudinary",
      file: payload,
      folder: opts.folder,
      publicId: opts.publicId,
    },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Cloudinary upload failed");
  return { data: data.data };
}

export async function uploadToImageKit(
  file: File | string,
  opts: { fileName: string; folder?: string },
): Promise<{ data: ImageKitResult }> {
  const payload = typeof file === "string" ? file : await fileToDataUrl(file);
  const { data, error } = await supabase.functions.invoke("egress-optimizer", {
    body: {
      action: "upload-imagekit",
      file: payload,
      fileName: opts.fileName,
      folder: opts.folder,
    },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "ImageKit upload failed");
  return { data: data.data };
}

/**
 * Upload an image/file.
 *
 * Pass `replaceUrl` with the image currently in use — once the new upload
 * succeeds the old stored file is deleted automatically, so replacing an
 * image never leaves an orphan behind in storage.
 */
export async function uploadImage(
  file: File,
  opts: { folder?: string; fileName?: string; replaceUrl?: string | null } = {},
): Promise<{ url: string; provider: "cloudinary" | "imagekit" | "supabase" }> {
  // Use Supabase Storage as the single source of truth — Cloudinary /
  // ImageKit proxying caused profile photos to break on production
  // (Vercel) when CDN env vars were missing. Supabase Storage URLs are
  // public and render reliably everywhere.
  const { url } = await uploadToSupabaseStorage(file, opts);

  if (opts.replaceUrl && opts.replaceUrl.split("?")[0] !== url.split("?")[0]) {
    try {
      const { deleteStorageUrl } = await import("@/utils/storageCleanup");
      await deleteStorageUrl(opts.replaceUrl);
    } catch (e) {
      console.warn("Old file cleanup failed (upload succeeded):", e);
    }
  }

  return { url, provider: "supabase" };
}

// ------------------------------------------------------------
// Supabase Storage fallback — guaranteed to work even when
// Cloudinary / ImageKit secrets are missing or hit quota.
// ------------------------------------------------------------

/** Map an upload `folder` hint to a Supabase Storage bucket. */
function bucketForFolder(folder?: string): string {
  const f = (folder || "").toLowerCase();
  if (f.includes("hero-banner") || f.includes("banner")) {
    return "public-assets";
  }
  if (f.includes("brand-assets")) {
    return "brand-assets";
  }
  if (f.includes("job-images")) {
    return "job-images";
  }
  if (f.includes("whatsapp-media")) {
    return "whatsapp-media";
  }
  if (f.includes("logo") || f.includes("company") || f.includes("brand")) {
    return "brand-assets";
  }
  // default — everything else (profile photos, generic uploads)
  return "profile-photos";
}

function extFromFile(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  const t = file.type.split("/")[1];
  return (t || "bin").toLowerCase();
}

export async function uploadToSupabaseStorage(
  file: File,
  opts: { folder?: string; fileName?: string } = {},
): Promise<{ url: string; path: string; bucket: string }> {
  const bucket = bucketForFolder(opts.folder);
  const userId =
    (await supabase.auth.getUser()).data.user?.id || "anonymous";

  // Compress to WebP before upload so large photos (5MB/10MB) never hit
  // storage raw — this is what keeps cached egress under control forever.
  // Non-images (PDF, SVG, GIF, docs) pass through unchanged; any failure
  // returns the original file, so uploads can never break.
  // WhatsApp (Meta) accepts only JPEG/PNG images — never re-encode to WebP.
  const { compressImageFile } = await import("@/lib/imageCompress");
  const uploadFile = bucket === "whatsapp-media"
    ? file
    : await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.82,
      });

  const ext = extFromFile(uploadFile);
  const base =
    opts.fileName?.replace(/\.[a-z0-9]+$/i, "") ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${base}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, uploadFile, {
      cacheControl: "31536000",
      upsert: true,
      contentType: uploadFile.type || undefined,
    });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pub.publicUrl, path, bucket };
}

// ============================================================
// CLOUDINARY — URL transformations (no edge function call needed)
// ============================================================

const CLD_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  | string
  | undefined;

export type CldTransform = {
  w?: number;            // width
  h?: number;            // height
  c?: "fill" | "fit" | "scale" | "thumb" | "crop" | "pad";
  g?: "face" | "auto" | "center" | "north" | "south";
  q?: "auto" | "auto:low" | "auto:good" | "auto:best" | number;
  f?: "auto" | "webp" | "avif" | "jpg" | "png";
  dpr?: "auto" | number;
  e?: string;            // effect e.g. "blur:300", "grayscale"
  r?: number | "max";    // radius
};

function cldParams(t: CldTransform): string {
  const parts: string[] = [];
  if (t.w) parts.push(`w_${t.w}`);
  if (t.h) parts.push(`h_${t.h}`);
  if (t.c) parts.push(`c_${t.c}`);
  if (t.g) parts.push(`g_${t.g}`);
  if (t.q) parts.push(`q_${t.q}`);
  if (t.f) parts.push(`f_${t.f}`);
  if (t.dpr) parts.push(`dpr_${t.dpr}`);
  if (t.e) parts.push(`e_${t.e}`);
  if (t.r !== undefined) parts.push(`r_${t.r}`);
  return parts.join(",");
}

/**
 * Add transformations to an existing Cloudinary URL.
 *   cldImage(url, { w: 400, q: "auto", f: "auto" })
 */
export function cldImage(url: string, t: CldTransform = {}): string {
  if (!url || !url.includes("/upload/")) return url;
  const params = cldParams({ q: "auto", f: "auto", dpr: "auto", ...t });
  return url.replace("/upload/", `/upload/${params}/`);
}

/** Common preset: avatar / square thumbnail */
export const cldAvatar = (url: string, size = 96) =>
  cldImage(url, { w: size, h: size, c: "fill", g: "face", r: "max" });

/** Common preset: card thumbnail (16:9) */
export const cldCard = (url: string, w = 600) =>
  cldImage(url, { w, h: Math.round(w * 9 / 16), c: "fill" });

/** Responsive srcSet builder for <img srcset>. */
export function cldSrcSet(
  url: string,
  widths: number[] = [320, 640, 960, 1280, 1920],
  t: Omit<CldTransform, "w"> = {},
): string {
  return widths.map((w) => `${cldImage(url, { ...t, w })} ${w}w`).join(", ");
}

/**
 * Cloudinary-hosted Open Graph image (job share card).
 * Uses Cloudinary text overlays so we don't need to render canvas.
 *   cldOgImage("Frontend Developer", "Acme Corp")
 */
export function cldOgImage(
  title: string,
  subtitle?: string,
  baseImagePublicId = "og-base",
): string {
  if (!CLD_CLOUD_NAME) return "";
  const safeTitle = encodeURIComponent(title.slice(0, 80));
  const safeSub = subtitle ? encodeURIComponent(subtitle.slice(0, 60)) : "";
  const titleLayer = `l_text:Arial_64_bold:${safeTitle},co_white,g_north_west,x_60,y_120,w_1080,c_fit`;
  const subLayer = safeSub
    ? `/l_text:Arial_36:${safeSub},co_rgb:cccccc,g_north_west,x_60,y_360`
    : "";
  return `https://res.cloudinary.com/${CLD_CLOUD_NAME}/image/upload/w_1200,h_630,c_fill/${titleLayer}${subLayer}/${baseImagePublicId}.png`;
}

/** Direct video URL with auto quality + format */
export const cldVideo = (url: string, t: { w?: number; h?: number } = {}) =>
  cldImage(url, { q: "auto", f: "auto", ...t });

// ============================================================
// IMAGEKIT — URL transformations
// ============================================================

const IK_ENDPOINT = (import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT ||
  "") as string;

export type IkTransform = {
  w?: number;
  h?: number;
  q?: number;            // 1-100
  f?: "auto" | "webp" | "avif" | "jpg" | "png";
  c?: "maintain_ratio" | "force" | "at_least" | "at_max";
  fo?: "auto" | "face" | "center";
  bl?: number;           // blur 1-100
  r?: number | "max";
};

function ikParams(t: IkTransform): string {
  const parts: string[] = [];
  if (t.w) parts.push(`w-${t.w}`);
  if (t.h) parts.push(`h-${t.h}`);
  if (t.q) parts.push(`q-${t.q}`);
  if (t.f) parts.push(`f-${t.f}`);
  if (t.c) parts.push(`c-${t.c}`);
  if (t.fo) parts.push(`fo-${t.fo}`);
  if (t.bl) parts.push(`bl-${t.bl}`);
  if (t.r !== undefined) parts.push(`r-${t.r}`);
  return parts.join(",");
}

/**
 * Add transformations to an ImageKit URL via ?tr= query string.
 *   ikImage(url, { w: 400, q: 80, f: "auto" })
 */
export function ikImage(url: string, t: IkTransform = {}): string {
  if (!url) return url;
  const tr = ikParams({ q: 80, f: "auto", ...t });
  if (!tr) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=${tr}`;
}

export const ikAvatar = (url: string, size = 96) =>
  ikImage(url, { w: size, h: size, c: "maintain_ratio", fo: "face" });

export const ikCard = (url: string, w = 600) =>
  ikImage(url, { w, h: Math.round(w * 9 / 16), c: "maintain_ratio" });

// ============================================================
// CLOUDFLARE — cache purge + Turnstile (free CAPTCHA) helpers
// ============================================================

/** Purge specific URLs from Cloudflare cache (only if ZONE_ID set). */
export async function purgeCloudflare(urls: string[]) {
  const { data, error } = await supabase.functions.invoke("egress-optimizer", {
    body: { action: "cf-purge", urls },
  });
  if (error) throw error;
  return data;
}

/** Health check — confirms which CDN secrets are configured. */
export async function mediaCdnHealth() {
  const { data, error } = await supabase.functions.invoke("egress-optimizer", {
    body: { action: "health" },
  });
  if (error) throw error;
  return data;
}

/**
 * Universal image helper — picks the right transformer based on host.
 * Use this everywhere instead of raw <img src=...> for stored images.
 *
 * Supabase Storage URLs are returned as-is by default. Set
 * `VITE_PROXY_SUPABASE_VIA_IMAGEKIT=true` (and configure
 * `VITE_IMAGEKIT_URL_ENDPOINT` + whitelist the Supabase origin as a
 * "Web Folder Origin" in ImageKit) to proxy them through ImageKit and
 * shift cached egress off the Supabase free tier.
 */
export function cdnImage(
  url: string | null | undefined,
  opts: { w?: number; h?: number; q?: number } = {},
): string {
  if (!url) return "";
  if (url.includes("res.cloudinary.com")) {
    return cldImage(url, { w: opts.w, h: opts.h, q: opts.q ?? "auto" });
  }
  if (url.includes("ik.imagekit.io")) {
    return ikImage(url, { w: opts.w, h: opts.h, q: opts.q });
  }
  // Opt-in: proxy Supabase Storage via ImageKit. Off by default.
  const PROXY_SB =
    String(import.meta.env.VITE_PROXY_SUPABASE_VIA_IMAGEKIT || "")
      .toLowerCase() === "true";
  if (
    PROXY_SB &&
    IK_ENDPOINT &&
    /^https?:\/\//.test(url) &&
    (url.includes(".supabase.co/storage/") ||
      url.includes(".supabase.in/storage/"))
  ) {
    const tr = ikParams({ q: opts.q ?? 75, f: "auto", w: opts.w, h: opts.h });
    const base = IK_ENDPOINT.replace(/\/$/, "");
    const proxied = `${base}/${encodeURI(url.replace(/^https?:\/\//, ""))}`;
    return tr ? `${proxied}?tr=${tr}` : proxied;
  }
  // Default for Supabase Storage URLs: route through wsrv.nl free image
  // proxy (Cloudflare-backed, auto WebP). Supabase's own render endpoint
  // is a paid feature and 403s on the Free plan, so wsrv.nl is what
  // actually saves cached egress here.
  if (
    /^https?:\/\//.test(url) &&
    (url.includes(".supabase.co/storage/") ||
      url.includes(".supabase.in/storage/")) &&
    /\/storage\/v1\/(object|render\/image)\/public\//.test(url) &&
    (opts.w || opts.h)
  ) {
    const upstream = url
      .replace(
        "/storage/v1/render/image/public/",
        "/storage/v1/object/public/",
      )
      .split("?")[0];
    const params = new URLSearchParams();
    params.set("url", upstream);
    if (opts.w) params.set("w", String(Math.round(opts.w)));
    if (opts.h) params.set("h", String(Math.round(opts.h)));
    params.set("q", String(opts.q ?? 70));
    params.set("output", "webp");
    params.set("dpr", "2");
    return `https://wsrv.nl/?${params.toString()}`;
  }
  return url; // unknown host or no size hint — return as-is
}

/**
 * Responsive srcSet that works for Cloudinary, ImageKit, and auto-proxied
 * Supabase URLs. Pair with a `sizes` attribute on the <img> for max savings.
 */
export function cdnSrcSet(
  url: string | null | undefined,
  widths: number[] = [320, 640, 960, 1280],
  opts: { q?: number } = {},
): string {
  if (!url) return "";
  return widths
    .map((w) => `${cdnImage(url, { w, q: opts.q })} ${w}w`)
    .join(", ");
}
