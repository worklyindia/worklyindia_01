/**
 * Every Pay button in the app opens Razorpay via `new window.Razorpay(opts).open()`.
 * We wrap that constructor once so, before checkout opens, a bottom sheet asks
 * the user how they want to pay:
 *   1. UPI / Bank / Debit card  -> normal Razorpay checkout (UPI apps, netbanking, cards)
 *   2. QR Code                  -> Razorpay checkout limited to the UPI QR flow
 * The same order, handler and webhook are reused, so server behaviour is unchanged.
 */
import { openDynamicQr, resumeDynamicQr } from "./razorpayDynamicQr";
import { openPaymentLink, resumePaymentLink } from "./razorpayPaymentLink";
import { openPaypal, resumePaypal } from "./razorpayPaypal";
import { supabase } from "@/integrations/supabase/client";
import { isOnSavedDomain } from "@/config/domainConfig";

type AnyOpts = Record<string, any>;

const PICKER_CLASS = "rzp-method-picker";
const PENDING = "rzp_pending_checkout";
const PENDING_TTL_MS = 15 * 60 * 1000;
const SAFE_KEYS = ["key", "amount", "currency", "order_id", "name", "description", "image", "prefill", "notes", "theme", "retry", "timeout", "readonly", "hidden", "remember_customer"];
type Stage = { stage: "picker" } | { stage: "checkout"; choice: "upi_bank" | "qr" };

/** Saves the open payment step (JSON-safe options only) so a page refresh can reopen it. */
function savePending(opts: AnyOpts, st: Stage) {
  if (!opts?.order_id) return;
  const o: AnyOpts = {};
  for (const k of SAFE_KEYS) if (opts[k] !== undefined && typeof opts[k] !== "function") o[k] = opts[k];
  try {
    const prev = JSON.parse(localStorage.getItem(PENDING) || "null");
    const at = prev?.opts?.order_id === opts.order_id ? prev.at : Date.now();
    localStorage.setItem(PENDING, JSON.stringify({ opts: o, ...st, at }));
  } catch { /* ignore */ }
}
function clearPending() { try { localStorage.removeItem(PENDING); } catch { /* ignore */ } }

/** Wraps handler/ondismiss so the saved step is cleared once checkout finishes or is closed. */
function tracked(opts: AnyOpts): AnyOpts {
  return {
    ...opts,
    handler: (r: any) => { clearPending(); return opts?.handler?.(r); },
    modal: { ...(opts?.modal || {}), ondismiss: () => { clearPending(); try { opts?.modal?.ondismiss?.(); } catch { /* ignore */ } } },
  };
}

const QR_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm1-9h2v2H6V6zm10 0h2v2h-2V6zM6 16h2v2H6v-2zm7-3h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h4v2h-2v2h-2v-4zm-4 4h2v2h2v2h-4v-4zm4 2h2v-2h2v4h-4v-2zm2 2h2v2h-2v-2z"/></svg>`;
const PAYPAL_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.1 20.4 8.6 11H6.4L8 2.9h6.2c2.3 0 3.7 1.4 3.3 3.7-.5 2.9-2.4 4.4-5.2 4.4h-2l-.9 5.6H7.1zm8.6-13.9c.1-.7-.3-1.1-1.2-1.1h-3l-.7 4.1h2.3c1.7 0 2.4-1.1 2.6-3zM18 8.2c.4 2.2-1 4.2-3.7 4.2h-1.6l-.9 5.5h-1.9l-.3 1.7h3.2c.6 0 1-.4 1.1-1l.5-3.1c.1-.6.5-1 1.1-1h.6c2.1 0 3.5-1 3.9-3.3.2-1.3 0-2.3-.9-3h-1.1z"/></svg>`;
const ICON_BOX = "flex:0 0 32px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1";

function buildConfig(choice: "upi_bank" | "qr") {
  if (choice === "qr") {
    // Razorpay renders the UPI QR only on desktop-size checkout; on phones a
    // QR-only config fails with "No appropriate payment method found".
    // So: put UPI QR first, allow UPI (any flow) and keep default blocks as fallback.
    return {
      display: {
        blocks: {
          qr: { name: "Pay via UPI QR / UPI app", instruments: [{ method: "upi" }] },
        },
        sequence: ["block.qr"],
        preferences: { show_default_blocks: true },
      },
    };
  }
  return {
    display: {
      blocks: {
        main: {
          name: "UPI, Bank or Debit Card",
          instruments: [
            // NPCI deprecated UPI Collect on web (Feb 2026) — use intent (mobile) + qr (desktop).
            { method: "upi", flows: ["intent", "qr"] },
            { method: "netbanking" },
            { method: "card", types: ["debit", "credit"] },
          ],
        },
      },
      sequence: ["block.main"],
      preferences: { show_default_blocks: false },
    },
  };
}

function showPicker(amountPaise?: number, showPaypal = true): Promise<"upi_bank" | "qr" | "link" | "paypal" | null> {
  return new Promise((resolve) => {
    document.querySelectorAll(`.${PICKER_CLASS}`).forEach((n) => n.remove());
    const wrap = document.createElement("div");
    wrap.className = PICKER_CLASS;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Choose payment method");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:hsl(var(--foreground)/0.5);pointer-events:auto;";
    const amount = typeof amountPaise === "number" ? `₹${(amountPaise / 100).toLocaleString("en-IN")}` : "";
    const btn =
      "width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:14px;border-radius:12px;border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--card-foreground));cursor:pointer;font:inherit;";
    wrap.innerHTML = `
      <div style="width:100%;max-width:480px;background:hsl(var(--background));color:hsl(var(--foreground));border-radius:16px 16px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px hsl(var(--foreground)/0.2);">
        <div style="width:40px;height:4px;border-radius:9px;background:hsl(var(--muted-foreground)/0.4);margin:0 auto 14px"></div>
        <div style="font-weight:600;font-size:17px">Choose payment method</div>
        <div style="font-size:13px;color:hsl(var(--muted-foreground));margin:4px 0 16px">${amount ? `Amount: ${amount} · ` : ""}Pay the way you prefer</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${isOnSavedDomain() ? `<button type="button" data-choice="upi_bank" style="${btn}">
            <span style="${ICON_BOX}">🏦</span>
            <span><span style="display:block;font-weight:600">UPI / Bank / Debit Card</span>
            <span style="display:block;font-size:12px;color:hsl(var(--muted-foreground))">GPay, PhonePe, Paytm, Netbanking or card</span></span>
          </button>` : ""}
          <button type="button" data-choice="qr" style="${btn}">
            <span style="${ICON_BOX};color:hsl(var(--foreground))">${QR_ICON}</span>
            <span><span style="display:block;font-weight:600">QR Code</span>
            <span style="display:block;font-size:12px;color:hsl(var(--muted-foreground))">Scan with any UPI app from another phone</span></span>
          </button>
          <button type="button" data-choice="link" style="${btn}">
            <span style="${ICON_BOX}">📩</span>
            <span><span style="display:block;font-weight:600">Payment Request</span>
            <span style="display:block;font-size:12px;color:hsl(var(--muted-foreground))">Get a pay link on your mobile &amp; email</span></span>
          </button>
          ${showPaypal ? `<button type="button" data-choice="paypal" style="${btn}">
            <span style="${ICON_BOX};color:#003087">${PAYPAL_ICON}</span>
            <span><span style="display:block;font-weight:600">PayPal</span>
            <span style="display:block;font-size:12px;color:hsl(var(--muted-foreground))">Pay in USD with your PayPal account</span></span>
          </button>` : ""}
        </div>
        <button type="button" data-choice="cancel" style="margin-top:12px;width:100%;padding:12px;border:none;background:transparent;color:hsl(var(--muted-foreground));cursor:pointer;font:inherit">Cancel</button>
      </div>`;
    const done = (v: "upi_bank" | "qr" | "link" | "paypal" | null) => {
      wrap.remove();
      resolve(v);
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return done(null);
      const el = (e.target as Element).closest("[data-choice]");
      if (!el) return;
      const c = el.getAttribute("data-choice");
      done((c === "upi_bank" && isOnSavedDomain()) || c === "qr" || c === "link" || (c === "paypal" && showPaypal) ? c : null);
    });
    document.body.appendChild(wrap);
    (wrap.querySelector("[data-choice]") as HTMLElement)?.focus();
  });
}

function isNativeAndroidWebView(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.WorklyAndroid || /WorklyIndiaApp\/Android/i.test(navigator.userAgent));
}

function wrapRazorpay(Real: any) {
  if (!Real || Real.__methodPickerWrapped) return Real;
  function Wrapped(this: any, opts: AnyOpts) {
    const listeners: Array<[string, any]> = [];
    let instance: any = null;
    return {
      on(ev: string, cb: any) {
        if (instance) instance.on(ev, cb);
        else listeners.push([ev, cb]);
      },
      close() {
        instance?.close?.();
      },
      async open() {
        // Auto-pay / mandates can't use QR — open checkout directly.
        if (opts?.subscription_id || opts?.recurring || opts?.customer_id && opts?.recurring !== undefined) {
          instance = new Real(opts);
          listeners.forEach(([ev, cb]) => instance.on(ev, cb));
          return instance.open();
        }
        savePending(opts, { stage: "picker" });
        const choice = await showPicker(Number(opts?.amount) || undefined, true);
        if (!choice) {
          clearPending();
          try { opts?.modal?.ondismiss?.(); } catch { /* ignore */ }
          return;
        }
        // QR and payment request keep their own saved state (with the server deadline).
        if (choice === "link") { clearPending(); return openPaymentLink(opts); }
        if (choice === "paypal") { clearPending(); return openPaypal(opts); }
        if (choice === "qr") {
          clearPending();
          // Real Razorpay Dynamic QR when the order supports it; else checkout's UPI QR.
          const r = await openDynamicQr(opts);
          if (r === "closed") return;
        }
        savePending(opts, { stage: "checkout", choice: choice as "upi_bank" | "qr" });
        const finalOpts = {
          ...tracked(opts),
          // Razorpay requires this flag for UPI Intent inside Android WebView.
          ...(isNativeAndroidWebView() ? { webview_intent: true } : {}),
          config: buildConfig(choice as "upi_bank" | "qr"),
        };
        instance = new Real(finalOpts);
        listeners.forEach(([ev, cb]) => instance.on(ev, cb));
        instance.open();
      },
    };
  }
  Object.assign(Wrapped, Real);
  (Wrapped as any).__methodPickerWrapped = true;
  (Wrapped as any).__real = Real;
  return Wrapped;
}

export function installRazorpayMethodPicker() {
  if (typeof window === "undefined") return;
  let current: any = wrapRazorpay((window as any).Razorpay);
  Object.defineProperty(window, "Razorpay", {
    configurable: true,
    get: () => current,
    set: (v) => { current = wrapRazorpay(v); },
  });
  setTimeout(() => { resumeDynamicQr(); resumePaymentLink(); resumePaypal(); resumePending(); }, 800);
}

function loadCheckoutScript(): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(!!(window as any).Razorpay);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Re-opens the payment-method sheet or checkout that was open when the page refreshed. */
async function resumePending() {
  let s: any = null;
  try { s = JSON.parse(localStorage.getItem(PENDING) || "null"); } catch { /* ignore */ }
  if (!s?.opts?.order_id) return;
  if (Date.now() - Number(s.at || 0) > PENDING_TTL_MS || localStorage.getItem("rzp_active_qr") || localStorage.getItem("rzp_active_link")) return clearPending();
  // Only orders the server can confirm on its own (and still unpaid) are reopened.
  const { data } = await supabase.functions.invoke("create-api-subscription", { body: { action: "resume_info", order_id: s.opts.order_id } }).catch(() => ({ data: null }));
  if (!data?.resumable) return clearPending();
  if (!(await loadCheckoutScript())) return;
  const handler = async (r: any) => {
    clearPending();
    await supabase.functions.invoke("create-api-subscription", { body: { action: "resume_verify", ...r } }).catch(() => {});
    window.location.reload();
  };
  const opts: AnyOpts = { ...s.opts, handler, modal: { ondismiss: () => {} } };
  const W: any = (window as any).Razorpay;
  if (s.stage === "checkout" && isOnSavedDomain()) {
    const Real = W?.__real || W;
    savePending(opts, { stage: "checkout", choice: s.choice === "qr" ? "qr" : "upi_bank" });
    new Real({ ...tracked(opts), config: buildConfig(s.choice === "qr" ? "qr" : "upi_bank") }).open();
  } else {
    new W(opts).open();
  }
}

export const RAZORPAY_PICKER_SELECTOR = `.${PICKER_CLASS}`;
