import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "https://worklyindia.devs.surf",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ownerUserId = Deno.env.get("WORKLY_AI_VOICE_OWNER_USER_ID") ?? "";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value
    .replace(/Bearer\\s+[A-Za-z0-9._~+\\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/\\+?\\d[\\d\\s().-]{7,}\\d/g, "[PHONE]")
    .slice(0, max)
    .trim();
  return result || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!url || !serviceKey || !ownerUserId) return json({ error: "Diagnostics service is not configured" }, 503);

  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: "Diagnostic event is too large" }, 413);
    const body = JSON.parse(raw);
    const token = req.headers.get("x-device-token") ?? "";
    if (token.length < 40 || token.length > 200) return json({ error: "Device authentication failed" }, 401);

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: device, error: deviceError } = await db
      .from("workly_ai_voice_devices")
      .select("id,user_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (deviceError || !device || device.user_id !== ownerUserId) {
      return json({ error: "Device authentication failed" }, 401);
    }

    const allowedEvents = new Set([
      "relay_online", "relay_error", "model_warmup_failed",
      "tts_started", "tts_synthesis_complete", "tts_upload_complete", "tts_failed"
    ]);
    const eventType = typeof body?.event_type === "string" ? body.event_type : "";
    if (!allowedEvents.has(eventType)) return json({ error: "Unsupported diagnostic event" }, 400);

    const numeric = (value: unknown, max: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value) : null;
    const rawJobId = typeof body?.job_id === "string" ? body.job_id : "";
    const jobId = /^[0-9a-f-]{36}$/i.test(rawJobId) ? rawJobId : null;

    const { error } = await db.from("workly_ai_voice_diagnostics").insert({
      device_id: device.id,
      job_id: jobId,
      event_type: eventType,
      language: safeText(body?.language, 24),
      duration_ms: numeric(body?.duration_ms, 3600000),
      audio_bytes: numeric(body?.audio_bytes, 2000000),
      error_type: safeText(body?.error_type, 120),
      error_message: safeText(body?.error_message, 800),
      app_version: safeText(body?.app_version, 40),
      android_version: safeText(body?.android_version, 40),
      device_model: safeText(body?.device_model, 100),
      metadata: {}
    });
    if (error) throw error;
    return json({ recorded: true });
  } catch (error) {
    console.error("[chatwork-diagnostics] event rejected", error);
    return json({ error: "Could not record diagnostic event" }, 500);
  }
});
