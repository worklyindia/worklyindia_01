// X (Twitter) webhook endpoint — Account Activity API.
//
// URL: https://<project>.supabase.co/functions/v1/x-webhook
//
// GET  -> CRC challenge (X pings this to validate the URL). Signed with the
//         OAuth 1.0a consumer secret (X_CONSUMER_SECRET).
// POST -> activity events (mentions, replies, DMs, follows). Stored in
//         `social_webhook_events` when that table exists, always logged.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twitter-webhooks-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = (Deno.env.get("X_CONSUMER_SECRET") || Deno.env.get("X_API_SECRET") || "").trim();

  // ---- CRC validation ----
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("crc_token");
    if (!token) return json({ error: "Missing crc_token" }, 400);
    if (!secret) return json({ error: "X_CONSUMER_SECRET is not configured" }, 500);
    return json({ response_token: `sha256=${await hmacSha256Base64(secret, token)}` });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();

  // ---- Signature check (skipped only when no secret is configured) ----
  if (secret) {
    const provided = req.headers.get("x-twitter-webhooks-signature") || "";
    const expected = `sha256=${await hmacSha256Base64(secret, raw)}`;
    if (provided !== expected) {
      console.error("[x-webhook] invalid signature");
      return json({ error: "Invalid signature" }, 401);
    }
  }

  let payload: Record<string, unknown> = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }

  const eventType = Object.keys(payload).find((k) => k.endsWith("_events")) || "unknown";
  console.log(`[x-webhook] event=${eventType}`);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    await admin.from("social_webhook_events").insert({
      platform: "x",
      event_type: eventType,
      account_id: String((payload as any).for_user_id || ""),
      payload,
    });
  } catch (e) {
    // Table may not exist yet — never fail the webhook, X disables endpoints
    // that keep returning errors.
    console.error("[x-webhook] store failed:", e instanceof Error ? e.message : e);
  }

  return json({ success: true });
});
