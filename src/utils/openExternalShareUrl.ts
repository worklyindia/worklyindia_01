/**
 * Opens a real platform share flow from the website and Android WebView.
 * Explicit "Copy link" controls should use the Clipboard API directly; this
 * helper is intentionally share-only and never copies content.
 */
export function openExternalShareUrl(url: string): boolean {
  if (!url || typeof window === "undefined") return false;

  const bridge = (window as Window & {
    WorklyAndroid?: {
      openExternalUrl?: (value: string) => boolean;
      shareText?: (title: string, text: string, url: string) => boolean;
    };
  }).WorklyAndroid;

  let title = "Share Workly India";
  let message = "";
  let sharedLink = "";

  try {
    const shareUrl = new URL(url, window.location.origin);
    const params = shareUrl.searchParams;
    sharedLink = params.get("url") || params.get("u") || "";
    message = params.get("text") || params.get("quote") || "";
    if (!message && !sharedLink) message = url;
    if (shareUrl.hostname.includes("whatsapp")) title = "Share with";
    else if (shareUrl.hostname.includes("facebook")) title = "Share on Facebook";
    else if (shareUrl.hostname.includes("twitter") || shareUrl.hostname.includes("x.com")) title = "Share on X";
    else if (shareUrl.hostname.includes("linkedin")) title = "Share on LinkedIn";
  } catch {
    message = url;
  }

  // Native app: always use Android's chooser instead of opening a web URL
  // inside WebView (which can look like a copy/share failure).
  if (bridge?.shareText) {
    try {
      if (bridge.shareText(title, message || sharedLink || url, sharedLink)) return true;
    } catch {
      // Continue to browser share fallback.
    }
  }

  // Mobile browsers expose the operating system's native share sheet.
  // Do not fall back to clipboard if the user cancels or sharing is unavailable.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const sharePayload: ShareData = {
      title,
      ...(message ? { text: message } : {}),
      ...(sharedLink ? { url: sharedLink } : {}),
    };
    try {
      void navigator.share(sharePayload).catch((error: unknown) => {
        if ((error as DOMException)?.name !== "AbortError") {
          openShareDestination(url, bridge);
        }
      });
      return true;
    } catch {
      // Fall through to the platform destination.
    }
  }

  return openShareDestination(url, bridge);
}

function openShareDestination(
  url: string,
  bridge?: {
    openExternalUrl?: (value: string) => boolean;
  }
): boolean {
  if (bridge?.openExternalUrl) {
    try {
      if (bridge.openExternalUrl(url)) return true;
    } catch {
      // Continue with browser navigation.
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
    const bridge = (window as Window & {
      WorklyAndroid?: { shareText?: (title: string, text: string, url: string) => boolean };
    }).WorklyAndroid;
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
