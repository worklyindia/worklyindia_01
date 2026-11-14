import { useEffect } from "react";

/**
 * Keep Android Chrome / installed-PWA status bar chrome identical to the
 * WhatsApp-style chat header in both light and dark website themes.
 */
export function useChatStatusBarTheme() {
  useEffect(() => {
    const selector = 'meta[name="theme-color"]';
    let meta = document.querySelector<HTMLMetaElement>(selector);
    const original = meta?.content ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    const sync = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;background-color:hsl(var(--whatsapp-panel));";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      if (color && color !== "rgba(0, 0, 0, 0)") meta!.content = color;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      observer.disconnect();
      if (original !== null) meta!.content = original;
      else meta!.remove();
    };
  }, []);
}
