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
    .select("id,user_id,revoked_at,last_seen_at,worker_enabled")
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

async function cleanupExpiredJobs(db: any, now: string, ownerId: string) {
  const { data: expiredJobs, error } = await db.from("workly_ai_voice_jobs")
    .select("id,status,job_type,result,payload")
    .eq("user_id", ownerId)
    .is("cleanup_completed_at", null)
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
      cleanup_completed_at: now,
    };
    if (row.status === "pending" || row.status === "running") update.status = "expired";
    const { error: updateError } = await db.from("workly_ai_voice_jobs").update(update)
      .eq("id", row.id).eq("user_id", ownerId);
    if (updateError) throw updateError;
  }

  // Keep lightweight diagnostics for 30 days; remove only older history rows.
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: retentionError } = await db.from("workly_ai_voice_jobs").delete()
    .eq("user_id", ownerId).lt("created_at", retentionCutoff);
  if (retentionError) throw retentionError;
}

export async function handleWorklyVoiceRelay(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "Relay service setup is required" }, 503);

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const db = supabase;
    const now = new Date().toISOString();
    if (action === "register_device") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Please sign in with your Workly India account in the app." }, 401);
      const deviceToken = randomHex(32);
      const { data: device, error } = await db.from("workly_ai_voice_devices")
        .insert({
          user_id: user.id,
          token_hash: await sha256(deviceToken),
          device_name: String(body?.device_name ?? "Workly Voice Android").slice(0, 80),
        })
        .select("id")
        .single();
      if (error) throw error;
      return json({
        device_id: device.id,
        device_token: deviceToken,
        message: "Phone registered. Community worker mode is OFF until you explicitly enable it."
      });
    }

    if (action === "set_worker_state") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const enabled = body?.enabled === true;
      const capabilities = Array.isArray(body?.capabilities) ? body.capabilities.slice(0, 40) : [];
      // Opt-in may be enabled before models are downloaded; an empty capability list receives no jobs.
      for (const capability of capabilities) {
        if (!capability || !["ai", "stt", "tts", "translate", "image", "video"].includes(capability.task) ||
          typeof capability.model !== "string" || capability.model.length > 100 ||
          !Array.isArray(capability.languages) || capability.languages.length > 30 ||
          capability.languages.some((language: unknown) => typeof language !== "string" || language.length > 12)) {
          return json({ error: "Invalid model capability record." }, 400);
        }
      }
      const update: Record<string, unknown> = {
        worker_enabled: enabled,
        model_capabilities: enabled ? capabilities : [],
        worker_updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      };
      if (body?.metrics && typeof body.metrics === "object" && !Array.isArray(body.metrics)) {
        if (JSON.stringify(body.metrics).length > 2_000) return json({ error: "Device metrics exceed 2 KB." }, 413);
        const metrics = body.metrics;
        const safeBytes = (value: unknown) =>
          typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000_000
            ? value : null;
        const batteryPercent = typeof metrics.battery_percent === "number" &&
          Number.isInteger(metrics.battery_percent) && metrics.battery_percent >= 0 && metrics.battery_percent <= 100
          ? metrics.battery_percent : null;
        const batteryStatus = ["Charging", "Discharging", "Full", "Not charging", "Unknown"].includes(metrics.battery_status)
          ? metrics.battery_status : "Unknown";
        const temperature = typeof metrics.battery_temperature_c === "number" &&
          Number.isFinite(metrics.battery_temperature_c) && metrics.battery_temperature_c >= -20 && metrics.battery_temperature_c <= 100
          ? metrics.battery_temperature_c : null;
        update.worker_metrics = {
          storage_total_bytes: safeBytes(metrics.storage_total_bytes),
          storage_available_bytes: safeBytes(metrics.storage_available_bytes),
          ram_total_bytes: safeBytes(metrics.ram_total_bytes),
          ram_available_bytes: safeBytes(metrics.ram_available_bytes),
          battery_percent: batteryPercent,
          battery_status: batteryStatus,
          battery_temperature_c: temperature,
          is_charging: metrics.is_charging === true,
          low_memory: metrics.low_memory === true
        };
        update.metrics_updated_at = new Date().toISOString();
      }
      const { error } = await db.from("workly_ai_voice_devices")
        .update(update)
        .eq("id", device.id)
        .is("revoked_at", null);
      if (error) throw error;
      return json({ worker_enabled: enabled, capability_count: enabled ? capabilities.length : 0, metrics_saved: !!update.worker_metrics });
    }

    if (action === "report_diagnostic") {
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const eventType = typeof body?.event_type === "string" ? body.event_type.trim().slice(0, 80) : "";
      if (!eventType) return json({ error: "event_type is required" }, 400);
      const metadata = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
      if (JSON.stringify(metadata).length > 4_000) return json({ error: "Diagnostic metadata exceeds 4 KB" }, 413);
      const errorType = typeof body?.error_type === "string" ? body.error_type.slice(0, 80) : null;
      const errorMessage = typeof body?.error_message === "string" ? body.error_message.slice(0, 500) : null;
      const jobId = typeof body?.job_id === "string" && /^[0-9a-f-]{36}$/i.test(body.job_id) ? body.job_id : null;
      const { data: linkedJob, error: linkedJobError } = jobId
        ? await db.from("workly_ai_voice_jobs")
            .select("id,model_id,model_name,pack_id,payload")
            .eq("id", jobId).eq("device_id", device.id).maybeSingle()
        : { data: null, error: null };
      if (linkedJobError) throw linkedJobError;
      const linkedPayload = linkedJob?.payload && typeof linkedJob.payload === "object" ? linkedJob.payload : {};
      const modelId = typeof body?.model_id === "string" ? body.model_id.slice(0, 160) : linkedJob?.model_id ?? linkedPayload.model_id ?? linkedPayload.model ?? null;
      const modelName = typeof body?.model_name === "string" ? body.model_name.slice(0, 200) : linkedJob?.model_name ?? linkedPayload.model_name ?? null;
      const packId = typeof body?.pack_id === "string" ? body.pack_id.slice(0, 160) : linkedJob?.pack_id ?? linkedPayload.pack_id ?? null;
      const { data, error } = await db.from("workly_ai_voice_diagnostics").insert({
        device_id: device.id,
        job_id: linkedJob?.id ?? null,
        model_id: modelId,
        model_name: modelName,
        pack_id: packId,
        event_type: eventType,
        language: typeof body?.language === "string" ? body.language.slice(0, 20) : null,
        duration_ms: Number.isFinite(body?.duration_ms) ? Math.max(0, Math.min(86_400_000, body.duration_ms)) : null,
        audio_bytes: Number.isFinite(body?.audio_bytes) ? Math.max(0, Math.min(50_000_000, body.audio_bytes)) : null,
        error_type: errorType,
        error_message: errorMessage,
        app_version: typeof body?.app_version === "string" ? body.app_version.slice(0, 40) : null,
        android_version: typeof body?.android_version === "string" ? body.android_version.slice(0, 40) : null,
        device_model: typeof body?.device_model === "string" ? body.device_model.slice(0, 100) : null,
        metadata
      }).select("id,created_at").single();
      if (error) throw error;
      return json({ saved: true, diagnostic: data }, 201);
    }

    if (action === "user_data_dashboard") {
      // Every signed-in app user sees only records belonging to their own account.
      // Device auth resolves the user_id server-side; never accept a client-supplied user ID.
      const device = await deviceFor(req);
      if (!device) return json({ error: "Device authentication failed" }, 401);
      const userId = device.user_id;
      if (!userId) return json({ error: "User account could not be resolved for this device." }, 403);

      const devicesResult = await db.from("workly_ai_voice_devices")
        .select("id,device_name,created_at,last_seen_at,worker_enabled,model_capabilities,worker_updated_at,worker_metrics,metrics_updated_at,revoked_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(500);
      if (devicesResult.error) throw devicesResult.error;
      const deviceIds = (devicesResult.data ?? []).map((row: any) => row.id);

      // Fail closed: an account with no owned devices must never run an unscoped
      // jobs/diagnostics query. All dashboard records are derived from this
      // server-resolved owner and the exact device IDs returned for that owner.
      if (deviceIds.length === 0) {
        return json({
          generated_at: now,
          summary: { devices_total: 0, workers_online: 0, logs_total: 0 },
          devices: [],
          logs: []
        });
      }

      const [jobsResult, diagnosticsResult] = await Promise.all([
        db.from("workly_ai_voice_jobs")
          .select("id,device_id,job_type,status,created_at,started_at,completed_at,expires_at,model_id,model_name,pack_id,payload,result", { count: "exact" })
          .eq("user_id", userId)
          .in("device_id", deviceIds)
          .order("created_at", { ascending: false }).limit(250),
        db.from("workly_ai_voice_diagnostics")
          .select("id,device_id,job_id,model_id,model_name,pack_id,event_type,language,duration_ms,audio_bytes,error_type,error_message,app_version,android_version,device_model,metadata,created_at", { count: "exact" })
          .in("device_id", deviceIds)
          .order("created_at", { ascending: false }).limit(150)
      ]);
      for (const result of [jobsResult, diagnosticsResult]) {
        if (result.error) throw result.error;
      }

      const devices = (devicesResult.data ?? []).map((row: any) => ({
        ...row,
        online: row.worker_enabled === true && !row.revoked_at && !!row.last_seen_at &&
          Date.now() - Date.parse(row.last_seen_at) <= 60_000
      }));
      const jobs = (jobsResult.data ?? []).map((row: any) => {
        const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
        const result = row.result && typeof row.result === "object" ? row.result : {};
        return {
          ...row,
          payload: {
            ...historyPayload(payload, row.job_type),
            ...(typeof payload.model === "string" ? { model: payload.model } : {}),
            ...(typeof payload.pack_id === "string" ? { pack_id: payload.pack_id } : {}),
            ...(typeof payload.model_name === "string" ? { model_name: payload.model_name } : {}),
            ...(typeof payload.source_language === "string" ? { source_language: payload.source_language } : {}),
            ...(typeof payload.target_language === "string" ? { target_language: payload.target_language } : {})
          },
          result: {
            ...(typeof result.error === "string" ? { error: result.error.slice(0, 500) } : {}),
            ...(typeof result.provider === "string" ? { provider: result.provider } : {}),
            ...(typeof result.languageTag === "string" ? { languageTag: result.languageTag } : {}),
            ...(typeof result.content_type === "string" ? { content_type: result.content_type } : {}),
            ...(typeof result.audio_bytes === "number" ? { audio_bytes: result.audio_bytes } : {}),
            ...(typeof result.text_length === "number" ? { text_length: result.text_length } : {})
          }
        };
      });
      const diagnostics = (diagnosticsResult.data ?? []).map((row: any) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const safeMetadata: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(metadata)) {
          if (/token|secret|password|authorization|email|phone|audio|transcript|text|url|path/i.test(key)) continue;
          if (typeof value === "string") safeMetadata[key] = value.slice(0, 300);
          else if (typeof value === "number" || typeof value === "boolean" || value === null) safeMetadata[key] = value;
        }
        return { ...row, metadata: safeMetadata };
      });
      const deviceRows = devices.map((row: any) => ({
        ...row,
        worker_status: row.revoked_at ? "REVOKED" : row.online ? "ACTIVE" : row.worker_enabled ? "OFFLINE" : "OFF"
      }));
      const jobsById = new Map(jobs.map((row: any) => [String(row.id), row]));
      const logs = [
        ...jobs.map((row: any) => ({
          id: "job:" + row.id,
          created_at: row.created_at,
          source: "VOICE JOB",
          status: row.status ? String(row.status).toUpperCase() : "UNKNOWN",
          model: [row.model_name, row.pack_id, row.model_id, row.payload?.model_name, row.payload?.pack_id, row.payload?.model, row.payload?.model_id]
            .find((value: unknown) => typeof value === "string" && value.trim().length > 0) ?? "",
          language: row.payload?.language ?? row.payload?.source_language ?? "",
          message: row.result?.error ?? (String(row.job_type || "job").toUpperCase() + " request"),
          error_type: row.status === "failed" || row.status === "expired" ? row.status : ""
        })),
        ...diagnostics.map((row: any) => {
          const linkedJob: any = row.job_id ? jobsById.get(String(row.job_id)) : null;
          const jobPayload = linkedJob?.payload && typeof linkedJob.payload === "object" ? linkedJob.payload : {};
          const model = [
            row.model_name, row.pack_id, row.model_id,
            row.metadata?.pack_id, row.metadata?.model_name, row.metadata?.model, row.metadata?.model_id,
            linkedJob?.model_name, linkedJob?.pack_id, linkedJob?.model_id,
            jobPayload.pack_id, jobPayload.model_name, jobPayload.model, jobPayload.model_id
          ].find((value: unknown) => typeof value === "string" && value.trim().length > 0) ?? "";
          return {
            id: "diagnostic:" + row.id,
            created_at: row.created_at,
            source: "APP EVENT",
            status: row.error_type || row.error_message ? "ERROR" : "INFO",
            model,
            language: row.language ?? jobPayload.language ?? jobPayload.source_language ?? "",
            message: row.error_message || row.metadata?.message || row.event_type || "App event",
            error_type: row.error_type ?? ""
          };
        })
      ].sort((a: any, b: any) => Date.parse(b.created_at || "") - Date.parse(a.created_at || "")).slice(0, 250);
      return json({
        generated_at: now,
        summary: {
          devices_total: devicesResult.count ?? devices.length,
          workers_online: devices.filter((row: any) => row.online).length,
          logs_total: logs.length
        },
        devices: deviceRows,
        logs
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
      await cleanupExpiredJobs(db, now, user.id);
      const jobType = body?.job_type;
      if (!["ai", "tts", "translate", "image", "video"].includes(jobType)) return json({ error: "job_type must be ai, tts, translate, image or video; use create_stt_job for audio transcription." }, 400);
      const payload = body?.payload;
      const payloadText = JSON.stringify(payload ?? {});
      if (payloadText.length > 20_000) return json({ error: "Payload exceeds 20 KB" }, 413);

      const requestedModel = typeof payload?.model === "string" ? payload.model : "";
      // Keep the full locale (for example en-IN / gu-IN). Android advertises
      // regional language tags; stripping the region here incorrectly rejected
      // an otherwise-ready worker and returned 429 for valid preview requests.
      const requestedLanguage = jobType === "translate" &&
        typeof payload?.source_language === "string" && typeof payload?.target_language === "string"
        ? payload.source_language.toLowerCase().split("-")[0] + "-" + payload.target_language.toLowerCase().split("-")[0]
        : typeof payload?.language === "string" ? payload.language.trim().toLowerCase() : "";
      const supportsRequestedLanguage = (languages: unknown): boolean => {
        if (!requestedLanguage) return true;
        if (!Array.isArray(languages)) return false;
        return languages.some((value: unknown) => {
          if (typeof value !== "string") return false;
          const advertised = value.trim().toLowerCase();
          if (advertised === "multilingual" || advertised === requestedLanguage) return true;
          // Translation capabilities are ordered source-target pairs; never
          // treat a shared source language as support for a different target.
          if (jobType === "translate") return false;
          // Accept a base language only when the worker advertises that base
          // explicitly, while matching en-IN with en and vice versa.
          return advertised.split("-")[0] === requestedLanguage.split("-")[0];
        });
      };
      const { data: candidates, error: deviceError } = await db.from("workly_ai_voice_devices")
        .select("id,model_capabilities,worker_metrics,last_seen_at")
        .eq("user_id", user.id)
        .eq("worker_enabled", true)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: true })
        .limit(500);
      if (deviceError) throw deviceError;
      const requiredTask = jobType;
      let device: any = null;
      let selectedModel = requestedModel;
      let selectedPackId = "";
      let selectedModelName = "";
      let activeJobs = Number.MAX_SAFE_INTEGER;
      let selectedDeviceOnline = false;
      let onlineModelReady = false;
      let onlineModelLanguageReady = false;
      for (const candidate of candidates ?? []) {
        const readyCapabilities = Array.isArray(candidate.model_capabilities)
          ? candidate.model_capabilities.filter((cap: any) =>
              cap && cap.task === requiredTask && (!requestedModel || cap.model === requestedModel) &&
              typeof cap.model === "string" && cap.ready === true && Array.isArray(cap.languages))
          : [];
        if (readyCapabilities.length) onlineModelReady = true;
        const matchedCapability = readyCapabilities.find((cap: any) => supportsRequestedLanguage(cap.languages));
        if (matchedCapability) onlineModelLanguageReady = true;
        if (!matchedCapability) continue;
        const metrics = candidate.worker_metrics && typeof candidate.worker_metrics === "object" ? candidate.worker_metrics : {};
        if (metrics.low_memory === true) continue;
        const battery = typeof metrics.battery_percent === "number" ? metrics.battery_percent : null;
        if (battery !== null && battery <= 10 && metrics.is_charging !== true) continue;
        const availableRam = typeof metrics.ram_available_bytes === "number" ? metrics.ram_available_bytes : null;
        const minimumRam = jobType === "ai" ? 1024 * 1024 * 1024 : 256 * 1024 * 1024;
        if (availableRam !== null && availableRam < minimumRam) continue;
        const { count, error: countError } = await db.from("workly_ai_voice_jobs")
          .select("id", { count: "exact", head: true })
          .eq("device_id", candidate.id)
          .in("status", ["pending", "running"])
          .gt("expires_at", new Date().toISOString());
        if (countError) throw countError;
        const load = count ?? 0;
        if (load < 100) {
          const isOnline = !!candidate.last_seen_at && Date.now() - Date.parse(candidate.last_seen_at) <= 60_000;
          if (!device || (isOnline && !selectedDeviceOnline) ||
            (isOnline === selectedDeviceOnline && load < activeJobs)) {
            device = candidate;
            selectedDeviceOnline = isOnline;
            selectedModel = matchedCapability.model;
            selectedPackId = typeof matchedCapability.pack_id === "string" ? matchedCapability.pack_id : matchedCapability.model;
            selectedModelName = typeof matchedCapability.model_name === "string" ? matchedCapability.model_name : selectedPackId;
            activeJobs = load;
          }
        }
      }
      if (!device) {
        if (!onlineModelReady) {
          return json({
            error: requestedModel
              ? `The ${requestedModel} voice model is not installed and ready on any paired phone. Download and enable this model in ChatWork > Download Models, or choose another ready model.`
              : "No paired phone has a ready model for this voice task."
          }, 409);
        }
        if (!onlineModelLanguageReady) {
          return json({ error: `The selected voice model is ready, but not for ${requestedLanguage}. Download its language pack in ChatWork or choose a supported language.` }, 409);
        }
        return json({ error: "All compatible Workly Voice queues are full. Please wait a moment and try again." }, 429);
      }


      const { data: job, error } = await db.from("workly_ai_voice_jobs")
        .insert({
          user_id: user.id, device_id: device.id, job_type: jobType,
          model_id: selectedModel, model_name: selectedModelName, pack_id: selectedPackId,
          payload: { ...(payload ?? {}), model: selectedModel, model_id: selectedModel, pack_id: selectedPackId, model_name: selectedModelName },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .select("id,status,expires_at")
        .single();
      if (error) throw error;
      return json({ job, queue_position: activeJobs + 1, worker_online: selectedDeviceOnline });
    }

    if (action === "create_stt_job") {
      const user = await authenticatedUser(req);
      if (!user) return json({ error: "Authentication required" }, 401);
      await cleanupExpiredJobs(db, now, user.id);
      const audioBase64 = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
      if (!audioBase64 || audioBase64.length > 1_800_000) return json({ error: "Recorded audio must be under 1.3 MB." }, 413);
      const requestedLanguage = typeof body?.language === "string" ? body.language.split("-")[0].toLowerCase() : "";
      const { data: candidates, error: deviceError } = await db.from("workly_ai_voice_devices")
        .select("id,model_capabilities,worker_metrics,last_seen_at").eq("user_id", user.id).eq("worker_enabled", true).is("revoked_at", null)
        .order("last_seen_at", { ascending: true }).limit(500);
      if (deviceError) throw deviceError;
      let device: any = null;
      let selectedSttModel = "";
      let lightestQueue = Number.MAX_SAFE_INTEGER;
      let selectedSttDeviceOnline = false;
      for (const candidate of candidates ?? []) {
        const capability = Array.isArray(candidate.model_capabilities) && candidate.model_capabilities.find((cap: any) =>
          cap && cap.task === "stt" && typeof cap.model === "string" && cap.ready === true &&
          Array.isArray(cap.languages) && (!requestedLanguage || cap.languages.includes(requestedLanguage))
        );
        if (!capability) continue;
        const metrics = candidate.worker_metrics && typeof candidate.worker_metrics === "object" ? candidate.worker_metrics : {};
        if (metrics.low_memory === true) continue;
        const battery = typeof metrics.battery_percent === "number" ? metrics.battery_percent : null;
        if (battery !== null && battery <= 10 && metrics.is_charging !== true) continue;
        const availableRam = typeof metrics.ram_available_bytes === "number" ? metrics.ram_available_bytes : null;
        if (availableRam !== null && availableRam < 512 * 1024 * 1024) continue;
        const { count, error: countError } = await db.from("workly_ai_voice_jobs")
          .select("id", { count: "exact", head: true })
          .eq("device_id", candidate.id)
          .in("status", ["pending", "running"])
          .gt("expires_at", new Date().toISOString());
        if (countError) throw countError;
        const load = count ?? 0;
        if (load < 100) {
          const isOnline = !!candidate.last_seen_at && Date.now() - Date.parse(candidate.last_seen_at) <= 60_000;
          if (!device || (isOnline && !selectedSttDeviceOnline) ||
            (isOnline === selectedSttDeviceOnline && load < lightestQueue)) {
            device = candidate;
            selectedSttDeviceOnline = isOnline;
            selectedSttModel = capability.model;
            lightestQueue = load;
          }
        }
      }
      if (!device) return json({ error: "No paired, opted-in phone has a ready speech-recognition model for this language." }, 404);
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
        .insert({
          id: jobId, user_id: user.id, device_id: device.id, job_type: "stt",
          model_id: selectedSttModel, model_name: selectedSttModel, pack_id: selectedSttModel,
          payload: { audio_path: path, content_type: "audio/wav", model: selectedSttModel, model_id: selectedSttModel, model_name: selectedSttModel, pack_id: selectedSttModel, language: requestedLanguage || "auto" },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .select("id,status,expires_at").single();
      if (error) { await db.storage.from("workly-ai-voice-audio").remove([path]); throw error; }
      return json({ job, worker_online: selectedSttDeviceOnline });
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

      // Every signed-in phone may join the same community pool, but only after
      // its owner explicitly opts in on that device. Enforce opt-out at poll
      // time too, so a previously queued job is never delivered after opt-out.
      if (device.worker_enabled !== true) {
        return json({ job: null, worker_enabled: false, heartbeat_at: new Date().toISOString() });
      }

      // Claim atomically in Postgres. Concurrent polls cannot receive the same job.
      const { data: claimedRows, error: claimError } = await db.rpc("claim_workly_voice_job", {
        p_device_id: device.id
      });
      if (claimError) throw claimError;
      const claimed = Array.isArray(claimedRows) ? claimedRows[0] ?? null : null;
      if (!claimed) return json({ job: null, heartbeat_at: new Date().toISOString() });
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
      const { data: retryRows, error } = await db.rpc("retry_workly_voice_job", {
        p_job_id: jobId,
        p_device_id: device.id,
        p_reason: reason
      });
      if (error) throw error;
      const retry = Array.isArray(retryRows) ? retryRows[0] ?? null : null;
      if (!retry) return json({ error: "Job not found or already finished" }, 404);
      return json({
        job: { id: retry.job_id, status: retry.status },
        retrying: retry.status === "pending"
      });
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
        .update({ status: "completed", result: { audio_path: path, content_type: "audio/wav", audio_bytes: bytes.byteLength }, completed_at: new Date().toISOString() })
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
