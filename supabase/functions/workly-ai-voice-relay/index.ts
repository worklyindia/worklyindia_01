import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    .select("id,user_id,revoked_at,last_seen_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  return error ? null : data;
}

function historyPayload(payload: any, jobType: string) {
  const text = typeof payload?.text === "string" ? payload.text : "";
  return {
    ...(typeof payload?.languageTag === "string" ? { languageTag: payload.languageTag } : {}),
    ...(typeof payload?.language === "string" ? { language: payload.language } : {}),
    ...(typeof payload?.voice === "string" ? { voice: payload.voice } : {}),
    ...(text ? { text_length: text.length } : {}),
    ...(jobType === "stt" && typeof payload?.content_type === "string" ? { content_type: payload.content_type } : {}),
  };
}

async function cleanupExpiredJobs(db: any, now: string) {
  const { data: expiredJobs, error } = await db.from("workly_ai_voice_jobs")
    .select("id,status,job_type,result,payload")
    .lt("expires_at", now)
    .limit(100);
  if (error) throw error;

  for (const row of expiredJobs ?? []) {
    const paths = [row.result?.audio_path, row.payload?.audio_path]
      .filter((value: unknown): value is string => typeof value === "string");
    if (paths.length) {
      const { error: removeError } = await db.storage.from("workly-ai-voice-audio").remove(paths);
      if (removeError) throw removeError;
    }
    const result = row.result && typeof row.result === "object" ? { ...row.result } : {};
    delete result.audio_path;
    const update: Record<string, unknown> = {
      payload: historyPayload(row.payload, row.job_type),
      result,
    };
    if (row.status === "pending" || row.status === "running") update.status = "expired";
    const { error: updateError } = await db.from("workly_ai_voice_jobs").update(update).eq("id", row.id);
    if (updateError) throw updateError;
  }

  // Keep lightweight diagnostics for 30 days; remove only older history rows.
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: retentionError } = await db.from("workly_ai_voice_jobs").delete().lt("created_at", retentionCutoff);
  if (retentionError) throw retentionError;
}

export async function handleWorklyVoiceRelay(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !ownerUserId) return json({ error: "Relay owner setup is required" }, 503);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const db = supabase;
    const now = new Date().toISOString();
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

    if (action === "register_fcm_token") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const fcmToken = typeof body?.fcm_token === "string" ? body.fcm_token.trim() : "";
      if (fcmToken.length < 20 || fcmToken.length > 4096) return json({ error: "Invalid Firebase registration token" }, 400);
      const { error } = await db.from("workly_ai_voice_devices")
        .update({ fcm_token: fcmToken, fcm_token_updated_at: new Date().toISOString() })
        .eq("id", device.id)
        .is("revoked_at", null);
      if (error) throw error;
      return json({ registered: true });
    }

    if (action === "create_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      await cleanupExpiredJobs(db, now);
      const jobType = body?.job_type;
      if (jobType !== "tts" && jobType !== "stt" && jobType !== "ai") return json({ error: "job_type must be tts, stt or ai" }, 400);
      const payload = body?.payload;
      const payloadText = JSON.stringify(payload ?? {});
      if (payloadText.length > 20_000) return json({ error: "Payload exceeds 20 KB" }, 413);

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

    if (action === "create_stt_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      await cleanupExpiredJobs(db, now);
      const audioBase64 = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
      if (!audioBase64 || audioBase64.length > 1_800_000) return json({ error: "Recorded audio must be under 1.3 MB." }, 413);
      const { data: device, error: deviceError } = await db.from("workly_ai_voice_devices")
        .select("id").eq("user_id", ownerUserId).is("revoked_at", null)
        .gt("last_seen_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (deviceError || !device) return json({ error: "The shared Workly Voice phone is offline or not registered." }, 404);
      let bytes: Uint8Array;
      try { const binary = atob(audioBase64); bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0)); }
      catch { return json({ error: "Invalid recorded audio." }, 400); }
      if (bytes.byteLength < 1000 || bytes.byteLength > 1_300_000) return json({ error: "Recorded audio size is invalid." }, 413);
      const jobId = crypto.randomUUID();
      const path = `${device.id}/input-${jobId}.wav`;
      const { error: uploadError } = await db.storage.from("workly-ai-voice-audio")
        .upload(path, bytes, { contentType: "audio/wav", upsert: false });
      if (uploadError) throw uploadError;
      const { data: job, error } = await db.from("workly_ai_voice_jobs")
        .insert({ id: jobId, user_id: user.id, device_id: device.id, job_type: "stt", payload: { audio_path: path, content_type: "audio/wav" } })
        .select("id,status,expires_at").single();
      if (error) { await db.storage.from("workly-ai-voice-audio").remove([path]); throw error; }
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
      let job = data;
      if (data.status === "completed" && typeof data.result?.audio_path === "string") {
        const { data: signed, error: signedError } = await db.storage
          .from("workly-ai-voice-audio")
          .createSignedUrl(data.result.audio_path, 300);
        if (signedError) throw signedError;
        job = { ...data, result: { audio_url: signed.signedUrl, content_type: data.result.content_type ?? "audio/wav" } };
      }
      return json({ job });
    }

    if (action === "poll") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      // Keep the device online marker fresh without writing on every 1-second poll.
      const lastSeenAt = device.last_seen_at ? Date.parse(device.last_seen_at) : 0;
      if (!lastSeenAt || Date.now() - lastSeenAt >= 20_000) {
        await db.from("workly_ai_voice_devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", device.id);
      }

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
      if (claimed?.job_type === "stt" && typeof claimed.payload?.audio_path === "string") {
        const { data: signed, error: signedError } = await db.storage.from("workly-ai-voice-audio").createSignedUrl(claimed.payload.audio_path, 300);
        if (signedError) throw signedError;
        claimed.payload = { ...claimed.payload, audio_url: signed.signedUrl };
      }
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

    if (action === "upload_audio") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const jobId = typeof body?.job_id === "string" ? body.job_id : "";
      const audioBase64 = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job id" }, 400);
      if (!audioBase64 || audioBase64.length > 1_800_000) return json({ error: "Audio must be between 1 byte and 1.3 MB." }, 413);
      const { data: job, error: jobError } = await db.from("workly_ai_voice_jobs")
        .select("id")
        .eq("id", jobId)
        .eq("device_id", device.id)
        .eq("status", "running")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) return json({ error: "Voice job not found, expired, or not running." }, 404);
      let bytes: Uint8Array;
      try {
        const binary = atob(audioBase64);
        bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      } catch {
        return json({ error: "Invalid base64 audio." }, 400);
      }
      if (bytes.byteLength > 1_300_000) return json({ error: "Generated audio exceeds 1.3 MB." }, 413);
      const path = `${device.id}/${jobId}.wav`;
      const { error: uploadError } = await db.storage.from("workly-ai-voice-audio")
        .upload(path, bytes, { contentType: "audio/wav", upsert: true });
      if (uploadError) throw uploadError;
      const { data, error } = await db.from("workly_ai_voice_jobs")
        .update({ status: "completed", result: { audio_path: path, content_type: "audio/wav" }, completed_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("device_id", device.id)
        .eq("status", "running")
        .select("id,status")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Voice job was already completed or expired." }, 409);
      return json({ job: data });
    }

    if (action === "complete_job") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const jobId = typeof body?.job_id === "string" ? body.job_id : "";
      const result = body?.result ?? {};
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job id" }, 400);
      if (JSON.stringify(result).length > 32_000) return json({ error: "Result exceeds 32 KB" }, 413);

      const { data: jobBeforeComplete } = await db.from("workly_ai_voice_jobs")
        .select("payload").eq("id", jobId).eq("device_id", device.id).eq("status", "running").maybeSingle();
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
      const inputAudioPath = jobBeforeComplete?.payload?.audio_path;
      if (typeof inputAudioPath === "string") await db.storage.from("workly-ai-voice-audio").remove([inputAudioPath]);
      return json({ job: data });
    }

    if (action === "cleanup_completed_audio") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      const path = typeof body?.audio_path === "string" ? body.audio_path : "";
      if (!path || path.length > 512 || path.includes("..")) return json({ error: "Invalid audio reference" }, 400);
      // Delete only the exact completed audio object belonging to the signed-in user.
      const { data: match, error: jobsError } = await db.from("workly_ai_voice_jobs")
        .select("id,result,payload,job_type")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .filter("result->>audio_path", "eq", path)
        .maybeSingle();
      if (jobsError) throw jobsError;
      if (!match) return json({ cleaned: true });
      const { error: removeError } = await db.storage.from("workly-ai-voice-audio").remove([path]);
      if (removeError) throw removeError;
      const result = match.result && typeof match.result === "object" ? { ...match.result } : {};
      delete result.audio_path;
      const { error: historyError } = await db.from("workly_ai_voice_jobs").update({
        payload: historyPayload(match.payload, match.job_type),
        result,
      }).eq("id", match.id).eq("user_id", user.id);
      if (historyError) throw historyError;
      return json({ cleaned: true, history_retained: true });
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
}
