/**
 * Robust file download for AI chat attachments (PDF / image / doc).
 *
 * Signed Supabase Storage URLs already carry `Content-Disposition: attachment`,
 * so a plain navigation downloads the file correctly. The blob path is only an
 * optimisation (keeps the exact filename); when it fails — CORS, service worker,
 * mobile browser quirks, flaky network — we must FALL BACK instead of showing
 * an error, otherwise the user sees "Download nahi ho paya" for a perfectly
 * valid link.
 */

const clickAnchor = (href: string, fileName?: string, newTab = false) => {
  const a = document.createElement('a');
  a.href = href;
  if (fileName) a.download = fileName;
  if (newTab) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/** Adds a cache-buster so a stale service-worker/browser cache entry is skipped. */
const bust = (url: string) => {
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set('_t', String(Date.now()));
    return u.toString();
  } catch {
    return url;
  }
};

export async function forceDownloadFile(url: string, fileName: string): Promise<boolean> {
  // 1) Try fetching the real bytes (best UX: correct filename, no navigation).
  for (const target of [url, bust(url)]) {
    try {
      const res = await fetch(target, { cache: 'no-store', credentials: 'omit', mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size < 64) continue;
      // A tiny HTML body means an offline/error page, not the real file.
      const isHtml = /text\/html|application\/xhtml/i.test(blob.type);
      if (isHtml && !/\.(html?|txt|csv|md)$/i.test(fileName)) continue;
      const blobUrl = URL.createObjectURL(blob);
      clickAnchor(blobUrl, fileName);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return true;
    } catch {
      /* try next strategy */
    }
  }

  // 2) Direct navigation — the signed URL's Content-Disposition forces a save
  //    even when fetch/CORS is blocked. This is what rescues mobile Chrome.
  try {
    clickAnchor(url, fileName, true);
    return true;
  } catch {
    /* fall through */
  }

  // 3) Last resort: open the URL.
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    return false;
  }
}
