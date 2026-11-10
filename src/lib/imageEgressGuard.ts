/**
 * Global image egress guard.
 *
 * Many <img> tags across the app point straight at full-size Supabase
 * Storage objects (some 5-6 MB) even when they render inside a 40px
 * avatar. Every such view is billed as cached egress.
 *
 * This guard rewrites those <img src> values at runtime to a resized,
 * WebP variant served by wsrv.nl (free Cloudflare-backed proxy that
 * caches globally), so Supabase serves each image roughly once per
 * region instead of once per page view.
 *
 * Safety rules:
 *  - Only public Supabase Storage http(s) URLs are touched. Local
 *    assets, data:, blob:, Cloudinary/ImageKit and every other host are
 *    left exactly as they are.
 *  - If the proxy ever fails, the original Supabase URL is restored
 *    automatically (onerror fallback), so images never break.
 *  - Opt out per element with data-no-img-optimize="true".
 */

const WSRV_BASE = "https://wsrv.nl/";
const ORIGINAL_ATTR = "data-img-origin";
const DONE_ATTR = "data-img-optimized";

function isSupabasePublicStorageUrl(u: string): boolean {
  return (
    /^https?:\/\//i.test(u) &&
    (u.includes(".supabase.co/storage/") || u.includes(".supabase.in/storage/")) &&
    /\/storage\/v1\/(object|render\/image)\/public\//.test(u)
  );
}

function pickWidth(img: HTMLImageElement): number {
  const candidates = [
    img.getAttribute("width") ? Number(img.getAttribute("width")) : 0,
    img.clientWidth,
    img.parentElement?.clientWidth ?? 0,
  ].filter((n) => Number.isFinite(n) && n > 0) as number[];
  const base = candidates.length ? Math.min(...candidates) : 0;
  if (!base) return 640; // unknown layout — still much smaller than original
  // Round up to a cache-friendly bucket, cap for big banners.
  const buckets = [64, 128, 256, 400, 640, 960, 1280];
  const target = Math.min(1280, Math.ceil(base));
  return buckets.find((b) => b >= target) ?? 1280;
}

function proxyUrl(original: string, width: number): string {
  const upstream = original
    .split("?")[0]
    .replace("/storage/v1/render/image/public/", "/storage/v1/object/public/");
  const params = new URLSearchParams();
  params.set("url", upstream);
  params.set("w", String(width));
  params.set("q", "72");
  params.set("output", "webp");
  params.set("dpr", "2");
  return `${WSRV_BASE}?${params.toString()}`;
}

function restoreWsrvOriginal(img: HTMLImageElement): void {
  const src = img.getAttribute("src") || "";
  if (!src) return;

  try {
    const parsed = new URL(src, window.location.href);
    if (parsed.hostname !== "wsrv.nl") return;

    // wsrv.nl wraps the upstream image in its ?url= parameter.
    // Restore it to avoid proxy 404s and third-party payloads.
    const original = parsed.searchParams.get("url");
    if (original && /^https?:\/\//i.test(original)) {
      img.setAttribute("src", original);
    }
  } catch {
    // Leave malformed URLs unchanged; never break an image at runtime.
  }
}

function optimize(img: HTMLImageElement): void {
  restoreWsrvOriginal(img);

  // Avoid downloading large R2 images before they approach the viewport.
  // Preserve eager loading for visible/above-the-fold images to protect LCP.
  const currentSrc = img.getAttribute("src") || "";
  if (/\.r2\.dev\//i.test(currentSrc)) {
    const rect = img.getBoundingClientRect();
    const belowFold = rect.top > Math.max(window.innerHeight * 1.25, 900);
    if (belowFold && !img.hasAttribute("loading")) img.loading = "lazy";
    if (!img.hasAttribute("decoding")) img.decoding = "async";
  }
  if (img.getAttribute(DONE_ATTR) === "true") return;
  if (img.getAttribute("data-no-img-optimize") === "true") return;

  const src = img.getAttribute("src") || "";
  if (!src || src.startsWith(WSRV_BASE)) return;
  if (!isSupabasePublicStorageUrl(src)) return;

  const width = pickWidth(img);
  img.setAttribute(ORIGINAL_ATTR, src);
  img.setAttribute(DONE_ATTR, "true");

  // Restore the untouched Supabase URL if the proxy is unavailable.
  const onError = () => {
    const origin = img.getAttribute(ORIGINAL_ATTR);
    img.removeEventListener("error", onError);
    if (origin && img.src !== origin) img.src = origin;
  };
  img.addEventListener("error", onError);

  // Keep the original public Supabase URL. wsrv.nl intermittently returns
  // 404 for valid storage objects and produces console errors in Lighthouse.
  // Native Supabase render URLs are already resized upstream where available.
  img.removeAttribute(ORIGINAL_ATTR);
  img.removeAttribute(DONE_ATTR);
  img.removeEventListener("error", onError);
  // No proxy rewrite: avoid third-party image failures and preserve reliability.
}

function scan(root: ParentNode): void {
  root.querySelectorAll?.("img").forEach((el) => optimize(el as HTMLImageElement));
}

let installed = false;

export function installImageEgressGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const run = () => scan(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === "attributes" && rec.target instanceof HTMLImageElement) {
        // src changed by React — re-evaluate
        if (rec.target.getAttribute("src") !== rec.target.getAttribute(ORIGINAL_ATTR)) {
          rec.target.removeAttribute(DONE_ATTR);
        }
        optimize(rec.target);
        continue;
      }
      rec.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) optimize(node);
        else if (node instanceof HTMLElement) scan(node);
      });
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}
