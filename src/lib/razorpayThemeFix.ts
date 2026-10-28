/**
 * Razorpay checkout renders inside an iframe that declares a light colour
 * scheme. When our page is in dark mode Chrome paints an opaque white canvas
 * behind that iframe (colour-scheme mismatch), so the area above the payment
 * sheet shows as full white instead of the page behind it.
 *
 * While the checkout is actually on screen we flag the root element, and CSS
 * aligns the root colour scheme with the iframe so no opaque backdrop is
 * painted. The dark theme classes and colours stay untouched.
 */
export function installRazorpayThemeFix() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

  const root = document.documentElement;

  const isOpen = () => {
    // Razorpay preloads a hidden frame on load; only a visible, sized
    // container counts as "checkout open".
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".razorpay-container"));
    return nodes.some((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.offsetWidth > 0 && el.offsetHeight > 0;
    });
  };

  const sync = () => {
    root.classList.toggle("razorpay-open", isOpen());
  };

  const observer = new MutationObserver(sync);
  const start = () => {
    sync();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  };

  // Open pop-ups/full pages trap focus and block taps outside themselves, which
  // froze the Razorpay checkout (it lives outside them). Let focus reach it.
  const inCheckout = (n: EventTarget | null) =>
    n instanceof Element && !!n.closest(".razorpay-container, iframe.razorpay-checkout-frame, .rzp-method-picker");
  window.addEventListener("focusin", (e) => {
    if (inCheckout(e.target)) e.stopImmediatePropagation();
  }, true);
  window.addEventListener("focusout", (e) => {
    if (inCheckout((e as FocusEvent).relatedTarget)) e.stopImmediatePropagation();
  }, true);

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
