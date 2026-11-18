import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://worklyindia.devs.surf",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function randomHex(bytes: number) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticatedUser(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

async function deviceFor(req: Request) {
  const token = req.headers.get("x-device-token") ?? "";
  if (token.length < 40 || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const { data, error } = await supabase
    .from("workly_ai_voice_devices")
    .select("id,user_id,revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  return error ? null : data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "Relay is not configured" }, 503);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const db = supabase;

    if (action === "create_pairing") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);

      // 12 random bytes -> 24 hex characters; short-lived and single-use.
      await db.from("workly_ai_voice_pairings").delete().lt("expires_at", new Date().toISOString());
      const code = randomHex(12).toUpperCase();
      const codeHash = await sha256(code);
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

      const { error } = await db.from("workly_ai_voice_pairings").insert({
        user_id: user.id,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
      if (error) throw error;
      return json({ pairing_code: code, expires_at: expiresAt, expires_in_seconds: 300 });
    }

    if (action === "claim_device") {
      const code = typeof body?.pairing_code === "string" ? body.pairing_code.trim().toUpperCase() : "";
      if (!/^[A-F0-9]{24}$/.test(code)) return json({ error: "Invalid or expired pairing code" }, 400);
      const codeHash = await sha256(code);
      const { data: pairing, error: pairingError } = await db.from("workly_ai_voice_pairings")
        .select("id,user_id,expires_at,consumed_at")
        .eq("code_hash", codeHash)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (pairingError || !pairing) return json({ error: "Invalid or expired pairing code" }, 400);

      const deviceToken = randomHex(32);
      const { data: device, error: deviceError } = await db.from("workly_ai_voice_devices")
        .insert({
          user_id: pairing.user_id,
          token_hash: await sha256(deviceToken),
          device_name: String(body?.device_name ?? "Workly AI Voice Android").slice(0, 80),
        })
        .select("id")
        .single();
      if (deviceError) throw deviceError;

      const { data: consumed, error: consumeError } = await db.from("workly_ai_voice_pairings")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", pairing.id)
        .is("consumed_at", null)
        .select("id")
        .maybeSingle();
      if (consumeError || !consumed) {
        await db.from("workly_ai_voice_devices").delete().eq("id", device.id);
        return json({ error: "Pairing code was already used. Generate a new code." }, 409);
      }
      return json({ device_id: device.id, device_token: deviceToken, message: "Device paired. Store this token securely; it will not be shown again." });
    }

    if (action === "create_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const jobType = body?.job_type;
      if (jobType !== "tts" && jobType !== "stt") return json({ error: "job_type must be tts or stt" }, 400);
      const payload = body?.payload;
      const payloadText = JSON.stringify(payload ?? {});
      if (payloadText.length > 20_000) return json({ error: "Payload exceeds 20 KB" }, 413);

      const { data: device, error: deviceError } = await db.from("workly_ai_voice_devices")
        .select("id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .gt("last_seen_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (deviceError || !device) return json({ error: "No paired AI Voice phone is online or registered" }, 404);

      const { data: job, error } = await db.from("workly_ai_voice_jobs")
        .insert({ user_id: user.id, device_id: device.id, job_type: jobType, payload: payload ?? {} })
        .select("id,status,expires_at")
        .single();
      if (error) throw error;
      return json({ job });
    }

    if (action === "get_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const jobId = typeof body?.job_id === "string" ? body.job_id : "";
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job id" }, 400);
      const { data, error } = await db.from("workly_ai_voice_jobs")
        .select("id,status,result,created_at,completed_at,expires_at")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Job not found" }, 404);
      return json({ job: data });
    }

    if (action === "poll") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      await db.from("workly_ai_voice_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

      const { data: candidate, error: findError } = await db.from("workly_ai_voice_jobs")
        .select("id,job_type,payload,expires_at")
        .eq("device_id", device.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      if (!candidate) return json({ job: null, heartbeat_at: new Date().toISOString() });

      const { data: claimed, error: claimError } = await db.from("workly_ai_voice_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", candidate.id)
        .eq("status", "pending")
        .select("id,job_type,payload,expires_at")
        .maybeSingle();
      if (claimError) throw claimError;
      return json({ job: claimed ?? null, heartbeat_at: new Date().toISOString() });
    }

    if (action === "complete_job") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const jobId = typeof body?.job_id === "string" ? body.job_id : "";
      const result = body?.result ?? {};
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job id" }, 400);
      if (JSON.stringify(result).length > 32_000) return json({ error: "Result exceeds 32 KB" }, 413);

      const { data, error } = await db.from("workly_ai_voice_jobs")
        .update({ status: "completed", result, completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("device_id", device.id)
        .eq("status", "running")
        .gt("expires_at", new Date().toISOString())
        .select("id,status")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Job not found, expired, or already completed" }, 404);
      return json({ job: data });
    }

    if (action === "revoke_device") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const deviceId = typeof body?.device_id === "string" ? body.device_id : "";
      const { data, error } = await db.from("workly_ai_voice_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", deviceId)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return json({ revoked: Boolean(data) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("workly-ai-voice-relay error", error);
    return json({ error: "Relay request failed" }, 500);
  }
});
