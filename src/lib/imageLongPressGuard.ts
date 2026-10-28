/**
 * Global image long-press guard.
 *
 * On mobile browsers, press-and-hold on an image opens the native
 * "Download image" sheet. On the home banner that sheet cancels the
 * touch, so Embla never sees the swipe. This guard suppresses the
 * native context menu (download sheet) and native image dragging for
 * every <img>, so a held press flows into the carousel as a drag.
 *
 * Scope: <img> elements only — right-click menus on text, links and
 * the rest of the page keep working.
 */

export function installImageLongPressGuard(): void {
  if (typeof window === "undefined") return;

  // Chrome/Android: long-press download sheet is the native context menu.
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    },
    true,
  );

  // Desktop drag of an image can start a browser download/drop flow.
  document.addEventListener(
    "dragstart",
    (e) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    },
    true,
  );
}
