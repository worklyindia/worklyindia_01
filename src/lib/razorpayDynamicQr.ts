import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

const QR_CLASS = "rzp-method-picker"; // shares focus-trap exemption with the picker

type Result = "unsupported" | "closed";

/**
 * Shows a Razorpay Dynamic UPI QR (single-use, fixed amount) for an existing order.
 * The clean QR is rendered locally from Razorpay's UPI short_url, so no Razorpay
 * branding/extra text appears. Polls the server, which credits only after Razorpay
 * confirms capture, then calls the original checkout handler with server-signed
 * params (verify is idempotent — webhook + polling can never double-credit).
 *
 * Dark-mode safe: inline colours use space-less rgb() so the global dark-mode
 * rescue rules (which match style*="background:#fff" / "color:#111") never
 * repaint this modal.
 */
const STORE = "rzp_active_qr";

/** Re-opens a QR that was open when the page refreshed (only the user can cancel it). */
export function resumeDynamicQr() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!s?.order_id || !s?.data?.qr_id) return;
    openDynamicQr({ order_id: s.order_id, handler: () => window.location.reload() }, s.data);
  } catch { localStorage.removeItem(STORE); }
}

export async function openDynamicQr(opts: Record<string, any>, existing?: any): Promise<Result> {
  if (!opts?.order_id) return "unsupported";
  const created = existing ?? await createQr(opts.order_id);
  if (created === "unsupported" || created === "closed") return created;

  return new Promise<Result>((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = QR_CLASS;
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgb(11,18,32)!important;display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;overflow:auto";
    document.body.appendChild(wrap);
    let data: any = created;
    let stopped = false;
    let poll: any, tick: any;

    const stopTimers = () => { clearInterval(poll); clearInterval(tick); };
    const closeOnServer = (id: string) => supabase.functions.invoke("create-api-subscription", { body: { action: "qr_close", qr_id: id } }).then(() => {}, () => {});
    const finish = (r: Result) => { try { localStorage.removeItem(STORE); } catch { /* ignore */ } stopped = true; stopTimers(); wrap.remove(); resolve(r); };
    const card = (inner: string) => `<div style="background:rgb(255,255,255)!important;color:rgb(17,24,39)!important;border-radius:16px;width:100%;max-width:min(94vw,430px);max-height:calc(100dvh - 32px);overflow:auto;padding:20px 16px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:10px">${inner}</div>`;
    const btn = (attr: string, label: string, primary = false) => `<button type="button" ${attr} style="width:100%;padding:12px;border-radius:10px;border:1px solid ${primary ? "rgb(37,99,235)" : "rgb(204,204,204)"}!important;background:${primary ? "rgb(37,99,235)" : "rgb(245,245,245)"}!important;color:${primary ? "rgb(255,255,255)" : "rgb(17,24,39)"}!important;font-weight:600">${label}</button>`;

    const bindCancel = () => {
      const c = wrap.querySelector("[data-cancel]") as HTMLElement | null;
      if (c) c.onclick = async () => {
        // Close the QR on Razorpay first so it can never be paid after Cancel.
        stopped = true; stopTimers();
        (c as HTMLButtonElement).disabled = true; c.textContent = "Cancelling…";
        if (data?.qr_id) await closeOnServer(data.qr_id);
        finish("closed"); try { opts?.modal?.ondismiss?.(); } catch { /* ignore */ }
      };
    };

    const showExpired = () => {
      stopped = true; stopTimers();
      if (data?.qr_id) closeOnServer(data.qr_id);
      wrap.innerHTML = card(`
        <div style="font-weight:700;font-size:20px;color:rgb(185,28,28)!important">QR Code Expired</div>
        <div style="font-size:14px;color:rgb(55,65,81)!important">This QR code has expired. Please generate a new QR code to continue.</div>
        ${btn("data-regen", "Generate New QR Code", true)}
        ${btn("data-cancel", "Cancel")}`);
      bindCancel();
      const regen = wrap.querySelector("[data-regen]") as HTMLButtonElement;
      regen.onclick = async () => {
        regen.disabled = true; regen.textContent = "Generating…";
        const n = await createQr(opts.order_id);
        if (n === "unsupported" || n === "closed") { finish("closed"); try { opts?.modal?.ondismiss?.(); } catch { /* ignore */ } return; }
        data = n; show();
      };
    };

    const show = () => {
      stopped = false;
      try { localStorage.setItem(STORE, JSON.stringify({ order_id: opts.order_id, data })); } catch { /* ignore */ }
      const amount = (Number(data.amount_paise) / 100).toLocaleString("en-IN");
      const qrSize = "min(86vw, 380px)";
      wrap.innerHTML = card(`
        <div style="font-weight:700;font-size:20px;color:rgb(17,24,39)!important">Pay ₹${amount}</div>
        <img src="${data.qrSrc}" alt="UPI QR code" style="width:${qrSize};height:${qrSize};max-height:54dvh;object-fit:${data.isClean ? "contain" : "cover"};display:block;border-radius:12px"/>
        <div data-timer style="font-size:14px;font-weight:600;color:rgb(185,28,28)!important">QR valid for 05:00</div>
        <div data-status style="font-size:13px;color:rgb(55,65,81)!important;min-height:20px">Waiting for payment…</div>
        ${btn("data-cancel", "Cancel")}`);
      bindCancel();
      const statusEl = wrap.querySelector("[data-status]") as HTMLElement;
      const timerEl = wrap.querySelector("[data-timer]") as HTMLElement;
      // Deadline comes from Razorpay's close_by (server clock). The clock offset is the one
      // measured when the QR was created (saved with it), so a refresh never restarts the timer;
      // every status poll re-syncs it with the server.
      const localAt = Number(data.local_at) || Date.now();
      let deadline = Number(data.close_by) * 1000 + (localAt - Number(data.server_now || Math.floor(localAt / 1000)) * 1000);
      const qrId = data.qr_id;
      const check = async () => {
        if (stopped) return;
        const { data: s } = await supabase.functions.invoke("create-api-subscription", { body: { action: "qr_status", qr_id: qrId } });
        if (stopped || !s || qrId !== data.qr_id) return;
        if (s.status === "paid") {
          stopped = true; stopTimers();
          timerEl.textContent = "";
          statusEl.textContent = "Payment Successful ✓";
          statusEl.style.setProperty("color", "rgb(22,163,74)", "important");
          statusEl.style.setProperty("font-size", "16px", "important");
          setTimeout(() => {
            finish("closed");
            try { opts.handler?.({ razorpay_payment_id: s.razorpay_payment_id, razorpay_order_id: s.razorpay_order_id, razorpay_signature: s.razorpay_signature }); } catch (e) { console.error(e); }
          }, 1000);
        } else if (s.status === "expired") {
          showExpired();
          return;
        }
        if (s.close_by && s.server_now) deadline = Number(s.close_by) * 1000 + (Date.now() - Number(s.server_now) * 1000);
        if (s.status === "failed") {
          statusEl.textContent = "Payment failed. Please try again before the QR expires.";
          statusEl.style.setProperty("color", "rgb(185,28,28)", "important");
        }
      };
      const render = () => {
        const left = Math.max(0, deadline - Date.now());
        timerEl.textContent = `QR valid for ${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
        // At zero, ask the server one last time (a payment may have just landed); it decides expiry.
        if (left <= 0 && !stopped) { clearInterval(tick); check().then(() => { if (!stopped) showExpired(); }); }
      };
      render();
      check();
      poll = setInterval(check, 4000);
      tick = setInterval(render, 1000);
    };
    show();
  });
}

async function createQr(orderId: string): Promise<any | "unsupported" | "closed"> {
  const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "qr_create", order_id: orderId } });
  if (error || !data?.image_url) {
    let unsupported = !data;
    try {
      const body = await (error as any)?.context?.json?.();
      unsupported = !!body?.unsupported;
      if (!unsupported) alert(body?.message || "Could not create QR code. Please try again.");
    } catch { unsupported = true; }
    return unsupported ? "unsupported" : "closed";
  }
  let qrSrc: string | null = null;
  if (data.short_url) {
    try { qrSrc = await QRCode.toDataURL(String(data.short_url), { margin: 1, width: 640, errorCorrectionLevel: "M" }); } catch { qrSrc = null; }
  }
  return { ...data, local_at: Date.now(), isClean: !!qrSrc, qrSrc: qrSrc || String(data.image_url) };
}
