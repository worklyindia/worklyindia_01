/**
 * Shared native/browser share and clipboard helpers for Workly India.
 * Android WebView uses the app's native share chooser and clipboard bridge;
 * browsers use Web Share / Clipboard APIs with a legacy copy fallback.
 */
type ShareBridge = {
  openExternalUrl?: (value: string) => boolean;
  shareText?: (title: string, text: string, url: string) => boolean;
  copyText?: (text: string) => boolean;
};

const getBridge = (): ShareBridge | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window as Window & { WorklyAndroid?: ShareBridge }).WorklyAndroid;

const parseShareDestination = (rawUrl: string) => {
  const parsed = new URL(rawUrl, window.location.origin);
  const params = parsed.searchParams;
  const sharedUrl = params.get("url") || params.get("u") || "";
  const message = params.get("text") || params.get("quote") || "";
  let title = "Share Workly India";
  if (parsed.hostname.includes("whatsapp")) title = "Share with";
  else if (parsed.hostname.includes("facebook")) title = "Share on Facebook";
  else if (parsed.hostname.includes("twitter") || parsed.hostname.includes("x.com")) title = "Share on X";
  else if (parsed.hostname.includes("linkedin")) title = "Share on LinkedIn";
  else if (parsed.hostname.includes("telegram")) title = "Share with Telegram";
  return { title, message: message || (!sharedUrl ? rawUrl : ""), url: sharedUrl };
};

/** Opens Android's chooser in Workly app, or the browser's native share UI. */
export async function shareText(title: string, text: string, url = ""): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = getBridge();
  if (bridge?.shareText) {
    try {
      if (bridge.shareText(title, text, url)) return true;
    } catch {
      // Fall through to browser sharing.
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, ...(url ? { url } : {}) });
      return true;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return false;
    }
  }
  return false;
}

/** Copies text reliably in Android WebView and supported browsers. */
export async function copyText(text: string): Promise<boolean> {
  if (!text || typeof window === "undefined") return false;
  const bridge = getBridge();
  if (bridge?.copyText) {
    try {
      if (bridge.copyText(text)) return true;
    } catch {
      // Fall through to browser clipboard.
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API may be unavailable in older WebViews or insecure contexts.
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

/**
 * Opens a known platform share URL. In Workly Android, share the decoded
 * content with Android's chooser rather than trying to load social URLs in
 * the WebView. In browsers, prefer native share, then open the destination.
 */
export function openExternalShareUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof window === "undefined") return false;
  const bridge = getBridge();
  let payload: ReturnType<typeof parseShareDestination>;
  try {
    payload = parseShareDestination(rawUrl);
  } catch {
    payload = { title: "Share Workly India", message: rawUrl, url: "" };
  }

  if (bridge?.shareText) {
    try {
      if (bridge.shareText(payload.title, payload.message, payload.url)) return true;
    } catch {
      // Continue to browser fallback.
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      void navigator.share({
        title: payload.title,
        ...(payload.message ? { text: payload.message } : {}),
        ...(payload.url ? { url: payload.url } : {}),
      }).catch((error: unknown) => {
        if ((error as DOMException)?.name !== "AbortError") openShareDestination(rawUrl, bridge);
      });
      return true;
    } catch {
      // Fall through to the platform destination.
    }
  }
  return openShareDestination(rawUrl, bridge);
}

function openShareDestination(rawUrl: string, bridge?: ShareBridge): boolean {
  if (bridge?.openExternalUrl) {
    try {
      if (bridge.openExternalUrl(rawUrl)) return true;
    } catch {
      // Continue with browser navigation.
    }
  }
  try {
    const opened = window.open(rawUrl, "_blank", "noopener,noreferrer");
    if (opened) return true;
    window.location.assign(rawUrl);
    return true;
  } catch {
    return false;
  }
}
