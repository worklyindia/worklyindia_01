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
