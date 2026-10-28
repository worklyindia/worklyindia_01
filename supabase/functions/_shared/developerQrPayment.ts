// Dynamic Razorpay UPI QR for Developer API payments (extra calls + manual month).
// The QR's notes carry the Razorpay order id; crediting re-checks order, user, product
// and exact amount against Razorpay, and dedupes by payment id so webhook + polling
// can never double-credit.
import { resolveUserEmail, sendPaymentReceiptEmail } from "./paymentReceiptEmail.ts";

export const QR_PRODUCTS = ["developer_api_calls", "developer_api_manual"];

/** Who an order belongs to: Developer orders use notes.user_id, other website orders notes.ref. */
export function orderOwner(order: any): string | null {
  return order?.notes?.user_id || order?.notes?.ref || null;
}
/** QR / Payment Request work for every website order the user owns (or ownerless, e.g. donations). */
export function canUseQr(order: any, userId: string): boolean {
  if (!order?.id) return false;
  const owner = orderOwner(order);
  return !owner || owner === userId;
}
const DAY = 86400000;
export const QR_TTL_SECONDS = 300; // QR is payable for exactly 5 minutes
const LATE_GRACE_SECONDS = 15; // clock skew allowance only

/** Closes the QR on Razorpay so it can never be paid again (idempotent). */
export async function closeQr(rz: any, qr: any): Promise<void> {
  if (!qr?.id || qr.status === "closed") return;
  try {
    const r = await rz(`/payments/qr_codes/${qr.id}/close`, {});
    if (!r.ok) console.error("[qr] close failed", r.status, await r.text());
  } catch (e) { console.error("[qr] close error", e); }
}

export function makeRz(keyId: string, keySecret: string) {
  return (path: string, body?: unknown) => fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

type Rz = ReturnType<typeof makeRz>;

/** Credits a captured QR payment. Returns true when credited (or already credited). */
export async function creditDeveloperQrPayment(admin: any, rz: Rz, qr: any, payment: any): Promise<boolean> {
  const orderId = qr?.notes?.order_id;
  const userId = qr?.notes?.user_id;
  if (!orderId || !userId || !payment?.id) return false;
  if (payment.status !== "captured") return false;
  if (Number(payment.amount) !== Number(qr.payment_amount)) return false;
  // Server-side expiry: a payment made after the 5-minute window is refunded, never credited.
  const closeBy = Number(qr.close_by || 0);
  if (closeBy && Number(payment.created_at || 0) > closeBy + LATE_GRACE_SECONDS) {
    console.warn("[qr] late payment, refunding", payment.id);
    const { data: done } = await admin.from("razorpay_events").select("id").eq("payment_id", payment.id).eq("event_type", "qr_late_refund").maybeSingle();
    if (!done) {
      const rr = await rz(`/payments/${payment.id}/refund`, { notes: { reason: "QR expired (5 min)" } });
      if (rr.ok) await admin.from("razorpay_events").insert({ event_type: "qr_late_refund", payment_id: payment.id, order_id: orderId, payload: { qr_id: qr.id } });
      else console.error("[qr] refund failed", rr.status, await rr.text());
    }
    await closeQr(rz, qr);
    return false;
  }
  const or = await rz(`/orders/${orderId}`);
  const order = or.ok ? await or.json() : null;
  if (!order || !canUseQr(order, userId)) return false;
  if (Number(order.amount) !== Number(payment.amount)) return false;
  // Other website payments: the page's own verify step credits them using the
  // server-signed order|payment params returned after this check.
  if (!QR_PRODUCTS.includes(order.notes?.product)) return true;
  const amount = Number(order.amount) / 100;

  if (order.notes.product === "developer_api_calls") {
    const calls = Math.floor(Number(order.notes.calls));
    const { data: dup } = await admin.from("api_call_purchases").select("id").eq("payment_id", payment.id).maybeSingle();
    if (dup) return true;
    const { error } = await admin.rpc("add_purchased_api_calls", { _user_id: userId, _calls: calls, _amount: amount, _order_id: orderId, _payment_id: payment.id, _source: "purchase" });
    if (error) throw new Error(error.message);
    await receipt(admin, userId, "API Calls", `${calls.toLocaleString("en-IN")} extra API calls`, amount, payment.id);
    return true;
  }

  const { data: dup } = await admin.from("api_subscriptions").select("id").eq("payment_id", payment.id).maybeSingle();
  if (dup) return true;
  const { data: cur } = await admin.from("api_subscriptions").select("expires_at").eq("user_id", userId)
    .eq("status", "active").order("expires_at", { ascending: false }).limit(1).maybeSingle();
  const base = cur?.expires_at && new Date(cur.expires_at).getTime() > Date.now() ? new Date(cur.expires_at).getTime() : Date.now();
  const { error } = await admin.from("api_subscriptions").insert({
    user_id: userId, subscription_id: orderId, plan_name: "Developer API (manual)", amount: Math.round(amount), interval: "monthly",
    requests_per_hour: 1000000, status: "active", payment_mode: "manual", payment_id: payment.id,
    activated_at: new Date().toISOString(), expires_at: new Date(base + 30 * DAY).toISOString(),
  });
  if (error) {
    if (error.code === "23505") return true; // credited by a parallel call
    throw new Error(error.message);
  }
  await receipt(admin, userId, "API Subscription", "Developer API (1 month)", Math.round(amount), payment.id);
  return true;
}

async function receipt(admin: any, userId: string, type: string, plan: string, amount: number, paymentId: string) {
  try {
    const { email, name } = await resolveUserEmail(admin, userId);
    await sendPaymentReceiptEmail(admin, email || null, name, { paymentType: `${type} (UPI QR)`, planName: plan, amountInr: amount, paymentId });
  } catch (e) { console.error("[qr] receipt email failed:", e); }
}
