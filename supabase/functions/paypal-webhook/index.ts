import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getOwnerSecret } from "../_shared/ownerSecrets.ts";
import { sendPayPalStatusEmail } from "../_shared/paypalStatusEmail.ts";
import { handleOwnerAction } from "./ownerActions.ts";

// PayPal webhook receiver.
// PayPal dashboard → your app → Webhooks → add this URL:
//   https://jubwzelupbntbetpajqb.supabase.co/functions/v1/paypal-webhook
// Required secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID,
// optional PAYPAL_MODE ("sandbox" | "live", default live).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Owner Portal Secrets page values win; edge env vars are only a fallback.
async function paypalConfig() {
  const [oId, oSecret, oHook, oMode] = await Promise.all([
    getOwnerSecret("PAYPAL_CLIENT_ID"),
    getOwnerSecret("PAYPAL_CLIENT_SECRET"),
    getOwnerSecret("PAYPAL_WEBHOOK_ID"),
    getOwnerSecret("PAYPAL_MODE"),
  ]);
  const clientId = oId || Deno.env.get("PAYPAL_CLIENT_ID") || "";
  const clientSecret = oSecret || Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
  const webhookId = oHook || Deno.env.get("PAYPAL_WEBHOOK_ID") || "";
  const mode = (oMode || Deno.env.get("PAYPAL_MODE") || "live").trim().toLowerCase();
  const base = mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  return { clientId, clientSecret, webhookId, base };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function paypalAccessToken(base: string, clientId: string, clientSecret: string): Promise<string> {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`PayPal auth failed: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.access_token;
}

async function verifySignature(req: Request, rawBody: string, token: string, base: string, webhookId: string): Promise<boolean> {
  if (!webhookId) return false;
  const r = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.headers.get("paypal-auth-algo"),
      cert_url: req.headers.get("paypal-cert-url"),
      transmission_id: req.headers.get("paypal-transmission-id"),
      transmission_sig: req.headers.get("paypal-transmission-sig"),
      transmission_time: req.headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!r.ok) {
    console.error("[paypal-webhook] verify call failed", r.status, await r.text());
    return false;
  }
  const d = await r.json();
  return d.verification_status === "SUCCESS";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  // Owner portal calls (wallet balance / refund) never carry PayPal transmission headers.
  if (!req.headers.get("paypal-transmission-id")) {
    try {
      return await handleOwnerAction(req, createClient(SUPABASE_URL, SERVICE_KEY), async () => {
        const cfg = await paypalConfig();
        if (!cfg.clientId || !cfg.clientSecret) throw new Error("PayPal is not configured");
        return { token: await paypalAccessToken(cfg.base, cfg.clientId, cfg.clientSecret), base: cfg.base };
      });
    } catch (e) {
      console.error("[paypal-webhook] owner action error", e);
      return json({ error: e instanceof Error ? e.message : "PayPal request failed" }, 500);
    }
  }

  try {
    const cfg = await paypalConfig();
    if (!cfg.clientId || !cfg.clientSecret || !cfg.webhookId) {
      console.error("[paypal-webhook] missing secrets");
      return json({ message: "PayPal webhook is not configured" }, 500);
    }

    const rawBody = await req.text();
    const token = await paypalAccessToken(cfg.base, cfg.clientId, cfg.clientSecret);

    const verified = await verifySignature(req, rawBody, token, cfg.base, cfg.webhookId);
    if (!verified) {
      console.error("[paypal-webhook] signature verification failed");
      return json({ message: "Invalid signature" }, 400);
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event_type || "";
    const resource = event.resource || {};
    console.log("[paypal-webhook] event:", eventType, "id:", event.id);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotency: one row per PayPal event id
    const { error: insErr } = await admin.from("payment_events").insert({
      provider: "paypal",
      event_id: event.id,
      event_type: eventType,
      payload: event,
      status: "received",
    });
    if (insErr && insErr.code === "23505") {
      return json({ received: true, duplicate: true });
    }

    // Refund resources point to their capture through the "up" link.
    const captureFromLinks = (r: any): string =>
      String((r?.links || []).find((l: any) => l.rel === "up")?.href || "").split("/captures/")[1]?.split(/[/?]/)[0] || "";
    const stamp = { webhook_verified: true, last_event: eventType, last_event_id: event.id };

    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED":
      case "PAYMENT.CAPTURE.PENDING":
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED": {
        const orderId = resource?.supplementary_data?.related_ids?.order_id || "";
        const captureId = resource.id || "";
        const status = eventType === "PAYMENT.CAPTURE.COMPLETED" ? "captured"
          : eventType === "PAYMENT.CAPTURE.PENDING" ? "pending" : "failed";
        if (orderId) {
          const { data: row } = await admin.from("paypal_payments").select("id,status").eq("paypal_order_id", orderId).maybeSingle();
          // Never move a refunded payment back to captured.
          if (row && !["refunded", "partially_refunded"].includes(row.status)) {
            await admin.from("paypal_payments").update({
              ...stamp, status, capture_id: captureId || undefined,
              captured_at: status === "captured" ? (resource.create_time || new Date().toISOString()) : null,
              error_description: status === "failed" ? (resource?.status_details?.reason || "Payment declined by PayPal") : null,
            }).eq("id", row.id);
            if (status === "captured" && row.status !== "captured") await sendPayPalStatusEmail(admin, "success", row.id);
            if (status === "failed" && row.status !== "failed") await sendPayPalStatusEmail(admin, "failed", row.id);
          }
        }
        console.log("[paypal-webhook] capture", eventType, captureId);
        break;
      }
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.CAPTURE.REVERSED":
      case "PAYMENT.REFUND.PENDING":
      case "PAYMENT.REFUND.FAILED":
      case "PAYMENT.REFUND.CANCELLED": {
        const captureId = captureFromLinks(resource);
        if (!captureId) break;
        const { data: row } = await admin.from("paypal_payments").select("id,amount_usd,refunds").eq("capture_id", captureId).maybeSingle();
        if (!row) break;
        const refundStatus = eventType === "PAYMENT.REFUND.PENDING" ? "pending"
          : eventType === "PAYMENT.REFUND.FAILED" || eventType === "PAYMENT.REFUND.CANCELLED" ? "failed" : "processed";
        const list: any[] = Array.isArray(row.refunds) ? row.refunds : [];
        const prev = list.find((r) => r.id === resource.id);
        const entry = {
          id: resource.id, amount_usd: Number(resource?.amount?.value || 0), currency: resource?.amount?.currency_code || "USD",
          status: refundStatus, created_at: prev?.created_at || resource.create_time || new Date().toISOString(),
          processed_at: refundStatus === "processed" ? (resource.update_time || new Date().toISOString()) : prev?.processed_at || null,
          note: resource.note_to_payer || null, reversal: eventType === "PAYMENT.CAPTURE.REVERSED",
        };
        const refunds = [entry, ...list.filter((r) => r.id !== resource.id)];
        const refundedUsd = refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + Number(r.amount_usd || 0), 0);
        const full = refundedUsd + 0.001 >= Number(row.amount_usd || 0);
        await admin.from("paypal_payments").update({
          ...stamp, refunds, refunded_usd: refundedUsd,
          status: refundedUsd <= 0 ? "captured" : full ? "refunded" : "partially_refunded",
        }).eq("id", row.id);
        if (prev?.status !== entry.status) await sendPayPalStatusEmail(admin, "refund", row.id, entry);
        break;
      }
      case "CHECKOUT.ORDER.VOIDED": {
        if (resource.id) await admin.from("paypal_payments").update({ ...stamp, status: "expired" }).eq("paypal_order_id", resource.id).eq("status", "created");
        break;
      }
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
      case "PAYMENT.SALE.COMPLETED": {
        // Subscription lifecycle events are logged to payment_events above;
        // extend here when PayPal subscriptions are wired to a plan table.
        break;
      }
      default:
        break;
    }

    await admin
      .from("payment_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "paypal")
      .eq("event_id", event.id);

    return json({ received: true });
  } catch (e) {
    console.error("[paypal-webhook] error", e);
    return json({ message: "Webhook handler failed", error: String(e) }, 500);
  }
});
