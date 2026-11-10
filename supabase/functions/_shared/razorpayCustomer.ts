// Razorpay Customers API: one Razorpay customer per website user (per test/live mode), reused for every order.
// Customer records only hold name/email/contact/notes — saved cards/UPI (tokenisation) are a separate Razorpay feature.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function creds() {
  const id = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!id || !secret) return null;
  return { auth: `Basic ${btoa(`${id}:${secret}`)}`, mode: id.startsWith("rzp_test_") ? "test" : "live" };
}

async function rzp(path: string, auth: string, body: unknown, tries = 3) {
  let last: { ok: boolean; status: number; data: any } = { ok: false, status: 0, data: {} };
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://api.razorpay.com/v1${path}`, {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      last = { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
      if (res.ok || (res.status < 500 && res.status !== 429)) return last; // only retry 5xx / 429 / network
    } catch (e) { last = { ok: false, status: 0, data: { error: { description: String(e) } } }; }
    await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  return last;
}

const cleanContact = (v?: string | null) => {
  const d = String(v || "").replace(/[^\d+]/g, "");
  return d.length >= 8 && d.length <= 15 ? d : undefined;
};

/** Location stored on the Razorpay customer as notes (Razorpay customers have no address field). */
export const locationNotes = (pay: any, prof?: any) => {
  const out: Record<string, string> = {};
  const pick = (k: string) => String(pay?.[k] || prof?.[k === "address" ? "precise_address" : k] || "").slice(0, 250);
  for (const k of ["address", "city", "state", "country", "postal_code"]) { const v = pick(k); if (v) out[k] = v; }
  return out;
};

const COUNTRY_CODES: Record<string, string> = { india: "IN", "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB", "united arab emirates": "AE", uae: "AE", nepal: "NP", bangladesh: "BD", canada: "CA", australia: "AU", singapore: "SG" };
const countryCode = (v?: string | null) => {
  const s = String(v || "").trim(); if (!s) return "IN";
  return s.length === 2 ? s.toUpperCase() : COUNTRY_CODES[s.toLowerCase()] || "IN";
};

/** Billing address shown in Razorpay Dashboard → Customers → Edit customer. Never throws. */
export async function pushBillingAddress(auth: string, customerId: string, pay: any, type = "billing_address", primary = true) {
  try {
    if (!pay?.address || !pay?.city) return false;
    const addr = String(pay.address);
    const body = {
      type, primary,
      line1: addr.slice(0, 100), line2: addr.length > 100 ? addr.slice(100, 200) : undefined,
      city: String(pay.city).slice(0, 50), state: String(pay.state || "").slice(0, 50),
      zipcode: String(pay.postal_code || "").slice(0, 10), country: countryCode(pay.country).toLowerCase(),
      name: pay.name ? String(pay.name).slice(0, 50) : undefined, contact: cleanContact(pay.mobile),
    };
    const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}/addresses`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    const txt = await res.text().catch(() => "");
    if (!res.ok) console.error("[razorpayCustomer] address push failed", res.status, txt);
    else console.log("[razorpayCustomer] address pushed", customerId);
    return res.ok;
  } catch (e) { console.error("[razorpayCustomer] address error", e); return false; }
}

/** Push updated payment profile (name/contact/location) to the existing Razorpay customer. Never throws. */
export async function syncRazorpayCustomer(user: { id: string; email?: string | null }, customerId: string) {
  try {
    const c = creds(); if (!c) return false;
    const { data: pay } = await adminClient().from("payment_profiles").select("name,mobile,address,city,state,country,postal_code,gstin,shipping_address").eq("user_id", user.id).maybeSingle();
    if (!pay) return false;
    const body: any = { notes: { user_id: user.id, source: "website", ...locationNotes(pay) } };
    if (pay.name) body.name = String(pay.name).replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 50);
    const contact = cleanContact(pay.mobile); if (contact) body.contact = contact;
    if (user.email) body.email = user.email;
    if (pay.gstin) body.gstin = String(pay.gstin).toUpperCase();
    const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}`, { method: "PUT", headers: { Authorization: c.auth, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) console.error("[razorpayCustomer] sync failed", res.status, await res.text().catch(() => ""));
    // Replacing (not appending) the same-type address keeps the customer's address list duplicate-free on every save.
    await replaceAddress(c.auth, customerId, pay, "billing_address", true);
    if (pay.shipping_address?.address && pay.shipping_address?.city) {
      await replaceAddress(c.auth, customerId, { ...pay.shipping_address, name: pay.shipping_address.name || pay.name, mobile: pay.mobile }, "shipping_address", true);
    }
    return res.ok;
  } catch (e) { console.error("[razorpayCustomer] sync error", e); return false; }
}

/** Deletes the customer's existing addresses of this type, then pushes the fresh one. Never throws. */
async function replaceAddress(auth: string, customerId: string, pay: any, type: string, primary: boolean) {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}/addresses`, {
      headers: { Authorization: auth }, signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      for (const item of data.items || []) {
        if (item.type === type && item.id) {
          await fetch(`https://api.razorpay.com/v1/customers/${customerId}/addresses/${item.id}`, {
            method: "DELETE", headers: { Authorization: auth }, signal: AbortSignal.timeout(10_000),
          }).catch(() => null);
        }
      }
    }
  } catch (e) { console.error("[razorpayCustomer] list/delete addresses failed", e); }
  await pushBillingAddress(auth, customerId, pay, type, primary);
}

/** Returns the user's Razorpay customer_id, creating it once. Never throws; null means "continue without customer". */
export async function ensureRazorpayCustomer(user: { id: string; email?: string | null }): Promise<string | null> {
  try {
    const c = creds();
    if (!c) return null;
    const admin = adminClient();
    const { data: row } = await admin.from("razorpay_customers").select("*").eq("user_id", user.id).eq("mode", c.mode).maybeSingle();
    if (row?.customer_id) return row.customer_id;
    if (row?.status === "creating" && Date.now() - new Date(row.updated_at).getTime() < 30_000) return null; // parallel request in progress

    const { data: prof } = await admin.from("profiles").select("full_name,email,phone,whatsapp_number,precise_address,city,state,country,postal_code").eq("user_id", user.id).maybeSingle();
    const { data: pay } = await admin.from("payment_profiles").select("name,mobile,address,city,state,country,postal_code").eq("user_id", user.id).maybeSingle();
    const name = String(pay?.name || prof?.full_name || "Customer").replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 50) || "Customer";
    const email = prof?.email || user.email || undefined;
    const contact = cleanContact(pay?.mobile) || cleanContact(prof?.phone) || cleanContact(prof?.whatsapp_number);

    // Claim the row first (unique user_id+mode) so two parallel checkouts cannot create two customers.
    if (!row) {
      const { error } = await admin.from("razorpay_customers").insert({ user_id: user.id, mode: c.mode, name, email, contact, status: "creating" });
      if (error) {
        const { data: again } = await admin.from("razorpay_customers").select("customer_id").eq("user_id", user.id).eq("mode", c.mode).maybeSingle();
        return again?.customer_id ?? null;
      }
    } else {
      await admin.from("razorpay_customers").update({ status: "creating", name, email, contact }).eq("id", row.id);
    }

    // fail_existing: "0" → Razorpay returns the existing customer for the same email+contact instead of erroring.
    const res = await rzp("/customers", c.auth, {
      name, email, contact, fail_existing: "0", notes: { user_id: user.id, source: "website", ...locationNotes(pay, prof) },
    });
    if (!res.ok || !res.data?.id) {
      const msg = res.data?.error?.description || `Razorpay error ${res.status}`;
      await admin.from("razorpay_customers").update({ status: "error", last_error: msg, attempts: (row?.attempts ?? 0) + 1 }).eq("user_id", user.id).eq("mode", c.mode);
      console.error("[razorpayCustomer] create failed", res.status, msg);
      return null;
    }
    const { error: upErr } = await admin.from("razorpay_customers")
      .update({ customer_id: res.data.id, status: "active", last_error: null })
      .eq("user_id", user.id).eq("mode", c.mode);
    if (upErr) { console.error("[razorpayCustomer] save failed", upErr.message); return null; }
    await pushBillingAddress(c.auth, res.data.id, {
      name, mobile: contact, address: pay?.address || prof?.precise_address, city: pay?.city || prof?.city,
      state: pay?.state || prof?.state, country: pay?.country || prof?.country, postal_code: pay?.postal_code || prof?.postal_code,
    });
    return res.data.id;
  } catch (e) {
    console.error("[razorpayCustomer] ensure failed (non-blocking)", e);
    return null;
  }
}

/** Record the user ↔ customer ↔ order link right after an order is created. Never throws. */
export async function linkRazorpayOrder(args: { userId: string; customerId: string | null; orderId: string; amount: number; currency?: string; purpose: string }) {
  try {
    await adminClient().from("razorpay_customer_payments").upsert({
      user_id: args.userId, customer_id: args.customerId, order_id: args.orderId, amount: args.amount,
      currency: args.currency || "INR", purpose: args.purpose, status: "created",
    }, { onConflict: "order_id", ignoreDuplicates: true });
  } catch (e) { console.error("[razorpayCustomer] link order failed", e); }
}

/** Webhook-only: the final, verified payment status for an order (idempotent by order_id / payment_id). */
export async function applyPaymentToCustomerLink(admin: any, type: string, payment: any) {
  if (!payment?.order_id) return;
  const patch: Record<string, unknown> = {
    payment_id: payment.id, method: payment.method || null, amount: payment.amount ?? null,
    currency: payment.currency || "INR", status: payment.status, webhook_verified: true, last_event: type,
    error_code: payment.error_code || null, error_description: payment.error_description || null,
  };
  if (payment.customer_id) patch.customer_id = payment.customer_id;
  const { data } = await admin.from("razorpay_customer_payments").update(patch).eq("order_id", payment.order_id).select("id");
  if (!data?.length) {
    // Order created by a flow not yet linked: still record it when the owner is known from notes.
    const userId = payment.notes?.user_id || payment.notes?.ref;
    if (userId) await admin.from("razorpay_customer_payments").upsert({ ...patch, user_id: userId, order_id: payment.order_id }, { onConflict: "order_id" });
  }
}
