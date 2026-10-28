import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(deviceId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(deviceId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(deviceId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

function isUsefulSignal(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return !["unknown", "n/a", "not_supported", "null", "undefined"].includes(v.toLowerCase());
}

function getAuthAvatarUrl(user: any): string {
  const meta = user?.user_metadata || {};
  const direct = meta.avatar_url || meta.picture || meta.picture_url || meta.avatar || meta.profile_picture || meta.profile_image_url;
  if (direct) return direct;
  for (const identity of user?.identities || []) {
    const data = identity?.identity_data || {};
    const url = data.avatar_url || data.picture || data.picture_url || data.avatar;
    if (url) return url;
  }
  return "";
}

function isAuthUserAllowed(user: any): boolean {
  if (!user || user.deleted_at) return false;
  const bannedUntil = user.banned_until;
  if (!bannedUntil || bannedUntil === "none") return true;
  const bannedTime = new Date(bannedUntil).getTime();
  return Number.isNaN(bannedTime) || bannedTime <= Date.now();
}

function getDeviceProfileScore(log: any, profile: Record<string, unknown>): number {
  const fields = [
    "browser_name",
    "operating_system",
    "screen_resolution",
    "timezone",
    "language",
    "platform",
    "hardware_concurrency",
    "device_memory",
    "webgl_renderer",
    "webgl_vendor",
  ];
  return fields.reduce((score, field) => {
    const left = log?.[field];
    const right = profile?.[field];
    return isUsefulSignal(left) && isUsefulSignal(right) && left === right ? score + 1 : score;
  }, 0);
}

const DEVICE_LOG_SELECT = "user_id, device_id, fingerprint_hash, canvas_fingerprint, browser_name, operating_system, screen_resolution, timezone, language, platform, hardware_concurrency, device_memory, webgl_renderer, webgl_vendor, updated_at, user_type";

// Quick Login recommendation must match the page's account type: a device log
// recorded from a job-seeker login must not recommend that account on the
// employer login page (and vice versa). Legacy rows have user_type = null and
// stay eligible for both until a fresh login records the type.
const matchesUserType = (row: any, userType: unknown) =>
  !row?.user_type || row.user_type === userType;

function dedupeAndScoreDeviceLogs(rows: any[], fingerprintHash: unknown, canvasFingerprint: unknown, deviceProfile: Record<string, unknown>) {
  const uniqueByUserDevice = new Map<string, any>();
  for (const row of rows) uniqueByUserDevice.set(`${row.user_id}:${row.device_id || ""}`, row);
  return [...uniqueByUserDevice.values()]
    .map((row: any) => {
      const fpMatch = isUsefulSignal(fingerprintHash) && row.fingerprint_hash === fingerprintHash;
      const canvasMatch = isUsefulSignal(canvasFingerprint) && row.canvas_fingerprint === canvasFingerprint;
      const profileScore = getDeviceProfileScore(row, deviceProfile || {});
      const score = (fpMatch ? 5 : 0) + (canvasMatch ? 4 : 0) + profileScore;
      return { ...row, _score: score, _fpMatch: fpMatch, _canvasMatch: canvasMatch, _profileScore: profileScore };
    })
    // Accept a row as same-device evidence when ANY of:
    //  - score >= 13 (fingerprint + canvas + strong profile)
    //  - fingerprint AND canvas match with reasonable profile (>=4)
    //  - canvas matches AND profile is strong (>=6 fields). Fingerprint hashes
    //    drift between page loads (fonts/voices not yet ready) so canvas +
    //    strong device profile alone is enough to consider it the same device.
    //  - fingerprint matches AND profile is strong (>=6 fields)
    .filter((row: any) =>
      row._score >= 13 ||
      (row._fpMatch && row._canvasMatch && row._profileScore >= 4) ||
      (row._canvasMatch && row._profileScore >= 6) ||
      (row._fpMatch && row._profileScore >= 6)
    );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { device_id, fingerprint_hash, canvas_fingerprint, user_type, action, device_profile } = body;

    // ============================================================
    // Admin master switch: if Quick Login is disabled at app level
    // for this user type, short-circuit ALL recognition/quick-login
    // regardless of per-user quick_login_enabled setting.
    // ============================================================
    if (action !== "diagnostic") {
      try {
        const supabaseAdminEarly = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        const masterKey = user_type === "employer" ? "quick_login_employer" : "quick_login_job_seeker";
        const { data: masterRow } = await supabaseAdminEarly
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", masterKey)
          .maybeSingle();
        if (masterRow?.setting_value === "false") {

          return new Response(
            JSON.stringify({ recognized: false, quick_login_enabled: false, disabled_by_admin: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (_e) {
        // Fail-open on lookup error to preserve existing behavior
      }
    }


    // ============================================================
    // Merged: device-diagnostic action (bypasses rate limit + auth)
    // Use: POST { action: "diagnostic" } to recognize-device
    // ============================================================
    if (action === "diagnostic") {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        // Skip noisy / sensitive headers
        if (!/^(authorization|cookie|apikey)$/i.test(k)) headers[k] = v;
      });

      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";

      let dbStatus: { ok: boolean; latency_ms: number; error?: string } = {
        ok: false,
        latency_ms: -1,
      };
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const t0 = Date.now();
        const { error } = await sb.from("device_info_logs").select("id", { head: true, count: "exact" }).limit(1);
        dbStatus = { ok: !error, latency_ms: Date.now() - t0, error: error?.message };
      } catch (e) {
        dbStatus.error = (e as Error).message;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: "diagnostic",
          server_time: new Date().toISOString(),
          runtime: { deno: (Deno as any).version?.deno, v8: (Deno as any).version?.v8 },
          request: {
            method: req.method,
            url: req.url,
            ip,
            user_agent: req.headers.get("user-agent") || null,
            country: req.headers.get("cf-ipcountry") || null,
            headers,
          },
          received_payload: {
            device_id: device_id ?? null,
            fingerprint_hash: fingerprint_hash ?? null,
            canvas_fingerprint: canvas_fingerprint ?? null,
            user_type: user_type ?? null,
          },
          db: dbStatus,
          env_present: {
            SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
            SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Quick-login / device recognition:
    //  - Primary key: device_id (per-install UUID, stored in localStorage).
    //  - Fallback: when device_id is missing (e.g. user cleared site data /
    //    cookies), match on BOTH fingerprint_hash AND canvas_fingerprint.
    //    Both must match the SAME prior log and the result must resolve to a
    //    single unique user, otherwise we refuse to recognize (to avoid
    //    cross-user collisions on identical phone models).
    if (!device_id && !fingerprint_hash && !canvas_fingerprint) {
      return new Response(
        JSON.stringify({ recognized: false, error: "Missing device signals" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit check
    const rateKey = device_id || fingerprint_hash || "unknown";
    if (isRateLimited(rateKey)) {
      return new Response(
        JSON.stringify({ recognized: false, error: "Rate limited" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Find users from device_info_logs. If site data was cleared,
    // recover by strong browser/device signals instead of localStorage device_id.
    let deviceLogs: Array<{ user_id: string; device_id: string | null }> | null = null;
    let resolvedDeviceId: string | null = device_id || null;

    if (device_id) {
      const { data, error } = await supabase
        .from("device_info_logs")
        .select(DEVICE_LOG_SELECT)
        .eq("device_id", device_id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Even when a current localStorage device_id exists, include strong
      // fingerprint/canvas matches from older device_ids. This prevents a fake
      // or duplicate account created later from becoming the recommended Quick
      // Login account just because it wrote the latest device_id.
      const signalQueries: PromiseLike<any>[] = [];
      if (isUsefulSignal(fingerprint_hash) && isUsefulSignal(canvas_fingerprint)) {
        signalQueries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("fingerprint_hash", fingerprint_hash)
            .eq("canvas_fingerprint", canvas_fingerprint)
            .order("updated_at", { ascending: false })
            .limit(50),
        );
      }
      if (isUsefulSignal(canvas_fingerprint)) {
        signalQueries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("canvas_fingerprint", canvas_fingerprint)
            .order("updated_at", { ascending: false })
            .limit(150),
        );
      }
      if (isUsefulSignal(fingerprint_hash)) {
        signalQueries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("fingerprint_hash", fingerprint_hash)
            .order("updated_at", { ascending: false })
            .limit(100),
        );
      }
      const signalResults = signalQueries.length ? await Promise.all(signalQueries) : [];
      const signalRows = signalResults.flatMap((r: any) => (r.error ? [] : r.data || []));
      const strongSignalRows = dedupeAndScoreDeviceLogs(signalRows, fingerprint_hash, canvas_fingerprint, device_profile || {});
      const mergedRows = [...(data || []), ...strongSignalRows].filter((r: any) => matchesUserType(r, user_type));

      if (!mergedRows.length) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uniqueByUserDevice = new Map<string, any>();
      for (const row of mergedRows) uniqueByUserDevice.set(`${row.user_id}:${row.device_id || ""}`, row);
      deviceLogs = [...uniqueByUserDevice.values()].sort((a: any, b: any) => {
        const aExact = a.device_id === device_id ? 1 : 0;
        const bExact = b.device_id === device_id ? 1 : 0;
        return bExact - aExact || (b._score || 0) - (a._score || 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }) as any;
    } else {
      const queries: PromiseLike<any>[] = [];
      if (isUsefulSignal(fingerprint_hash) && isUsefulSignal(canvas_fingerprint)) {
        queries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("fingerprint_hash", fingerprint_hash)
            .eq("canvas_fingerprint", canvas_fingerprint)
            .order("updated_at", { ascending: false })
            .limit(30),
        );
      }
      if (isUsefulSignal(canvas_fingerprint)) {
        queries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("canvas_fingerprint", canvas_fingerprint)
            .order("updated_at", { ascending: false })
            .limit(100),
        );
      }
      if (isUsefulSignal(fingerprint_hash)) {
        queries.push(
          supabase
            .from("device_info_logs")
            .select(DEVICE_LOG_SELECT)
            .eq("fingerprint_hash", fingerprint_hash)
            .order("updated_at", { ascending: false })
            .limit(50),
        );
      }

      const results = await Promise.all(queries);
      const rows = results.flatMap((r: any) => (r.error ? [] : r.data || []));
      const scored = dedupeAndScoreDeviceLogs(rows, fingerprint_hash, canvas_fingerprint, device_profile || {})
        .filter((r: any) => matchesUserType(r, user_type))
        .sort((a: any, b: any) => b._score - a._score || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      if (!scored.length) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const topScore = scored[0]._score;
      const topRows = scored.filter((d: any) => d._score === topScore);
      const uniqUsers = new Set(topRows.map((d: any) => d.user_id));
      if (uniqUsers.size > 1) {
        console.log("[recognize-device] device fallback matched multiple top users; resolving by requested account type, block status, then latest login");
      }

      deviceLogs = topRows as any;
      resolvedDeviceId = topRows[0].device_id || null;
    }

    if (!device_id && deviceLogs?.length) {
      const candidateIds = [...new Set(deviceLogs.map((d: any) => d.user_id))];
      const table = user_type === "employer" ? "companies" : "profiles";
      const { data: typedRows } = await supabase
        .from(table)
        .select("user_id")
        .in("user_id", candidateIds);
      const typedIds = new Set((typedRows || []).map((r: any) => r.user_id));
      deviceLogs = deviceLogs.filter((d: any) => typedIds.has(d.user_id));
      if (!deviceLogs.length) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedDeviceId = (deviceLogs[0] as any).device_id || null;
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set((deviceLogs || []).map((d: any) => d.user_id))];
    console.log(`[recognize-device] Found ${uniqueUserIds.length} unique users from device_info_logs`);

    // Step 1.5: Look up blocked_accounts for candidates and their originals.
    // We pull BOTH active and inactive rows because:
    //   - active rows mark currently-banned/duplicate accounts (never recommend)
    //   - inactive rows that point a candidate to ANOTHER candidate as original
    //     still tell us the candidate is the duplicate side; even if the block
    //     was auto-cleared (e.g., temporary device_id mismatch), we should not
    //     recommend it over the original account when both still match the
    //     same physical device.
    const { data: blockedRows } = await supabase
      .from("blocked_accounts")
      .select("user_id, original_user_id, is_active")
      .or(`user_id.in.(${uniqueUserIds.join(",")}),original_user_id.in.(${uniqueUserIds.join(",")})`);

    const duplicateMap = new Map<string, string>();        // duplicate user_id -> original (active OR historical)
    const bannedUserIds = new Set<string>();               // currently-active blocks
    const knownOriginals = new Set<string>();              // any user_id ever referenced as original_user_id
    for (const row of blockedRows || []) {
      if (row.original_user_id && row.original_user_id !== row.user_id) {
        if (!duplicateMap.has(row.user_id)) duplicateMap.set(row.user_id, row.original_user_id);
        knownOriginals.add(row.original_user_id);
      }
      if (row.is_active) bannedUserIds.add(row.user_id);
    }
    console.log(`[recognize-device] duplicates(historical=${duplicateMap.size}), banned=${bannedUserIds.size}, originals=${knownOriginals.size}`);

    // Resolve candidates:
    //  - drop currently-banned accounts entirely
    //  - if a candidate is mapped (active OR historical) to another candidate
    //    on this device as its original, REPLACE it with the original
    //    (original always wins when both still share device signals)
    const candidateSet = new Set<string>();
    const uniqueUserIdSet = new Set(uniqueUserIds);
    for (const uid of uniqueUserIds) {
      if (bannedUserIds.has(uid)) continue;
      // NEVER recommend a known duplicate account — even if its original is
      // not currently visible on this device. Per product rule: only the
      // ORIGINAL (first-created) account should show up in Quick Login.
      if (duplicateMap.has(uid)) {
        const mapped = duplicateMap.get(uid)!;
        if (uniqueUserIdSet.has(mapped) && !bannedUserIds.has(mapped)) {
          candidateSet.add(mapped);
        }
        continue;
      }
      const mapped = duplicateMap.get(uid);
      let target = uid;
      if (mapped && uniqueUserIdSet.has(mapped) && !bannedUserIds.has(mapped)) {
        target = mapped;
      }
      const finalId = duplicateMap.get(target);
      const resolved = (finalId && uniqueUserIdSet.has(finalId) && !bannedUserIds.has(finalId)) ? finalId : target;
      if (bannedUserIds.has(resolved)) continue;
      candidateSet.add(resolved);
    }

    // Filter by account_status from the respective table (only "active" allowed)
    // AND when multiple candidates remain, prefer the OLDEST account (the real
    // original) — fake/duplicate accounts are always created later.
    const candidateIds = [...candidateSet];
    let resolvedUserId: string | null = null;

    if (candidateIds.length) {
      const statusTable = user_type === "employer" ? "companies" : "profiles";
      const { data: statusRows } = await supabase
        .from(statusTable)
        .select("user_id, account_status, created_at")
        .in("user_id", candidateIds);

      const candidateLogTimes = new Map<string, number>();
      for (const log of deviceLogs || []) {
        const uid = duplicateMap.get((log as any).user_id) || (log as any).user_id;
        const updatedAt = (log as any).updated_at ? new Date((log as any).updated_at).getTime() : 0;
        candidateLogTimes.set(uid, Math.max(candidateLogTimes.get(uid) || 0, updatedAt));
      }

      const activeRows = (statusRows || []).filter((r: any) => {
        const status = String(r.account_status || "active").toLowerCase();
        // Only "active" accounts are eligible. Explicitly exclude banned /
        // suspended / job_banned statuses and anything on blocked_accounts.
        return status === "active"
          && !bannedUserIds.has(r.user_id)
          && !duplicateMap.has(r.user_id);
      });

      if (activeRows.length) {
        // Sort by full created_at timestamp ASC. This naturally handles the
        // product rule: compare by date (DD/MM/YYYY) first; if two accounts
        // were created on the same day, the time (HH:MM:SS, down to ms)
        // decides — the FIRST created account is always the original and the
        // only one eligible for Quick Login. knownOriginals / recency are
        // used only as safety tiebreakers when timestamps are missing.
        activeRows.sort((a: any, b: any) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : Infinity;
          const tb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
          if (ta !== tb) return ta - tb;
          const aOriginal = knownOriginals.has(a.user_id) ? 1 : 0;
          const bOriginal = knownOriginals.has(b.user_id) ? 1 : 0;
          if (aOriginal !== bOriginal) return bOriginal - aOriginal;
          return (candidateLogTimes.get(b.user_id) || 0) - (candidateLogTimes.get(a.user_id) || 0);
        });
        for (const row of activeRows) {
          const { data: candidateAuth } = await supabase.auth.admin.getUserById(row.user_id);
          if (isAuthUserAllowed(candidateAuth?.user)) {
            resolvedUserId = row.user_id;
            break;
          }
          console.log(`[recognize-device] Skipping Auth-banned/deleted candidate: ${row.user_id}`);
        }
        console.log(
          `[recognize-device] ${activeRows.length} active candidate(s); picked trusted original: ${resolvedUserId || "none"}`
        );
      }
    }


    if (!resolvedUserId) {
      console.log(`[recognize-device] No valid original active user found`);
      return new Response(
        JSON.stringify({ recognized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(resolvedUserId);

    if (authError || !authUser?.user?.email || !isAuthUserAllowed(authUser.user)) {
      return new Response(
        JSON.stringify({ recognized: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = authUser.user.email;

    // Step 3: Verify user type and get display name + image
    let displayName = "";
    let imageUrl = "";

    if (user_type === "job_seeker") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, profile_image_url")
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      displayName = profile.full_name || "";
      imageUrl = profile.profile_image_url || getAuthAvatarUrl(authUser.user);
    } else if (user_type === "employer") {
      const { data: company } = await supabase
        .from("companies")
        .select("company_name, logo_url")
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      if (!company) {
        return new Response(
          JSON.stringify({ recognized: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      displayName = company.company_name || "";
      imageUrl = company.logo_url || getAuthAvatarUrl(authUser.user);
      if (!company.logo_url && imageUrl) {
        await supabase.from("companies").update({ logo_url: imageUrl }).eq("user_id", resolvedUserId);
      }
    } else {
      return new Response(
        JSON.stringify({ recognized: false, error: "Invalid user_type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle quick-login action
    if (action === "quick-login") {
      try {
        const { data: linkData, error: linkError } =
          await supabase.auth.admin.generateLink({
            type: "magiclink",
            email,
          });

        if (linkError || !linkData) {
          console.error("generateLink error:", linkError);
          return new Response(
            JSON.stringify({ recognized: false, error: "Failed to generate login token" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Extract token_hash from the generated link properties
        const tokenHash = linkData.properties?.hashed_token;

        if (!tokenHash) {
          console.error("No token_hash in link data:", linkData);
          return new Response(
            JSON.stringify({ recognized: false, error: "Token generation failed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            recognized: true,
            token_hash: tokenHash,
            email,
            device_id: resolvedDeviceId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("quick-login error:", err);
        return new Response(
          JSON.stringify({ recognized: false, error: "Quick login failed" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Step 4: Check user's quick_login_enabled setting
    const settingsTable = user_type === "employer" ? "employer_settings" : "user_settings";
    const { data: userSettings } = await supabase
      .from(settingsTable)
      .select("quick_login_enabled")
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    const quickLoginEnabled = userSettings?.quick_login_enabled ?? true;

    // Default: return recognition data
    return new Response(
      JSON.stringify({
        recognized: true,
        email,
        full_name: displayName,
        image_url: imageUrl,
        quick_login_enabled: quickLoginEnabled,
        device_id: resolvedDeviceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("recognize-device error:", err);
    return new Response(
      JSON.stringify({ recognized: false, error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
