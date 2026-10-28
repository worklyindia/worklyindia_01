/**
 * PayPal checkout for an existing Razorpay order (Developer API payments).
 * The picker hands over the open order; the server creates a PayPal order in USD,
 * we open PayPal in a new tab and poll until it is captured, then reload so the
 * page's own success state shows. Crediting stays server-side (create-api-subscription).
 */
import { supabase } from "@/integrations/supabase/client";

const ACTIVE_KEY = "rzp_active_paypal";
const POLL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;
const OVERLAY_CLASS = "rzp-paypal-waiting";

type Active = { paypal_order_id: string; at: number };

function saveActive(a: Active) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}
export function clearActivePaypal() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
}
function readActive(): Active | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
    if (!a?.paypal_order_id || Date.now() - Number(a.at || 0) > MAX_WAIT_MS) return null;
    return a;
  } catch { return null; }
}

function showWaiting(amountUsd: string, onCancel: () => void) {
  document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((n) => n.remove());
  const wrap = document.createElement("div");
  wrap.className = OVERLAY_CLASS;
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Waiting for PayPal payment");
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:2147483001;display:flex;align-items:flex-end;justify-content:center;background:hsl(var(--foreground)/0.5);pointer-events:auto;";
  wrap.innerHTML = `
    <div style="width:100%;max-width:480px;background:hsl(var(--background));color:hsl(var(--foreground));border-radius:16px 16px 0 0;padding:24px 16px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px hsl(var(--foreground)/0.2);text-align:center">
      <div style="width:36px;height:36px;margin:0 auto 14px;border:3px solid hsl(var(--muted));border-top-color:hsl(var(--primary));border-radius:50%;animation:rzp-pp-spin 0.8s linear infinite"></div>
      <div style="font-weight:600;font-size:16px">Complete payment in the PayPal tab</div>
      <div style="font-size:13px;color:hsl(var(--muted-foreground));margin:6px 0 4px">${amountUsd ? `Amount: $${amountUsd} · ` : ""}This page updates automatically once paid</div>
      <button type="button" data-cancel style="margin-top:14px;width:100%;padding:12px;border:none;background:transparent;color:hsl(var(--muted-foreground));cursor:pointer;font:inherit">Cancel</button>
    </div>
    <style>@keyframes rzp-pp-spin{to{transform:rotate(360deg)}}</style>`;
  wrap.querySelector("[data-cancel]")?.addEventListener("click", onCancel);
  document.body.appendChild(wrap);
  return wrap;
}

async function pollStatus(paypalOrderId: string): Promise<{ status: "paid" | "pending" | "failed" | "expired"; data?: any }> {
  const { data } = await supabase.functions
    .invoke("create-api-subscription", { body: { action: "paypal_status", paypal_order_id: paypalOrderId } })
    .catch(() => ({ data: null }));
  const s = data?.status;
  return { status: s === "paid" || s === "failed" || s === "expired" ? s : "pending", data };
}

/** Starts (or resumes) the waiting overlay + polling for a PayPal order. */
function waitForPayment(paypalOrderId: string, amountUsd: string, deadline: number, onPaid: (signed: any) => void) {
  let stopped = false;
  const wrap = showWaiting(amountUsd, () => {
    stopped = true;
    clearActivePaypal();
    wrap.remove();
  });
  const tick = async () => {
    if (stopped) return;
    if (Date.now() > deadline) {
      clearActivePaypal();
      wrap.remove();
      return;
    }
    const { status, data } = await pollStatus(paypalOrderId);
    if (stopped) return;
    if (status === "paid") {
      clearActivePaypal();
      wrap.remove();
      onPaid(data);
      return;
    }
    if (status === "failed" || status === "expired") {
      clearActivePaypal();
      wrap.remove();
      return;
    }
    setTimeout(tick, POLL_MS);
  };
  setTimeout(tick, POLL_MS);
}

/** Called by the method picker when the user chooses PayPal for an open order. */
export async function openPaypal(opts: Record<string, any>): Promise<void> {
  const orderId = String(opts?.order_id || "");
  if (!orderId) return;
  const { data } = await supabase.functions
    .invoke("create-api-subscription", { body: { action: "paypal_create", order_id: orderId } })
    .catch(() => ({ data: null }));
  if (!data?.approve_url || !data?.paypal_order_id) {
    alert(data?.message || "PayPal is not available right now. Please choose another option.");
    return;
  }
  saveActive({ paypal_order_id: data.paypal_order_id, at: Date.now() });
  window.open(data.approve_url, "_blank", "noopener");
  // On success, hand the server-signed params to the page's own handler (same as the
  // UPI/QR flow) so every product's verify step runs; without a handler, just reload.
  waitForPayment(data.paypal_order_id, String(data.amount_usd || ""), Date.now() + MAX_WAIT_MS, (signed) => {
    if (typeof opts?.handler === "function") return opts.handler(signed);
    window.location.reload();
  });
}

/** Resumes polling if the page refreshed while a PayPal payment was in progress. */
export function resumePaypal() {
  const a = readActive();
  if (!a) return clearActivePaypal();
  waitForPayment(a.paypal_order_id, "", Number(a.at) + MAX_WAIT_MS, async (signed) => {
    // After a refresh the original page handler is gone: credit server-verifiable
    // orders here, then reload so the page shows its updated state.
    await supabase.functions.invoke("create-api-subscription", { body: { action: "resume_verify", ...signed } }).catch(() => {});
    window.location.reload();
  });
}
