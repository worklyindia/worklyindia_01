/**
 * Opens a platform share URL from both the website and the Android WebView.
 * Android WebView does not reliably support window.open without a popup window
 * transport, so use the native bridge when the app shell is present.
 */
export function openExternalShareUrl(url: string): boolean {
  if (!url) return false;
  if (typeof window !== "undefined") {
    const bridge = (window as Window & { WorklyAndroid?: { openExternalUrl?: (value: string) => boolean } }).WorklyAndroid;
    if (bridge?.openExternalUrl) {
      try {
        return bridge.openExternalUrl(url);
      } catch {
        // Continue with the browser fallback.
      }
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return true;
    window.location.assign(url);
    return true;
  }
  return false;
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
