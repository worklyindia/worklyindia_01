/**
 * Opens a platform share URL from both the website and the Android WebView.
 * Android WebView does not reliably support window.open without a popup window
 * transport, so use the native bridge when the app shell is present.
 */
export function openExternalShareUrl(url: string): boolean {
  if (!url || typeof window === "undefined") return false;

  const bridge = (window as Window & {
    WorklyAndroid?: {
      openExternalUrl?: (value: string) => boolean;
      shareText?: (title: string, text: string, url: string) => boolean;
    };
  }).WorklyAndroid;

  // In the Android app, use the real Android Sharesheet instead of opening
  // a web share URL in Chrome or silently falling back to clipboard.
  if (bridge?.shareText) {
    try {
      const shareUrl = new URL(url, window.location.origin);
      const params = shareUrl.searchParams;
      const sharedLink = params.get("url") || params.get("u") || "";
      const message =
        params.get("text") ||
        params.get("quote") ||
        params.get("title") ||
        (sharedLink ? sharedLink : url);
      const title = shareUrl.hostname.includes("whatsapp")
        ? "Share with"
        : "Share Workly India";
      if (bridge.shareText(title, message, sharedLink)) return true;
    } catch {
      // Fall through to the external URL handler.
    }
  }

  if (bridge?.openExternalUrl) {
    try {
      if (bridge.openExternalUrl(url)) return true;
    } catch {
      // Continue with the browser fallback.
    }
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return true;
  window.location.assign(url);
  return true;
}

/** Opens the Android system share sheet when running inside Workly India. */
export async function shareText(title: string, text: string, url = ""): Promise<boolean> {
  if (typeof window !== "undefined") {
    const bridge = (window as Window & { WorklyAndroid?: { shareText?: (title: string, text: string, url: string) => boolean } }).WorklyAndroid;
    if (bridge?.shareText) {
      try {
        return bridge.shareText(title, text, url);
      } catch {
        // Continue with the browser API fallback.
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title, text, ...(url ? { url } : {}) });
        return true;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return false;
      }
    }
  }
  return false;
}
