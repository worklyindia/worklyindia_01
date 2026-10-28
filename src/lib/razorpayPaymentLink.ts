import { supabase } from "@/integrations/supabase/client";

/**
 * "Payment Request": Razorpay sends a payment link to the user's mobile (SMS) and
 * email. Valid for 5 minutes; the server cancels it at expiry and refunds late
 * payments. On success the original checkout handler gets server-signed params.
 */
const CLS = "rzp-method-picker";
const STORE = "rzp_active_link";
const fn = (body: Record<string, unknown>) => supabase.functions.invoke("create-api-subscription", { body });

async function errMsg(error: any, data: any) {
  try { const b = await error?.context?.json?.(); return b?.message || data?.message; } catch { return data?.message; }
}

/** Re-opens a payment request that was open when the page refreshed. */
export function resumePaymentLink() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!s?.order_id || !s?.link?.link_id) return;
    openPaymentLink({ order_id: s.order_id, handler: () => window.location.reload() }, s.link);
  } catch { localStorage.removeItem(STORE); }
}

export async function openPaymentLink(opts: Record<string, any>, existing?: any): Promise<void> {
  const dismiss = () => { try { opts?.modal?.ondismiss?.(); } catch { /* ignore */ } };
  if (!opts?.order_id) { alert("Payment request is not available for this payment."); return dismiss(); }

  const wrap = document.createElement("div");
  wrap.className = CLS;
  wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgb(11,18,32)!important;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit";
  document.body.appendChild(wrap);
  const card = (inner: string) => `<div style="background:rgb(255,255,255)!important;color:rgb(17,24,39)!important;border-radius:16px;width:100%;max-width:420px;padding:22px 18px;text-align:center;display:flex;flex-direction:column;gap:10px;box-sizing:border-box">${inner}</div>`;
  const btn = (attr: string, label: string, primary = false) => `<button type="button" ${attr} style="width:100%;padding:12px;border-radius:10px;border:1px solid ${primary ? "rgb(37,99,235)" : "rgb(204,204,204)"}!important;background:${primary ? "rgb(37,99,235)" : "rgb(245,245,245)"}!important;color:${primary ? "rgb(255,255,255)" : "rgb(17,24,39)"}!important;font-weight:600;font:inherit">${label}</button>`;

  let poll: any, tick: any, stopped = false, link: any = null;
  const stop = () => { stopped = true; clearInterval(poll); clearInterval(tick); };
  const close = () => { stop(); try { localStorage.removeItem(STORE); } catch { /* ignore */ } wrap.remove(); };

  const create = async () => {
    stop(); stopped = false;
    wrap.innerHTML = card(`<div style="font-weight:700;font-size:18px">Sending payment request…</div>`);
    const { data, error } = await fn({ action: "link_create", order_id: opts.order_id });
    if (error || !data?.link_id) {
      alert((await errMsg(error, data)) || "Could not send payment request. Please try again.");
      close(); return dismiss();
    }
    link = { ...data, local_at: Date.now() }; show();
  };

  const showExpired = () => {
    stop();
    if (link?.link_id) fn({ action: "link_close", link_id: link.link_id }).catch(() => {});
    wrap.innerHTML = card(`
      <div style="font-weight:700;font-size:20px;color:rgb(185,28,28)!important">Payment Request Expired</div>
      <div style="font-size:14px;color:rgb(55,65,81)!important">The 5-minute payment link has expired. Send a new request to continue.</div>
      ${btn("data-resend", "Send New Request", true)}${btn("data-cancel", "Cancel")}`);
    (wrap.querySelector("[data-resend]") as HTMLElement).onclick = create;
    (wrap.querySelector("[data-cancel]") as HTMLElement).onclick = () => { close(); dismiss(); };
  };

  const show = () => {
    try { localStorage.setItem(STORE, JSON.stringify({ order_id: opts.order_id, link })); } catch { /* ignore */ }
    const amount = (Number(link.amount_paise) / 100).toLocaleString("en-IN");
    const sentTo = [link.contact && `📱 ${link.contact}`, link.email && `✉️ ${link.email}`].filter(Boolean).join("<br/>");
    wrap.innerHTML = card(`
      <div style="font-weight:700;font-size:20px">Payment Request Sent</div>
      <div style="font-size:15px">Pay ₹${amount} using the link sent to:</div>
      <div style="font-size:14px;color:rgb(55,65,81)!important;line-height:1.7">${sentTo}</div>
      <div data-timer style="font-size:15px;font-weight:700;color:rgb(185,28,28)!important">Link valid for 05:00</div>
      <div data-status style="font-size:13px;color:rgb(55,65,81)!important">Waiting for payment…</div>
      ${btn("data-open", `Pay ₹${amount}`, true)}${btn("data-cancel", "Cancel")}`);
    (wrap.querySelector("[data-open]") as HTMLElement).onclick = () => window.open(link.short_url, "_blank");
    const cancelBtn = wrap.querySelector("[data-cancel]") as HTMLButtonElement;
    cancelBtn.onclick = async () => {
      // Cancel the link on Razorpay first so it can never be paid after Cancel.
      stop(); cancelBtn.disabled = true; cancelBtn.textContent = "Cancelling…";
      await fn({ action: "link_close", link_id: link.link_id }).then(() => {}, () => {});
      close(); dismiss();
    };
    const timerEl = wrap.querySelector("[data-timer]") as HTMLElement;
    const statusEl = wrap.querySelector("[data-status]") as HTMLElement;
    // Clock offset measured at creation (saved with the link) so a refresh never restarts the timer.
    const localAt = Number(link.local_at) || Date.now();
    let deadline = Number(link.close_by) * 1000 + (localAt - Number(link.server_now) * 1000);
    const id = link.link_id;
    const check = async () => {
      if (stopped) return;
      const { data: s } = await fn({ action: "link_status", link_id: id });
      if (stopped || !s || id !== link.link_id) return;
      if (s.status === "paid") {
        stop();
        timerEl.textContent = "";
        statusEl.textContent = "Payment Successful ✓";
        statusEl.style.setProperty("color", "rgb(22,163,74)", "important");
        setTimeout(() => {
          close();
          try { opts.handler?.({ razorpay_payment_id: s.razorpay_payment_id, razorpay_order_id: s.razorpay_order_id, razorpay_signature: s.razorpay_signature }); } catch (e) { console.error(e); }
        }, 1000);
      } else if (s.status === "expired") showExpired();
      else if (s.close_by && s.server_now) deadline = Number(s.close_by) * 1000 + (Date.now() - Number(s.server_now) * 1000);
    };
    const render = () => {
      const left = Math.max(0, deadline - Date.now());
      timerEl.textContent = `Link valid for ${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
      if (left <= 0 && !stopped) { clearInterval(tick); check().then(() => { if (!stopped) showExpired(); }); }
    };
    render();
    check();
    poll = setInterval(check, 4000);
    tick = setInterval(render, 1000);
  };

  if (existing?.link_id) { link = existing; show(); } else await create();
}
