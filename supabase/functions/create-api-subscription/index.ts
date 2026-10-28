import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveUserEmail, sendPaymentReceiptEmail } from "../_shared/paymentReceiptEmail.ts";
import { ensureRazorpayCustomer, syncRazorpayCustomer } from "../_shared/razorpayCustomer.ts";
import { creditDeveloperQrPayment, closeQr, canUseQr, QR_PRODUCTS, QR_TTL_SECONDS } from "../_shared/developerQrPayment.ts";
import { getOwnerSecret } from "../_shared/ownerSecrets.ts";
import { loadSettings as loadDomainPricing, getFxRate } from "../_shared/godaddy/pricing.ts";

// Smallest API-call purchase or auto top-up a user may buy.
const MIN_API_CALLS = 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ message: "Please sign in first" }, 401);
    const user = auth.user;

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    if (!keyId || !keySecret) return json({ message: "Payments are not configured yet" }, 500);

    const reqBody = await req.json().catch(() => ({}));
    const action = ["verify", "manual_order", "manual_verify", "cancel", "calls_order", "calls_verify", "topup_mandate_order", "topup_mandate_verify", "topup_mandate_cancel", "topup_check", "topup_save", "qr_create", "qr_status", "qr_close", "link_create", "link_status", "link_close", "payment_customer", "payment_customer_sync", "payment_mobile_taken", "resume_info", "resume_verify", "paypal_create", "paypal_status"].includes(reqBody?.action) ? reqBody.action : "create";
    const rzApi = (path: string, body?: unknown) => fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const DAY = 86400000;
    // Paid-until date for an auto-pay subscription, taken from Razorpay
    const periodEnd = async (subId: string) => {
      try {
        const r = await rzApi(`/subscriptions/${subId}`);
        if (r.ok) {
          const s = await r.json();
          const end = s.current_end || s.start_at;
          if (end && end * 1000 > Date.now()) return new Date(end * 1000 + DAY).toISOString();
        }
      } catch { /* fallback */ }
      return new Date(Date.now() + 31 * DAY).toISOString();
    };
    const getPrice = async () => {
      const { data } = await admin.from("app_settings").select("setting_value").eq("setting_key", "api_subscription_price").maybeSingle();
      return Math.max(1, Math.round(Number(data?.setting_value ?? 500)));
    };

    // Razorpay recurring payments need a customer (docs: fail_existing "0" returns the existing one)
    const getCustomer = async (uid: string, fallbackEmail?: string | null) => {
      const { data: prof0 } = await admin.from("profiles").select("email,phone,full_name").eq("id", uid).maybeSingle();
      const prof: { email?: string | null; phone?: string | null; full_name?: string | null } = { ...(prof0 || {}) };
      // Payment Profile is the source of truth for name + mobile; email is the login email.
      const { data: pay } = await admin.from("payment_profiles").select("name,mobile,email").eq("user_id", uid).maybeSingle();
      if (pay?.name) prof.full_name = pay.name;
      if (pay?.mobile) prof.phone = pay.mobile;
      if (pay?.email) prof.email = pay.email;
      if (!prof.phone) {
        const { data: dev } = await admin.from("developer_profiles").select("phone,full_name").eq("user_id", uid).maybeSingle();
        if (dev?.phone) {
          prof.phone = dev.phone;
          if (!prof.full_name && dev.full_name) prof.full_name = dev.full_name;
        }
      }
      const email = prof?.email || fallbackEmail || undefined;
      const contact = prof?.phone ? String(prof.phone).replace(/[^0-9+]/g, "") : undefined;
      const r = await rzApi("/customers", { name: prof?.full_name || email || "Customer", email, contact, fail_existing: "0", notes: { user_id: uid } });
      if (!r.ok) throw new Error(`Failed to create customer: ${await r.text()}`);
      const c = await r.json();
      return { id: c.id as string, email, contact };
    };

    // ---------- AUTO-TOP-UP SETTINGS: saved server-side (mandate columns stay server-only) ----------
    if (action === "topup_save") {
      const threshold = Math.floor(Number(reqBody?.threshold_calls));
      const calls = Math.floor(Number(reqBody?.topup_calls));
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10000000) return json({ message: "Enter a valid balance limit" }, 400);
      if (!Number.isFinite(calls) || calls < MIN_API_CALLS || calls > 10000000) return json({ message: `Minimum ${MIN_API_CALLS} API calls per top-up` }, 400);
      const { error } = await admin.from("api_auto_topup_settings").upsert({ user_id: user.id, threshold_calls: threshold, topup_calls: calls, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) return json({ message: error.message }, 500);
      return json({ status: "success" });
    }

    // ---------- AUTO-TOP-UP: server-only charge when balance runs low ----------
    // Called by consume_api_call flow (service role secret), never by end users.
    if (action === "topup_check") {
      if (req.headers.get("x-topup-secret") !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ message: "Forbidden" }, 403);
      const onlyUser = typeof reqBody?.user_id === "string" ? reqBody.user_id : null;
      let q = admin.from("api_auto_topup_settings").select("user_id,threshold_calls,topup_calls,razorpay_token_id,last_topup_at")
        .eq("enabled", true).eq("mandate_status", "active").not("razorpay_token_id", "is", null);
      if (onlyUser) q = q.eq("user_id", onlyUser);
      const { data: rows } = await q;
      const results: unknown[] = [];
      for (const t of rows || []) {
        try {
          if (t.last_topup_at && Date.now() - new Date(t.last_topup_at).getTime() < 10 * 60 * 1000) continue; // cooldown
          const { data: quota } = await admin.from("api_call_quota").select("monthly_limit,used").eq("user_id", t.user_id).maybeSingle();
          const remaining = Math.max(0, Number(quota?.monthly_limit ?? 0) - Number(quota?.used ?? 0));
          if (remaining >= Number(t.threshold_calls)) continue;
          const { data: pr } = await admin.from("app_settings").select("setting_value").eq("setting_key", "api_call_price").maybeSingle();
          const perCall = Number(pr?.setting_value ?? 0.25);
          const paise = Math.round(Number(t.topup_calls) * perCall * 100);
          if (paise < 100) continue;
          const or = await rzApi("/orders", { amount: paise, currency: "INR", receipt: `topup_${t.user_id.slice(0, 8)}_${Date.now()}`, notes: { user_id: t.user_id, product: "developer_api_topup", calls: String(t.topup_calls) } });
          if (!or.ok) throw new Error(await or.text());
          const order = await or.json();
          const cust = await getCustomer(t.user_id);
          const cr = await rzApi("/payments/create/recurring", {
            amount: paise, currency: "INR", order_id: order.id, email: cust.email, contact: cust.contact,
            customer_id: cust.id, token: t.razorpay_token_id, recurring: "1",
            description: `Auto top-up: ${Number(t.topup_calls).toLocaleString("en-IN")} API calls`,
          });
          const pay = cr.ok ? await cr.json() : null;
          if (!pay?.id || !["captured", "authorized"].includes(pay.status)) throw new Error(cr.ok ? `payment status ${pay?.status}` : await cr.text());
          await admin.rpc("add_purchased_api_calls", { _user_id: t.user_id, _calls: Number(t.topup_calls), _amount: paise / 100, _order_id: order.id, _payment_id: pay.id, _source: "topup" });
          await admin.from("api_auto_topup_settings").update({ last_topup_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", t.user_id);
          results.push({ user_id: t.user_id, status: "charged", payment_id: pay.id });
          try {
            const { email, name } = await resolveUserEmail(admin, t.user_id);
            await sendPaymentReceiptEmail(admin, email || null, name, { paymentType: "API Auto-Top-Up", planName: `${Number(t.topup_calls).toLocaleString("en-IN")} API calls`, amountInr: paise / 100, paymentId: pay.id });
          } catch (e) { console.error("[topup] receipt email failed:", e); }
        } catch (e) {
          console.error("[topup] charge failed for", t.user_id, e);
          await admin.from("api_auto_topup_settings").update({ mandate_status: "failed", updated_at: new Date().toISOString() }).eq("user_id", t.user_id);
          results.push({ user_id: t.user_id, status: "failed" });
        }
      }
      return json({ status: "success", results });
    }

    // ---------- AUTO-TOP-UP MANDATE: one-time authorization of auto-debit ----------
    if (action === "topup_mandate_order" || action === "topup_mandate_verify" || action === "topup_mandate_cancel") {
      if (action === "topup_mandate_cancel") {
        // Revoke the mandate on Razorpay too, so the UPI app / bank shows it cancelled.
        const { data: cur } = await admin.from("api_auto_topup_settings").select("razorpay_token_id").eq("user_id", user.id).maybeSingle();
        if (cur?.razorpay_token_id) {
          try {
            const cust = await getCustomer(user.id);
            const r = await rzApi(`/customers/${cust.id}/tokens/${cur.razorpay_token_id}/cancel`, {});
            if (!r.ok) {
              const t = await r.text();
              const d = await fetch(`https://api.razorpay.com/v1/customers/${cust.id}/tokens/${cur.razorpay_token_id}`, { method: "DELETE", headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` } }).catch(() => null);
              if (!d?.ok && !/cancel|not found|invalid/i.test(t)) return json({ message: "Razorpay could not cancel the mandate: " + t }, 502);
            }
          } catch (e) { console.error("[topup-mandate] razorpay cancel failed", e); }
        }
        await admin.from("api_auto_topup_settings").update({ mandate_status: "none", razorpay_token_id: null, razorpay_subscription_id: null, enabled: false, updated_at: new Date().toISOString() }).eq("user_id", user.id);
        return json({ status: "success" });
      }
      const { data: pr } = await admin.from("app_settings").select("setting_value").eq("setting_key", "api_call_price").maybeSingle();
      const perCall = Number(pr?.setting_value ?? 0.25);
      if (!(perCall > 0)) return json({ message: "API call pricing is not set" }, 500);
      if (action === "topup_mandate_order") {
        const { data: t } = await admin.from("api_auto_topup_settings").select("topup_calls,enabled").eq("user_id", user.id).maybeSingle();
        if (!t?.enabled) return json({ message: "Turn on Auto-Top-Up first" }, 400);
        const calls = Math.floor(Number(t.topup_calls));
        if (!(calls >= MIN_API_CALLS)) return json({ message: `Minimum ${MIN_API_CALLS} API calls per top-up` }, 400);
        const paise = Math.round(calls * perCall * 100);
        if (paise < 100) return json({ message: "Minimum payment is ₹1. Please add more calls." }, 400);
        // Order with a saved token: first top-up is charged now, later top-ups are auto-debited
        const cust = await getCustomer(user.id, user.email);
        const r = await rzApi("/orders", {
          amount: paise, currency: "INR", receipt: `mand_${user.id.slice(0, 8)}_${Date.now()}`,
          customer_id: cust.id, payment_capture: 1,
          token: { max_amount: Math.max(paise, 1500000), expire_at: Math.floor(Date.now() / 1000) + 10 * 365 * 86400, frequency: "as_presented" },
          notes: { user_id: user.id, product: "developer_api_topup_mandate", calls: String(calls) },
        });
        if (!r.ok) return json({ message: `Failed to create order: ${await r.text()}` }, 502);
        const order = await r.json();
        return json({ order_id: order.id, key: keyId, amount_paise: paise, calls, customer_id: cust.id });
      }
      // topup_mandate_verify
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = reqBody || {};
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) return json({ message: "Missing payment verification parameters" }, 400);
      const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
      if (expected !== razorpay_signature) return json({ message: "Invalid payment signature" }, 400);
      const or = await rzApi(`/orders/${razorpay_order_id}`);
      const order = or.ok ? await or.json() : null;
      if (!order || order.notes?.user_id !== user.id || order.notes?.product !== "developer_api_topup_mandate") return json({ message: "Order not found" }, 400);
      const pres = await rzApi(`/payments/${razorpay_payment_id}`);
      const pay = pres.ok ? await pres.json() : null;
      if (!pay || pay.order_id !== razorpay_order_id || !["captured", "authorized"].includes(pay.status)) return json({ message: "Payment not completed" }, 400);
      if (!pay.token_id) return json({ message: "Your bank did not allow auto-debit. Please try UPI or a card that supports auto-pay." }, 400);
      const calls = Math.floor(Number(order.notes.calls));
      const amount = Number(order.amount) / 100;
      const { error } = await admin.rpc("add_purchased_api_calls", { _user_id: user.id, _calls: calls, _amount: amount, _order_id: razorpay_order_id, _payment_id: razorpay_payment_id, _source: "topup" });
      if (error) return json({ message: error.message }, 500);
      await admin.from("api_auto_topup_settings").update({ razorpay_token_id: pay.token_id, mandate_status: "active", last_topup_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", user.id);
      try {
        const { email, name } = await resolveUserEmail(admin, user.id);
        await sendPaymentReceiptEmail(admin, email || user.email || null, name, { paymentType: "API Auto-Top-Up", planName: `${calls.toLocaleString("en-IN")} API calls (auto-debit authorized)`, amountInr: amount, paymentId: razorpay_payment_id });
      } catch (e) { console.error("[topup-mandate] receipt email failed:", e); }
      return json({ status: "success", calls });
    }

    // ---------- EXTRA API CALLS: one-time top-up, priced per call ----------
    // ---------- DYNAMIC UPI QR (Razorpay QR Codes API) for an existing order ----------
    if (action === "qr_create") {
      const orderId = String(reqBody?.order_id || "");
      if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return json({ message: "Invalid order", unsupported: true }, 400);
      const or = await rzApi(`/orders/${orderId}`);
      const order = or.ok ? await or.json() : null;
      if (!order || !canUseQr(order, user.id)) return json({ message: "QR not available for this payment", unsupported: true }, 422);
      if (order.status === "paid") return json({ message: "This order is already paid" }, 409);
      // Real 5-minute expiry: Razorpay itself closes the QR at close_by, so it cannot be paid afterwards.
      const closeBy = Math.floor(Date.now() / 1000) + QR_TTL_SECONDS;
      // Attach the customer so name + email show in the Razorpay dashboard.
      let customerId: string | undefined;
      let custName = "", custEmail = "";
      try {
        const c = await getCustomer(user.id, user.email);
        customerId = c.id; custEmail = c.email || "";
        const { data: p } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        custName = p?.full_name || "";
      } catch (e) { console.error("[qr_create] customer lookup failed", e); }
      const r = await rzApi("/payments/qr_codes", {
        type: "upi_qr", name: (custName || custEmail || "Workly India").slice(0, 60), usage: "single_use", fixed_amount: true,
        payment_amount: order.amount, description: order.notes?.product === "developer_api_calls" ? "API calls" : order.notes?.product === "developer_api_manual" ? "API subscription" : "Workly India payment",
        close_by: closeBy, ...(customerId ? { customer_id: customerId } : {}),
        notes: { order_id: orderId, user_id: user.id, product: String(order.notes?.product || ""), customer_name: custName, customer_email: custEmail },
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("[qr_create] Razorpay error", r.status, t);
        return json({ message: "Razorpay could not create the QR code", details: t }, 502);
      }
      const qr = await r.json();
      return json({ qr_id: qr.id, image_url: qr.image_url, short_url: qr.short_url, amount_paise: qr.payment_amount, close_by: qr.close_by, server_now: Math.floor(Date.now() / 1000) });
    }
    if (action === "qr_status") {
      const qrId = String(reqBody?.qr_id || "");
      if (!/^qr_[A-Za-z0-9]+$/.test(qrId)) return json({ message: "Invalid QR" }, 400);
      const qres = await rzApi(`/payments/qr_codes/${qrId}`);
      const qr = qres.ok ? await qres.json() : null;
      if (!qr || qr.notes?.user_id !== user.id) return json({ message: "QR not found" }, 404);
      const pres = await rzApi(`/payments/qr_codes/${qrId}/payments`);
      const items: any[] = pres.ok ? ((await pres.json()).items || []) : [];
      const paid = items.find((p) => p.status === "captured" && Number(p.amount) === Number(qr.payment_amount));
      if (paid && await creditDeveloperQrPayment(admin, rzApi, qr, paid)) {
        await closeQr(rzApi, qr);
        const orderId = qr.notes.order_id;
        return json({ status: "paid", razorpay_payment_id: paid.id, razorpay_order_id: orderId, razorpay_signature: await hmacHex(keySecret, `${orderId}|${paid.id}`) });
      }
      const now = Math.floor(Date.now() / 1000);
      if (qr.status === "closed" || (qr.close_by && now >= Number(qr.close_by))) {
        await closeQr(rzApi, qr);
        return json({ status: "expired" });
      }
      if (items.some((p) => p.status === "failed")) return json({ status: "failed", close_by: qr.close_by, server_now: now });
      return json({ status: "pending", close_by: qr.close_by, server_now: now });
    }
    // ---------- PAYMENT LINK (Razorpay Payment Links API), sent by SMS + email ----------
    // Razorpay requires expire_by >= 15 min ahead, so the link is created with 16 min and
    // our own 5-minute window is enforced: cancelled at 5 min, late payments refunded.
    const linkAsQr = (l: any) => ({ id: l.id, status: "closed", payment_amount: l.amount, close_by: Number(l.notes?.close_by || 0), notes: l.notes });
    const cancelLink = async (l: any) => {
      if (!l?.id || ["cancelled", "paid", "expired"].includes(l.status)) return;
      try { const r = await rzApi(`/payment_links/${l.id}/cancel`, {}); if (!r.ok) console.error("[link] cancel failed", r.status, await r.text()); } catch (e) { console.error(e); }
    };
    // Payment Profile: Customer ID from payment history, else create/save the Razorpay customer.
    if (action === "payment_mobile_taken") {
      const d = String(reqBody?.mobile || "").replace(/\D/g, "").slice(-10);
      if (d.length !== 10) return json({ taken: false });
      const { data: rows } = await admin.from("payment_profiles").select("user_id,mobile").neq("user_id", user.id).ilike("mobile", `%${d}`).limit(5);
      return json({ taken: (rows || []).some((r: any) => String(r.mobile).replace(/\D/g, "").slice(-10) === d) });
    }
    if (action === "payment_customer_sync") {
      const { data: hist } = await admin.from("razorpay_customer_payments").select("customer_id").eq("user_id", user.id).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const id = hist?.customer_id || await ensureRazorpayCustomer({ id: user.id, email: user.email });
      const ok = id ? await syncRazorpayCustomer({ id: user.id, email: user.email }, id) : false;
      return json({ synced: ok, customer_id: id || null });
    }
    if (action === "payment_customer") {
      const { data: hist } = await admin.from("razorpay_customer_payments").select("customer_id").eq("user_id", user.id).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (hist?.customer_id) return json({ customer_id: hist.customer_id });
      const id = await ensureRazorpayCustomer({ id: user.id, email: user.email });
      return id ? json({ customer_id: id }) : json({ message: "Could not create Razorpay customer. Please try again." }, 502);
    }
    if (action === "link_create") {
      const orderId = String(reqBody?.order_id || "");
      if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return json({ message: "Invalid order" }, 400);
      const or = await rzApi(`/orders/${orderId}`);
      const order = or.ok ? await or.json() : null;
      if (!order || !canUseQr(order, user.id)) return json({ message: "Payment request is not available for this payment yet. Please choose another option." }, 422);
      if (order.status === "paid") return json({ message: "This order is already paid" }, 409);
      const { data: pp } = await admin.from("payment_profiles").select("name,mobile,address,city,state,postal_code,country,shipping_address").eq("user_id", user.id).maybeSingle();
      const { data: p0 } = await admin.from("profiles").select("full_name,phone").eq("user_id", user.id).maybeSingle();
      const email = (user.email || "").trim();
      // Razorpay shows the customer's saved name, so keep it a real name (never the email).
      const cleanName = (v: unknown) => String(v || "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 50);
      const custName = cleanName(pp?.name) || cleanName(p0?.full_name) || "Customer";
      const digits = String(pp?.mobile || p0?.phone || user.phone || "").replace(/\D/g, "");
      const contact = digits.length === 10 ? `+91${digits}` : digits.length > 10 ? `+${digits}` : "";
      if (!email && !contact) return json({ message: "Add your mobile number or email in your profile first." }, 400);
      try {
        const { data: hist } = await admin.from("razorpay_customer_payments").select("customer_id").eq("user_id", user.id).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const cid = hist?.customer_id || await ensureRazorpayCustomer({ id: user.id, email: user.email });
        if (cid) await syncRazorpayCustomer({ id: user.id, email: user.email }, cid);
      } catch (e) { console.error("[link_create] customer sync", e); }
      const billing = [pp?.address, pp?.city, pp?.state, pp?.postal_code, pp?.country].map(v => String(v || "").trim()).filter(Boolean).join(", ").slice(0, 250);
      const sa: any = pp?.shipping_address || {};
      const shipping = [sa.address, sa.city, sa.state, sa.postal_code, sa.country].map((v: unknown) => String(v || "").trim()).filter(Boolean).join(", ").slice(0, 250);
      const now = Math.floor(Date.now() / 1000);
      const closeBy = now + QR_TTL_SECONDS;
      const r = await rzApi("/payment_links", {
        amount: order.amount, currency: "INR", accept_partial: false, reference_id: `${orderId.slice(6)}_${now}`.slice(0, 40),
        description: order.notes?.product === "developer_api_calls" ? "API calls" : order.notes?.product === "developer_api_manual" ? "API subscription" : "Workly India payment",
        expire_by: now + 16 * 60,
        customer: { name: custName, ...(email ? { email } : {}), ...(contact ? { contact } : {}) },
        notify: { sms: !!contact, email: !!email }, reminder_enable: false,
        notes: { order_id: orderId, user_id: user.id, product: String(order.notes?.product || ""), close_by: String(closeBy), ...(billing ? { billing_address: billing } : {}), ...(shipping ? { shipping_address: shipping } : {}) },
      });
      if (!r.ok) { const t = await r.text(); console.error("[link_create]", r.status, t); return json({ message: "Razorpay could not create the payment link", details: t }, 502); }
      const l = await r.json();
      return json({ link_id: l.id, short_url: l.short_url, amount_paise: l.amount, close_by: closeBy, server_now: now, contact: contact ? `******${contact.slice(-4)}` : "", email: email ? email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "" });
    }
    if (action === "link_status" || action === "link_close") {
      const linkId = String(reqBody?.link_id || "");
      if (!/^plink_[A-Za-z0-9]+$/.test(linkId)) return json({ message: "Invalid link" }, 400);
      const lr = await rzApi(`/payment_links/${linkId}`);
      const l = lr.ok ? await lr.json() : null;
      if (!l || l.notes?.user_id !== user.id) return json({ message: "Link not found" }, 404);
      if (action === "link_close") { await cancelLink(l); return json({ status: "closed" }); }
      for (const ref of (l.payments || [])) {
        if (ref.status !== "captured") continue;
        const pr = await rzApi(`/payments/${ref.payment_id}`);
        const pay = pr.ok ? await pr.json() : null;
        if (pay && await creditDeveloperQrPayment(admin, rzApi, linkAsQr(l), pay)) {
          const orderId = l.notes.order_id;
          return json({ status: "paid", razorpay_payment_id: pay.id, razorpay_order_id: orderId, razorpay_signature: await hmacHex(keySecret, `${orderId}|${pay.id}`) });
        }
      }
      const now = Math.floor(Date.now() / 1000);
      if (["cancelled", "expired"].includes(l.status) || now >= Number(l.notes?.close_by || 0)) { await cancelLink(l); return json({ status: "expired" }); }
      return json({ status: "pending", close_by: Number(l.notes.close_by), server_now: now });
    }
    // ---------- PAYPAL CHECKOUT: pays an existing website order in USD ----------
    // Reuses the same Razorpay order + creditDeveloperQrPayment crediting, so products,
    // amounts and dedup stay identical to UPI/QR payments. INR is converted to USD with
    // the Domain Charges dollar rate (manual or live/AI).
    // Owner Secrets page values win; edge env vars are only a fallback.
    const ppId = (await getOwnerSecret("PAYPAL_CLIENT_ID")) || Deno.env.get("PAYPAL_CLIENT_ID")?.trim() || null;
    const ppSecret = (await getOwnerSecret("PAYPAL_CLIENT_SECRET")) || Deno.env.get("PAYPAL_CLIENT_SECRET")?.trim() || null;
    const ppMode = (await getOwnerSecret("PAYPAL_MODE")) || Deno.env.get("PAYPAL_MODE") || "live";
    const ppBase = ppMode.trim() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const ppToken = async () => {
      const r = await fetch(`${ppBase}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${ppId}:${ppSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      if (!r.ok) throw new Error("PayPal authentication failed");
      return (await r.json()).access_token as string;
    };
    const ppApi = async (path: string, body?: unknown) => {
      const t = await ppToken();
      return fetch(`${ppBase}/v2/checkout/orders${path}`, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    };
    if (action === "paypal_create" || action === "paypal_status") {
      if (!ppId || !ppSecret) return json({ message: "PayPal is not configured yet" }, 500);
      // INR -> USD uses the same Dollar rate as Domain Charges (manual rate when
      // "Use my own dollar rate" is on, otherwise the live/AI daily rate).
      let rate = 0;
      try {
        const fx = await getFxRate(admin, await loadDomainPricing(admin));
        if (Number(fx?.rate) > 0) rate = 1 / Number(fx.rate);
      } catch (e) { console.error("[paypal] fx rate failed", e); }
      if (!(rate > 0)) return json({ message: "PayPal conversion rate is not set" }, 500);
      if (action === "paypal_create") {
        const orderId = String(reqBody?.order_id || "");
        if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return json({ message: "Invalid order" }, 400);
        const or = await rzApi(`/orders/${orderId}`);
        const order = or.ok ? await or.json() : null;
        if (!order || !canUseQr(order, user.id)) return json({ message: "PayPal is not available for this payment" }, 422);
        if (order.status === "paid") return json({ message: "This order is already paid" }, 409);
        const usd = Math.max(1, Math.round((Number(order.amount) / 100) * rate * 100) / 100).toFixed(2);
        const r = await ppApi("", {
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: "USD", value: usd },
            custom_id: orderId,
            description: order.notes?.product === "developer_api_calls" ? "API calls" : order.notes?.product === "developer_api_manual" ? "API subscription" : "Workly India payment",
          }],
        });
        if (!r.ok) { const t = await r.text(); console.error("[paypal_create]", r.status, t); return json({ message: "PayPal could not create the order", details: t }, 502); }
        const po = await r.json();
        const approve = (po.links || []).find((l: any) => l.rel === "approve")?.href;
        if (!po.id || !approve) return json({ message: "PayPal did not return a checkout link" }, 502);
        // History row; final status is written only by paypal-webhook (verified events).
        const product = String(order.notes?.product || "");
        const { error: ppRowErr } = await admin.from("paypal_payments").insert({
          user_id: user.id, rzp_order_id: orderId, paypal_order_id: po.id, product,
          label: product === "developer_api_calls" ? "Increase API Calls" : product === "developer_api_manual" ? "API Subscription" : "Workly India payment",
          amount_inr: Number(order.amount) / 100, amount_usd: Number(usd), currency: "USD", status: "created",
        });
        if (ppRowErr) console.error("[paypal_create] history row failed", ppRowErr);
        return json({ paypal_order_id: po.id, approve_url: approve, amount_usd: usd });
      }
      // paypal_status: capture when approved, credit when completed
      const ppOrderId = String(reqBody?.paypal_order_id || "");
      if (!/^[A-Z0-9]{10,20}$/.test(ppOrderId)) return json({ message: "Invalid PayPal order" }, 400);
      let gr = await ppApi(`/${ppOrderId}`);
      let po = gr.ok ? await gr.json() : null;
      if (!po) return json({ message: "PayPal order not found" }, 404);
      const orderId = String(po.purchase_units?.[0]?.custom_id || "");
      const or = await rzApi(`/orders/${orderId}`);
      const order = or.ok ? await or.json() : null;
      if (!order || !canUseQr(order, user.id)) return json({ message: "Order not found" }, 404);
      if (po.status === "APPROVED") {
        const cr = await ppApi(`/${ppOrderId}/capture`, {});
        if (!cr.ok) { const t = await cr.text(); console.error("[paypal capture]", cr.status, t); return json({ status: "failed" }); }
        gr = await ppApi(`/${ppOrderId}`);
        po = gr.ok ? await gr.json() : null;
      }
      if (po?.status === "COMPLETED") {
        const capture = po.purchase_units?.[0]?.payments?.captures?.[0];
        if (!capture?.id) return json({ status: "pending" });
        // Link the capture so webhook refunds match; status stays webhook-owned.
        await admin.from("paypal_payments").update({
          capture_id: capture.id, payer_email: po.payer?.email_address || null,
          payer_name: [po.payer?.name?.given_name, po.payer?.name?.surname].filter(Boolean).join(" ") || null,
          payer_id: po.payer?.payer_id || null,
        }).eq("paypal_order_id", ppOrderId).eq("user_id", user.id).is("capture_id", null);
        const ok = await creditDeveloperQrPayment(admin, rzApi,
          { id: ppOrderId, status: "closed", payment_amount: order.amount, close_by: 0, notes: { order_id: orderId, user_id: user.id } },
          { id: capture.id, amount: order.amount, status: "captured", created_at: Math.floor(Date.now() / 1000) });
        if (!ok) return json({ status: "pending" });
        // Server-signed order|payment params, same as the QR flow, so every page's own
        // verify step (unified-verify-payment etc.) accepts the PayPal capture.
        return json({
          status: "paid",
          razorpay_payment_id: capture.id,
          razorpay_order_id: orderId,
          razorpay_signature: await hmacHex(keySecret, `${orderId}|${capture.id}`),
        });
      }
      if (["VOIDED", "EXPIRED"].includes(String(po?.status))) return json({ status: "expired" });
      return json({ status: "pending" });
    }
    // ---------- RESUME after page refresh (only Developer API orders) ----------
    if (action === "resume_info" || action === "resume_verify") {
      const orderId = String(reqBody?.order_id || reqBody?.razorpay_order_id || "");
      if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return json({ resumable: false }, 400);
      const or = await rzApi(`/orders/${orderId}`);
      const order = or.ok ? await or.json() : null;
      const owned = !!order && order.notes?.user_id === user.id && QR_PRODUCTS.includes(order.notes?.product);
      if (action === "resume_info") return json({ resumable: owned && order.status !== "paid" });
      if (!owned) return json({ message: "Order not found" }, 404);
      const pid = String(reqBody?.razorpay_payment_id || "");
      const sig = String(reqBody?.razorpay_signature || "");
      if (!/^pay_[A-Za-z0-9]+$/.test(pid) || sig !== await hmacHex(keySecret, `${orderId}|${pid}`)) return json({ message: "Invalid payment" }, 400);
      const pr = await rzApi(`/payments/${pid}`);
      const pay = pr.ok ? await pr.json() : null;
      if (!pay || pay.order_id !== orderId) return json({ message: "Payment not found" }, 404);
      const ok = await creditDeveloperQrPayment(admin, rzApi, { id: orderId, status: "closed", payment_amount: order.amount, close_by: 0, notes: { order_id: orderId, user_id: user.id } }, pay);
      return json({ status: ok ? "success" : "pending" });
    }
    if (action === "qr_close") {
      const qrId = String(reqBody?.qr_id || "");
      if (!/^qr_[A-Za-z0-9]+$/.test(qrId)) return json({ message: "Invalid QR" }, 400);
      const qres = await rzApi(`/payments/qr_codes/${qrId}`);
      const qr = qres.ok ? await qres.json() : null;
      if (!qr || qr.notes?.user_id !== user.id) return json({ message: "QR not found" }, 404);
      await closeQr(rzApi, qr);
      return json({ status: "closed" });
    }

    if (action === "calls_order" || action === "calls_verify") {
      const { data: pr } = await admin.from("app_settings").select("setting_value").eq("setting_key", "api_call_price").maybeSingle();
      const perCall = Number(pr?.setting_value ?? 0.25);
      if (!(perCall > 0)) return json({ message: "API call pricing is not set" }, 500);
      if (action === "calls_order") {
        const calls = Math.floor(Number(reqBody?.calls));
        if (!Number.isFinite(calls) || calls < MIN_API_CALLS || calls > 10000000) return json({ message: `Minimum ${MIN_API_CALLS} API calls per purchase` }, 400);
        const paise = Math.round(calls * perCall * 100);
        if (paise < 100) return json({ message: "Minimum payment is ₹1. Please add more calls." }, 400);
        const r = await rzApi("/orders", { amount: paise, currency: "INR", receipt: `apic_${user.id.slice(0, 8)}_${Date.now()}`, notes: { user_id: user.id, product: "developer_api_calls", calls: String(calls) } });
        if (!r.ok) return json({ message: `Failed to create order: ${await r.text()}` }, 502);
        const order = await r.json();
        return json({ order_id: order.id, key: keyId, amount_paise: paise, calls });
      }
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = reqBody || {};
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) return json({ message: "Missing payment verification parameters" }, 400);
      const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
      if (expected !== razorpay_signature) return json({ message: "Invalid payment signature" }, 400);
      // Already credited (e.g. via dynamic UPI QR) — never credit twice.
      const { data: done } = await admin.from("api_call_purchases").select("id").eq("payment_id", razorpay_payment_id).eq("user_id", user.id).maybeSingle();
      if (done) return json({ status: "success" });
      const or = await rzApi(`/orders/${razorpay_order_id}`);
      const order = or.ok ? await or.json() : null;
      if (!order || order.notes?.user_id !== user.id || order.notes?.product !== "developer_api_calls") return json({ message: "Order not found" }, 400);
      const pres = await rzApi(`/payments/${razorpay_payment_id}`);
      const pay = pres.ok ? await pres.json() : null;
      if (!pay || pay.order_id !== razorpay_order_id || !["captured", "authorized"].includes(pay.status)) return json({ message: "Payment not completed" }, 400);
      const calls = Math.floor(Number(order.notes.calls));
      const amount = Number(order.amount) / 100;
      const { error } = await admin.rpc("add_purchased_api_calls", { _user_id: user.id, _calls: calls, _amount: amount, _order_id: razorpay_order_id, _payment_id: razorpay_payment_id, _source: "purchase" });
      if (error) return json({ message: error.message }, 500);
      try {
        const { email, name } = await resolveUserEmail(admin, user.id);
        await sendPaymentReceiptEmail(admin, email || user.email || null, name, { paymentType: "API Calls", planName: `${calls.toLocaleString("en-IN")} extra API calls`, amountInr: amount, paymentId: razorpay_payment_id });
      } catch (e) { console.error("[api-calls] receipt email failed:", e); }
      return json({ status: "success", calls });
    }

    // ---------- CANCEL auto-pay subscription ----------
    if (action === "cancel") {
      const { data: rows } = await admin.from("api_subscriptions").select("id,subscription_id")
        .eq("user_id", user.id).eq("status", "active").neq("payment_mode", "manual");
      if (!rows?.length) return json({ message: "No active auto-pay subscription found" }, 404);
      for (const r of rows) {
        if (r.subscription_id) {
          const c = await rzApi(`/subscriptions/${r.subscription_id}/cancel`, { cancel_at_cycle_end: 0 });
          if (!c.ok) {
            const t = await c.text();
            if (!/cancel/i.test(t)) return json({ message: "Razorpay could not cancel: " + t }, 502);
          }
        }
        await admin.from("api_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", r.id);
      }
      await admin.from("api_keys").update({ rate_limit_tier: "free" }).eq("user_id", user.id).eq("rate_limit_tier", "pro");
      return json({ status: "success" });
    }

    // ---------- MANUAL: one-time monthly payment, no auto-pay ----------
    if (action === "manual_order") {
      const price = await getPrice();
      const r = await rzApi("/orders", { amount: price * 100, currency: "INR", receipt: `api_${user.id.slice(0, 8)}_${Date.now()}`, notes: { user_id: user.id, product: "developer_api_manual" } });
      if (!r.ok) return json({ message: `Failed to create order: ${await r.text()}` }, 502);
      const order = await r.json();
      return json({ order_id: order.id, key: keyId, amount: price });
    }
    if (action === "manual_verify") {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = reqBody || {};
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) return json({ message: "Missing payment verification parameters" }, 400);
      const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
      if (expected !== razorpay_signature) return json({ message: "Invalid payment signature" }, 400);
      const pr = await rzApi(`/payments/${razorpay_payment_id}`);
      const pay = pr.ok ? await pr.json() : null;
      if (!pay || !["captured", "authorized"].includes(pay.status)) return json({ message: "Payment not completed" }, 400);
      const { data: dup } = await admin.from("api_subscriptions").select("id").eq("payment_id", razorpay_payment_id).maybeSingle();
      if (dup) return json({ status: "success" });
      // Extend from the current paid-until date if still active, else from now
      const { data: cur } = await admin.from("api_subscriptions").select("expires_at").eq("user_id", user.id)
        .eq("status", "active").order("expires_at", { ascending: false }).limit(1).maybeSingle();
      const base = cur?.expires_at && new Date(cur.expires_at).getTime() > Date.now() ? new Date(cur.expires_at).getTime() : Date.now();
      const amount = Math.round(Number(pay.amount) / 100);
      const { error } = await admin.from("api_subscriptions").insert({
        user_id: user.id, subscription_id: razorpay_order_id, plan_name: "Developer API (manual)", amount, interval: "monthly",
        requests_per_hour: 1000000, status: "active", payment_mode: "manual", payment_id: razorpay_payment_id,
        activated_at: new Date().toISOString(), expires_at: new Date(base + 30 * DAY).toISOString(),
      });
      if (error) return json({ message: error.message }, 500);
      try {
        const { email, name } = await resolveUserEmail(admin, user.id);
        await sendPaymentReceiptEmail(admin, email || user.email || null, name, { paymentType: "API Subscription", planName: "Developer API (1 month)", amountInr: amount, paymentId: razorpay_payment_id });
      } catch (e) { console.error("[api-sub] receipt email failed:", e); }
      return json({ status: "success" });
    }

    // ---------- VERIFY: activate subscription after Razorpay checkout ----------
    if (action === "verify") {
      const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = reqBody || {};
      if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
        return json({ message: "Missing payment verification parameters" }, 400);
      }
      const expected = await hmacHex(keySecret, `${razorpay_payment_id}|${razorpay_subscription_id}`);
      if (expected !== razorpay_signature) return json({ message: "Invalid payment signature" }, 400);

      const { error: updateError } = await admin
        .from("api_subscriptions")
        .update({ status: "active", payment_id: razorpay_payment_id, activated_at: new Date().toISOString(), expires_at: await periodEnd(razorpay_subscription_id) })
        .eq("subscription_id", razorpay_subscription_id)
        .eq("user_id", user.id);
      if (updateError) return json({ message: `Failed to activate subscription: ${updateError.message}` }, 500);

      // Receipt email (best-effort)
      try {
        const { data: sub } = await admin.from("api_subscriptions").select("amount, plan_name")
          .eq("subscription_id", razorpay_subscription_id).maybeSingle();
        const { email, name } = await resolveUserEmail(admin, user.id);
        await sendPaymentReceiptEmail(admin, email || user.email || null, name, {
          paymentType: "API Subscription",
          planName: sub?.plan_name || "Developer API",
          amountInr: Number(sub?.amount) || 0,
          paymentId: razorpay_payment_id,
        });
      } catch (e) { console.error("[api-sub] receipt email failed:", e); }

      return json({ status: "success" });
    }

    // ---------- CREATE: start Razorpay subscription (₹1 now, plan after trial) ----------
    const { data: settings } = await admin.from("app_settings").select("setting_key,setting_value")
      .in("setting_key", ["api_subscription_price", "api_trial_days"]);
    const get = (k: string, d: number) => Number(settings?.find((s) => s.setting_key === k)?.setting_value ?? d);
    const price = Math.max(1, Math.round(get("api_subscription_price", 500)));
    const trialDays = Math.max(0, Math.round(get("api_trial_days", 30)));

    const { data: subs } = await admin.from("api_subscriptions").select("status,expires_at,payment_mode").eq("user_id", user.id);
    if (subs?.some((s) => s.status === "active" && s.payment_mode !== "manual" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now()))) return json({ message: "You already have an active API subscription" }, 400);
    const hadPaidBefore = subs?.some((s) => s.status !== "created");
    const trial = !hadPaidBefore && trialDays > 0;

    const rz = (path: string, body?: unknown) => fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    // One Razorpay plan per price, cached in app_settings
    const planKey = `api_subscription_plan_${price}`;
    const { data: planRow } = await admin.from("app_settings").select("setting_value").eq("setting_key", planKey).maybeSingle();
    let planId = planRow?.setting_value;
    if (!planId) {
      const r = await rz("/plans", { period: "monthly", interval: 1, item: { name: "Developer API Access", amount: price * 100, currency: "INR" } });
      if (!r.ok) return json({ message: `Failed to create plan: ${await r.text()}` }, 502);
      planId = (await r.json()).id;
      await admin.from("app_settings").insert({ setting_key: planKey, setting_value: planId, description: "Razorpay plan for API subscription" });
    }

    const body: Record<string, unknown> = {
      plan_id: planId, quantity: 1, total_count: 120, customer_notify: 1,
      notes: { user_id: user.id, product: "developer_api" },
    };
    // Razorpay docs: future start_at + upfront addon = ₹1 charged now (authorizes auto-pay), plan starts after trial
    if (trial) {
      body.start_at = Math.floor(Date.now() / 1000) + trialDays * 86400;
      body.addons = [{ item: { name: "First month access", amount: 100, currency: "INR" } }];
    }
    const r = await rz("/subscriptions", body);
    if (!r.ok) return json({ message: `Failed to create subscription: ${await r.text()}` }, 502);
    const sub = await r.json();

    const { error } = await admin.from("api_subscriptions").insert({
      user_id: user.id, subscription_id: sub.id, plan_id: planId, plan_name: "Developer API",
      amount: price, interval: "monthly", requests_per_hour: 1000000, status: "created",
    });
    if (error) return json({ message: error.message }, 500);

    return json({ subscription_id: sub.id, key: keyId, amount: price, trial, trial_days: trial ? trialDays : 0, plan_name: "Developer API" });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
