// Owner-only PayPal actions served from the paypal-webhook function (function-count cap).
// wallet: ledger built from verified PayPal events (credits minus refunds, reversals and payouts).
// refund: refunds a captured payment through PayPal's v2 captures API.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Credits: money coming into the PayPal balance. Failed/returned/unclaimed payouts
// come back into the balance, so they credit back what SUCCEEDED debited.
const CREDIT = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
]);
// Debits: money leaving the PayPal balance (refunds, reversals, successful payouts).
const DEBIT = new Set([
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
  "PAYMENT.SALE.REVERSED",
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
]);
export const REFUND_WINDOW_DAYS = 7;

// deno-lint-ignore no-explicit-any
function amountOf(type: string, resource: any): { cents: number; currency: string } | null {
  const a = type.startsWith("PAYMENT.PAYOUTS-ITEM") ? resource?.payout_item?.amount : resource?.amount;
  const raw = a?.value ?? a?.total;
  const currency = a?.currency_code ?? a?.currency;
  const value = Number(raw);
  if (!currency || !Number.isFinite(value)) return null;
  let cents = Math.round(value * 100);
  // Payout fees also leave the PayPal balance.
  if (type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") {
    const fee = Number(resource?.payout_item_fee?.value);
    if (Number.isFinite(fee)) cents += Math.round(fee * 100);
  }
  return { cents, currency };
}

// deno-lint-ignore no-explicit-any
async function requireOwner(admin: any, req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return "Please sign in again.";
  const { data: { user }, error } = await admin.auth.getUser(auth.slice(7));
  if (error || !user) return "Please sign in again.";
  const { data: row } = await admin.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  return row?.role === "owner" ? null : "Only the owner can use PayPal wallet actions.";
}

// deno-lint-ignore no-explicit-any
async function wallet(admin: any) {
  // Stored balances keep the running total so we never recount from zero.
  const { data: storedRows, error: storedErr } = await admin
    .from("paypal_wallet_balances").select("*");
  if (storedErr) return json({ error: "Could not read the saved PayPal wallet balance." }, 500);

  const totals = new Map<string, { credited: number; debited: number }>();
  let since: string | null = null;
  for (const row of storedRows ?? []) {
    totals.set(row.currency, { credited: Number(row.credited_cents), debited: Number(row.debited_cents) });
    if (row.last_event_created_at && (!since || row.last_event_created_at > since)) since = row.last_event_created_at;
  }

  // Only fold in events newer than the last saved one; on first run, count everything.
  const seen = new Set<string>();
  let latest = since;
  for (let offset = 0; ; offset += 1000) {
    let q = admin.from("payment_events").select("event_id,event_type,payload,created_at")
      .eq("provider", "paypal").in("event_type", [...CREDIT, ...DEBIT])
      .order("created_at", { ascending: true }).range(offset, offset + 999);
    if (since) q = q.gt("created_at", since);
    const { data, error } = await q;
    if (error) return json({ error: "Could not calculate the PayPal wallet balance." }, 500);
    for (const row of data ?? []) {
      const resource = row.payload?.resource ?? {};
      const amt = amountOf(row.event_type, resource);
      if (amt) {
        const id = `${row.event_type}:${String(resource.id ?? resource.payout_item_id ?? row.event_id)}`;
        if (!seen.has(id)) {
          seen.add(id);
          const t = totals.get(amt.currency) ?? { credited: 0, debited: 0 };
          if (CREDIT.has(row.event_type)) t.credited += amt.cents; else t.debited += amt.cents;
          totals.set(amt.currency, t);
        }
      }
      if (row.created_at && (!latest || row.created_at > latest)) latest = row.created_at;
    }
    if ((data?.length ?? 0) < 1000) break;
  }

  // Persist the updated totals so the next call starts from here.
  const upsertRows = [...totals.entries()].map(([currency, t]) => ({
    currency,
    balance_cents: t.credited - t.debited,
    credited_cents: t.credited,
    debited_cents: t.debited,
    last_event_created_at: latest,
    updated_at: new Date().toISOString(),
  }));
  if (upsertRows.length) {
    const { error: upErr } = await admin.from("paypal_wallet_balances").upsert(upsertRows);
    if (upErr) console.error("[paypal-webhook] wallet save failed", upErr.message);
  }

  const balances: Record<string, { balance: number; credited: number; debited: number }> = {};
  for (const [currency, t] of totals) {
    balances[currency] = { balance: t.credited - t.debited, credited: t.credited, debited: t.debited };
  }
  return json({ balances });
}

// deno-lint-ignore no-explicit-any
async function refund(admin: any, params: any, token: string, base: string) {
  const captureId = String(params?.capture_id ?? "");
  const amount = Number(params?.amount);
  const note = String(params?.reason ?? "").slice(0, 250);
  if (!/^[A-Z0-9]{8,30}$/.test(captureId)) return json({ error: "Invalid PayPal capture id." }, 400);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a valid refund amount." }, 400);

  const { data: rows } = await admin.from("payment_events").select("payload,created_at")
    .eq("provider", "paypal").eq("event_type", "PAYMENT.CAPTURE.COMPLETED").eq("payload->resource->>id", captureId).limit(1);
  const capture = rows?.[0]?.payload?.resource;
  if (!capture) return json({ error: "This payment was not found in PayPal events." }, 404);
  const created = Date.parse(capture.create_time ?? rows[0].created_at);
  if (!created || Date.now() - created > REFUND_WINDOW_DAYS * 86400000) return json({ error: `PayPal refunds are only allowed within ${REFUND_WINDOW_DAYS} days.` }, 400);
  const currency = capture.amount?.currency_code;
  if (amount > Number(capture.amount?.value)) return json({ error: "Refund is more than the paid amount." }, 400);

  const r = await fetch(`${base}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({ amount: { value: amount.toFixed(2), currency_code: currency }, ...(note ? { note_to_payer: note } : {}) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[paypal-webhook] refund failed", r.status, JSON.stringify(d));
    const msg = d?.details?.[0]?.description || d?.message || "PayPal did not accept the refund.";
    return json({ error: msg }, 400);
  }
  return json({ success: true, refund: { id: d.id, status: d.status, amount: amount.toFixed(2), currency } });
}

// deno-lint-ignore no-explicit-any
export async function handleOwnerAction(req: Request, admin: any, getToken: () => Promise<{ token: string; base: string }>) {
  const denied = await requireOwner(admin, req);
  if (denied) return json({ error: denied }, denied.startsWith("Please") ? 401 : 403);
  const body = await req.json().catch(() => ({}));
  if (body?.action === "wallet") {
    // Prefer PayPal's live account balance (includes manual top-ups); fall back to event totals.
    try {
      const { token, base } = await getToken();
      const r = await fetch(`${base}/v1/reporting/balances?include_crypto=false`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d?.balances)) {
        const balances: Record<string, { balance: number }> = {};
        for (const b of d.balances) {
          const cur = b?.currency || b?.total_balance?.currency_code;
          const val = Number(b?.total_balance?.value ?? b?.available_balance?.value ?? 0);
          if (cur) balances[cur] = { balance: Math.round(val * 100) };
        }
        return json({ balances, source: "live" });
      }
      console.warn("[paypal-webhook] live balance unavailable", r.status, JSON.stringify(d));
    } catch (e) { console.warn("[paypal-webhook] live balance error", e); }
    return await wallet(admin);
  }
  if (body?.action === "refund") {
    const { token, base } = await getToken();
    return await refund(admin, body, token, base);
  }
  return json({ error: "Invalid action" }, 400);
}
