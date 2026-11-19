import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://worklyindia.devs.surf",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ownerUserId = Deno.env.get("WORKLY_AI_VOICE_OWNER_USER_ID") ?? "";
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
  if (!supabaseUrl || !serviceKey || !ownerUserId) return json({ error: "Relay owner setup is required" }, 503);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const db = supabase;
    const now = new Date().toISOString();
    // Keep relay data short-lived even when the website stops polling.
    await db.from("workly_ai_voice_jobs").delete().lt("expires_at", now);

    if (action === "register_device") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Please sign in with your Workly India account in the app." }, 401);
      if (user.id !== ownerUserId) return json({ error: "Only the owner can register the shared voice phone." }, 403);

      // One active phone per account: replace older active registrations safely.
      await db.from("workly_ai_voice_devices")
        .update({ revoked_at: now })
        .eq("user_id", ownerUserId)
        .is("revoked_at", null);

      const deviceToken = randomHex(32);
      const { data: device, error } = await db.from("workly_ai_voice_devices")
        .insert({
          user_id: ownerUserId,
          token_hash: await sha256(deviceToken),
          device_name: String(body?.device_name ?? "Workly Voice Android").slice(0, 80),
        })
        .select("id")
        .single();
      if (error) throw error;
      return json({
        device_id: device.id,
        device_token: deviceToken,
        message: "This phone is securely connected to your Workly India account."
      });
    }

    if (action === "create_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const jobType = body?.job_type;
      if (jobType !== "tts" && jobType !== "stt") return json({ error: "job_type must be tts or stt" }, 400);
      const payload = body?.payload;
      const payloadText = JSON.stringify(payload ?? {});
      if (payloadText.length > 20_000) return json({ error: "Payload exceeds 20 KB" }, 413);

      await db.from("workly_ai_voice_jobs").delete().lt("expires_at", new Date().toISOString());
      const { data: device, error: deviceError } = await db.from("workly_ai_voice_devices")
        .select("id")
        .eq("user_id", ownerUserId)
        .is("revoked_at", null)
        .gt("last_seen_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (deviceError || !device) return json({ error: "The shared Workly Voice phone is offline or not registered." }, 404);
      const { count: activeJobs, error: countError } = await db.from("workly_ai_voice_jobs")
        .select("id", { count: "exact", head: true })
        .eq("device_id", device.id)
        .in("status", ["pending", "running"])
        .gt("expires_at", new Date().toISOString());
      if (countError) throw countError;
      if ((activeJobs ?? 0) >= 20) return json({ error: "Shared voice queue is full. Try again shortly." }, 429);

      const { data: job, error } = await db.from("workly_ai_voice_jobs")
        .insert({ user_id: user.id, device_id: device.id, job_type: jobType, payload: payload ?? {} })
        .select("id,status,expires_at")
        .single();
      if (error) throw error;
      return json({ job, queue_position: (activeJobs ?? 0) + 1 });
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

    if (action === "fail_job") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const jobId = typeof body?.job_id === "string" ? body.job_id : "";
      const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : "Voice request failed";
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job id" }, 400);
      const { data, error } = await db.from("workly_ai_voice_jobs")
        .update({ status: "failed", result: { error: reason }, completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("device_id", device.id)
        .eq("status", "running")
        .select("id,status")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Job not found or already finished" }, 404);
      return json({ job: data });
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

    if (action === "list_devices") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const { data, error } = await db.from("workly_ai_voice_devices")
        .select("id,device_name,last_seen_at,created_at,revoked_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return json({ devices: data ?? [] });
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
