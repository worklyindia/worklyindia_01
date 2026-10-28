// YouTube Growth Coach — OAuth + read-only Analytics helpers.
// Used by the existing `unified-youtube-api` edge function (no new function created).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildYouTubePayload, changedFields } from "./youtubeSeoPayload.ts";
import { getYoutubePublicAuth } from "./youtubePublicSearch.ts";
import { getOwnerSecret } from "./ownerSecrets.ts";

export const GROWTH_ACTIONS = [
  "yt_oauth_url",
  "yt_oauth_exchange",
  "yt_status",
  "yt_disconnect",
  "yt_accounts_list",
  "yt_set_default",
  "yt_snapshot",
  "yt_video",
  "yt_video_meta",
  "yt_video_update",
  "yt_upload_init",
  "yt_upload_categories",
  "yt_upload_thumbnail",
] as const;

export type GrowthAction = (typeof GROWTH_ACTIONS)[number];

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
];


const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

/** OAuth client credentials: from the `youtube_analytics_api` table (JSON saved in Supabase), else secrets. */
export async function getOAuthClient(): Promise<{ client_id: string; client_secret: string }> {
  // Owner Portal Secrets page values win over everything else.
  const [ownerId, ownerSecret] = await Promise.all([
    getOwnerSecret("YOUTUBE_OAUTH_CLIENT_ID"),
    getOwnerSecret("YOUTUBE_OAUTH_CLIENT_SECRET"),
  ]);
  if (ownerId && ownerSecret) return { client_id: ownerId, client_secret: ownerSecret };
  // Shared Secrets-page pair works for YouTube too.
  const [sharedId, sharedSecret] = await Promise.all([
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_ID"),
    getOwnerSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
  ]);
  if (sharedId && sharedSecret) return { client_id: sharedId, client_secret: sharedSecret };
  const db = admin();
  const { data } = await db
    .from("youtube_analytics_api")
    .select("name, data")
    .in("name", ["oauth_client", "youtube_analytics", "default"])
    .limit(5);

  for (const row of data || []) {
    const raw: any = row.data;
    const c = raw?.web || raw?.installed || raw;
    if (c?.client_id && c?.client_secret) {
      return { client_id: c.client_id, client_secret: c.client_secret };
    }
  }

  const envRaw = Deno.env.get("YOUTUBE_OAUTH_CLIENT_JSON");
  let diag = envRaw ? `secret present (len ${envRaw.length})` : "secret missing";
  if (envRaw) {
    const trimmed = envRaw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      const c = parsed?.web || parsed?.installed || parsed;
      if (c?.client_id && c?.client_secret) return c;
      diag = `secret JSON parsed but keys found: ${Object.keys(c || {}).join(",") || "none"}`;
    } catch {
      // Fallback: raw "client_id:client_secret" or "id,secret" style values
      const parts = trimmed.split(/[\s,|]+/).filter(Boolean);
      if (parts.length === 2 && parts[0].includes("apps.googleusercontent.com")) {
        return { client_id: parts[0], client_secret: parts[1] };
      }
      if (trimmed.includes("apps.googleusercontent.com") && trimmed.includes(":")) {
        const i = trimmed.lastIndexOf(":");
        return { client_id: trimmed.slice(0, i).trim(), client_secret: trimmed.slice(i + 1).trim() };
      }
      diag = "secret is not valid JSON";
    }
  }
  const id = Deno.env.get("YOUTUBE_OAUTH_CLIENT_ID");
  const secret = Deno.env.get("YOUTUBE_OAUTH_CLIENT_SECRET");
  if (id && secret) return { client_id: id, client_secret: secret };

  throw new Error(
    `YouTube setup pending: Google OAuth client credentials not usable (${diag}). Save the full Google OAuth client JSON (with client_id + client_secret) in the YOUTUBE_OAUTH_CLIENT_JSON secret, then try again.`,
  );

}

async function getUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) throw new Error("AUTH_REQUIRED: sign in first");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw new Error("AUTH_REQUIRED: invalid session");
  return data.user.id;
}

/** Default channel for a user: is_default row, else most recently connected. */
export async function getDefaultConnection(db: any, userId: string): Promise<any | null> {
  const { data } = await db
    .from("youtube_connections")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("connected_at", { ascending: false })
    .limit(1);
  return (data && data[0]) || null;
}

/** Resolves a specific channel connection, falling back to the default one. */
export async function getConnectionForAccount(
  db: any,
  userId: string,
  accountId?: string | null,
): Promise<any | null> {
  if (accountId) {
    const { data } = await db
      .from("youtube_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("channel_id", accountId)
      .limit(1);
    if (data && data[0]) return data[0];
    return null;
  }
  return await getDefaultConnection(db, userId);
}

/** account_id/channel_id override from the request body (several accepted key names). */
function bodyAccountId(body: any): string | null {
  const v = body?.account_id ?? body?.accountId ?? body?.channel_id ?? body?.channelIdOverride ?? null;
  return v ? String(v).trim() || null : null;
}

export async function refreshIfNeeded(conn: any): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error("YT_REAUTH_REQUIRED: please reconnect your YouTube channel");

  const { client_id, client_secret } = await getOAuthClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`YT_REAUTH_REQUIRED: ${json.error_description || json.error || "token refresh failed"}`);
  }
  await admin()
    .from("youtube_connections")
    .update({
      access_token: json.access_token,
      token_expires_at: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    })
    .eq("user_id", conn.user_id)
    .eq("channel_id", conn.channel_id);
  return json.access_token;
}

/**
 * Precise mapping of Google/YouTube HTTP errors so the user never sees a
 * confusing raw API message. Returns a structured, actionable object.
 */
export function mapGoogleApiError(
  status: number,
  json: any,
  ctx: { videoId?: string } = {},
): {
  success: false;
  code: string;
  http_status: number;
  reason: string;
  error: string;
  action: string;
  retryable: boolean;
  raw?: string;
} {
  const err = json?.error || {};
  const reason = String(err?.errors?.[0]?.reason || err?.status || "").trim();
  const raw = String(err?.message || "").trim();
  const base = { http_status: status, reason, raw, success: false as const };

  if (status === 401) {
    return {
      ...base,
      code: "YT_REAUTH_REQUIRED",
      error:
        "YouTube ka access token expire/invalid ho gaya hai (401). Channel dobara connect karna padega.",
      action: "reconnect_youtube",
      retryable: false,
    };
  }

  if (status === 403) {
    const quotaReasons = [
      "quotaExceeded",
      "dailyLimitExceeded",
      "rateLimitExceeded",
      "userRateLimitExceeded",
      "servingLimitExceeded",
    ];
    if (quotaReasons.includes(reason) || /quota|rate limit/i.test(raw)) {
      const isRate = /rateLimit/i.test(reason) || /rate limit/i.test(raw);
      return {
        ...base,
        code: isRate ? "YT_RATE_LIMIT" : "YT_QUOTA_EXCEEDED",
        error: isRate
          ? "YouTube API rate limit hit ho gayi (403). Thodi der ruk kar dobara try karo."
          : "Aaj ka YouTube API daily quota khatam ho gaya hai (403). Quota IST midnight ke baad reset hota hai.",
        action: isRate ? "retry_after_short_wait" : "retry_tomorrow",
        retryable: true,
      };
    }
    if (
      ["forbidden", "insufficientPermissions", "videoNotEditable", "authorizationError", "accessNotConfigured"]
        .includes(reason) || /permission|scope|not authorized|not enabled/i.test(raw)
    ) {
      return {
        ...base,
        code: reason === "accessNotConfigured" ? "YT_API_NOT_ENABLED" : "YT_PERMISSION_DENIED",
        error:
          reason === "accessNotConfigured"
            ? "Google Cloud project me YouTube API enable nahi hai (403). Admin ko YouTube Data API v3 enable karna hoga."
            : "Is action ki permission nahi hai (403). Ye video aapke connected channel ka nahi hai, ya edit scope (youtube.force-ssl) missing hai.",
        action: reason === "accessNotConfigured" ? "contact_admin" : "reconnect_youtube_with_edit_scope",
        retryable: false,
      };
    }
    return {
      ...base,
      code: "YT_FORBIDDEN",
      error: `YouTube ne ye request reject kar di (403): ${raw || reason || "forbidden"}`,
      action: "review_request",
      retryable: false,
    };
  }

  if (status === 404) {
    return {
      ...base,
      code: "YT_NOT_FOUND",
      error: ctx.videoId
        ? `Video id "${ctx.videoId}" YouTube pe nahi mili (404). Id galat hai ya video delete ho chuki hai — list_my_youtube_videos se sahi id lo.`
        : "Requested YouTube resource nahi mila (404).",
      action: "verify_video_id",
      retryable: false,
    };
  }

  if (status === 400) {
    return {
      ...base,
      code: "YT_INVALID_REQUEST",
      error: `YouTube ne request invalid bataya (400): ${raw || reason || "invalid value"}. Title/description/tags/category value check karo.`,
      action: "fix_fields",
      retryable: false,
    };
  }

  if (status === 409) {
    return {
      ...base,
      code: "YT_CONFLICT",
      error: "Video ki state conflict me hai (409) — processing/upload complete hone ke baad try karo.",
      action: "retry_after_short_wait",
      retryable: true,
    };
  }

  if (status === 429) {
    return {
      ...base,
      code: "YT_RATE_LIMIT",
      error: "Bahut zyada requests (429). Thodi der baad try karo.",
      action: "retry_after_short_wait",
      retryable: true,
    };
  }

  if (status >= 500) {
    return {
      ...base,
      code: "YT_SERVER_ERROR",
      error: `YouTube server side error (${status}). Ye temporary hai — dobara try karo.`,
      action: "retry_after_short_wait",
      retryable: true,
    };
  }

  return {
    ...base,
    code: "YT_UNKNOWN_ERROR",
    error: `YouTube API error (${status}): ${raw || reason || "unknown"}`,
    action: "review_request",
    retryable: false,
  };
}

const gapi = async (url: string, token: string) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mapped = mapGoogleApiError(res.status, json);
    const e = new Error(`${mapped.code}: ${mapped.error}`) as Error & { mapped?: unknown };
    e.mapped = mapped;
    throw e;
  }
  return json;
};

const isoToSeconds = (iso: string): number => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "") || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/** Handles a growth action. Returns the JSON payload (caller wraps in Response). */
export async function handleGrowthAction(
  action: GrowthAction,
  body: any,
  req: Request,
): Promise<any> {
  const db = admin();

  if (action === "yt_oauth_url") {
    const { client_id } = await getOAuthClient();
    const userId = await getUserId(req);
    const redirectUri: string = body.redirectUri;
    if (!redirectUri) throw new Error("redirectUri is required");
    const origin = String(body.origin || "");
    if (!/^https?:\/\/[^\s/]+$/.test(origin)) throw new Error("origin is required");
    // Same unified redirect URI as every other Google connect; state carries
    // the site origin so the callback can bounce back to the right site.
    const params = new URLSearchParams({
      client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "select_account consent",
      include_granted_scopes: "true",
      scope: YT_SCOPES.join(" "),
      state: `wfh_yt|${userId}:${crypto.randomUUID()}|${origin}`,
    });
    return { success: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  if (action === "yt_oauth_exchange") {
    const userId = await getUserId(req);
    const { code, redirectUri } = body;
    if (!code || !redirectUri) throw new Error("code and redirectUri are required");
    const { client_id, client_secret } = await getOAuthClient();

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.access_token) {
      throw new Error(tok.error_description || tok.error || "OAuth exchange failed");
    }

    const ch = await gapi(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      tok.access_token,
    );
    const channel = ch.items?.[0];
    if (!channel) throw new Error("No YouTube channel found on this Google account");

    // First channel connected for this user becomes the default; a new channel
    // never touches/overwrites any other already-connected channel.
    const { count: existingCount } = await db
      .from("youtube_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const { data: existingSameChannel } = await db
      .from("youtube_connections")
      .select("is_default")
      .eq("user_id", userId)
      .eq("channel_id", channel.id)
      .limit(1);
    const isDefault = existingSameChannel?.[0]?.is_default ?? !existingCount;

    const row: Record<string, unknown> = {
      user_id: userId,
      channel_id: channel.id,
      channel_title: channel.snippet?.title,
      channel_thumbnail: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url,
      subscriber_count: parseInt(channel.statistics?.subscriberCount || "0"),
      access_token: tok.access_token,
      token_expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
      scope: tok.scope || YT_SCOPES.join(" "),
      connected_at: new Date().toISOString(),
      is_default: isDefault,
    };
    if (tok.refresh_token) row.refresh_token = tok.refresh_token;

    const { error } = await db.from("youtube_connections").upsert(row, { onConflict: "user_id,channel_id" });
    if (error) throw new Error(error.message);

    return {
      success: true,
      connection: {
        channelId: channel.id,
        channelTitle: row.channel_title,
        channelThumbnail: row.channel_thumbnail,
        subscriberCount: row.subscriber_count,
        isDefault,
      },
    };
  }

  if (action === "yt_status") {
    const userId = await getUserId(req);
    const data = await getConnectionForAccount(db, userId, bodyAccountId(body));
    return {
      success: true,
      connected: !!data,
      connection: data
        ? {
            channelId: data.channel_id,
            channelTitle: data.channel_title,
            channelThumbnail: data.channel_thumbnail,
            subscriberCount: Number(data.subscriber_count || 0),
            connectedAt: data.connected_at,
            isDefault: !!data.is_default,
          }
        : null,
    };
  }

  if (action === "yt_accounts_list") {
    const userId = await getUserId(req);
    const { data } = await db
      .from("youtube_connections")
      .select("channel_id, channel_title, is_default, connected_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("connected_at", { ascending: false });
    return {
      success: true,
      accounts: (data || []).map((r: any) => ({
        account_id: r.channel_id,
        name: r.channel_title,
        is_default: !!r.is_default,
        enabled: true,
      })),
    };
  }

  if (action === "yt_set_default") {
    const userId = await getUserId(req);
    const accountId = bodyAccountId(body);
    if (!accountId) throw new Error("account_id is required");
    const { data: target } = await db
      .from("youtube_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("channel_id", accountId)
      .limit(1);
    if (!target?.length) throw new Error("Channel not found");
    await db.from("youtube_connections").update({ is_default: false }).eq("user_id", userId);
    await db.from("youtube_connections").update({ is_default: true }).eq("user_id", userId).eq("channel_id", accountId);
    return { success: true, account_id: accountId };
  }

  if (action === "yt_disconnect") {
    const userId = await getUserId(req);
    const accountId = bodyAccountId(body);
    const conn = await getConnectionForAccount(db, userId, accountId);
    if (!conn) return { success: true, connected: false, message: "No YouTube channel connected" };
    const revokeToken = conn?.refresh_token || conn?.access_token;
    if (revokeToken) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(revokeToken)}`, {
        method: "POST",
      }).catch(() => null);
    }
    await db.from("youtube_connections").delete().eq("user_id", userId).eq("channel_id", conn.channel_id);
    await db.from("youtube_analytics_cache").delete().eq("user_id", userId);
    await db.from("youtube_autoreply_settings").delete().eq("user_id", userId).eq("account_id", conn.channel_id);

    // Promote another channel to default if the disconnected one was default.
    if (conn.is_default) {
      const { data: rest } = await db
        .from("youtube_connections")
        .select("channel_id")
        .eq("user_id", userId)
        .order("connected_at", { ascending: false })
        .limit(1);
      if (rest?.length) {
        await db.from("youtube_connections").update({ is_default: true }).eq("user_id", userId).eq("channel_id", rest[0].channel_id);
      }
    }

    const { count: remaining } = await db
      .from("youtube_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return { success: true, connected: !!remaining, message: "YouTube channel disconnected and stored data deleted" };
  }

  if (action === "yt_snapshot") {
    const userId = await getUserId(req);
    // days === 0 means "Lifetime" (since channel creation)
    const days: number = [0, 7, 28, 90, 365].includes(Number(body.days)) ? Number(body.days) : 28;
    const cacheKey = `snapshot_${days}`;

    if (body.force !== true) {
      const { data: cached } = await db
        .from("youtube_analytics_cache")
        .select("data, expires_at")
        .eq("user_id", userId)
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return { success: true, cached: true, ...(cached.data as Record<string, unknown>) };
      }
    }

    const conn = await getConnectionForAccount(db, userId, bodyAccountId(body));
    if (!conn) return { success: false, connected: false, error: "YouTube not connected" };

    const token = await refreshIfNeeded(conn);
    const snapshot = await buildSnapshot(token, days);

    await db.from("youtube_connections").update({
      subscriber_count: snapshot.channel?.subscriberCount ?? conn.subscriber_count,
      channel_title: snapshot.channel?.title ?? conn.channel_title,
      channel_thumbnail: snapshot.channel?.thumbnail ?? conn.channel_thumbnail,
    }).eq("user_id", userId).eq("channel_id", conn.channel_id);

    await db.from("youtube_analytics_cache").upsert(
      {
        user_id: userId,
        cache_key: cacheKey,
        data: snapshot as unknown as Record<string, unknown>,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,cache_key" },
    );

    return { success: true, cached: false, ...snapshot };
  }

  if (action === "yt_video") {
    const userId = await getUserId(req);
    const videoId = String(body.videoId || "").trim();
    if (!videoId) throw new Error("videoId is required");
    const days: number = [0, 7, 28, 90, 365].includes(Number(body.days)) ? Number(body.days) : 28;

    const conn = await getConnectionForAccount(db, userId, bodyAccountId(body));
    if (!conn) return { success: false, connected: false, error: "YouTube not connected" };

    const token = await refreshIfNeeded(conn);
    const detail = await buildVideoAnalytics(token, videoId, days);
    return { success: true, connected: true, ...detail };
  }

  // ---- Editing (requires youtube.force-ssl scope) ----
  if (action === "yt_video_meta" || action === "yt_video_update") {
    const userId = await getUserId(req);
    const videoId = String(body.videoId || "").trim();
    if (!videoId) throw new Error("videoId is required");

    const conn = await getConnectionForAccount(db, userId, bodyAccountId(body));
    if (!conn) return { success: false, connected: false, error: "YouTube not connected" };

    const token = await refreshIfNeeded(conn);
    const canEdit = String(conn.scope || "").includes("youtube.force-ssl");

    if (action === "yt_video_meta") {
      const [vres, cres] = await Promise.all([
        gapi(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails,statistics&id=${videoId}`,
          token,
        ),
        gapi(
          "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN",
          token,
        ).catch(() => ({ items: [] })),
      ]);
      const v = vres.items?.[0];
      if (!v) throw new Error("Video not found on your channel");
      return {
        success: true,
        connected: true,
        canEdit,
        video: {
          videoId,
          title: v.snippet?.title || "",
          description: v.snippet?.description || "",
          tags: v.snippet?.tags || [],
          categoryId: v.snippet?.categoryId || "",
          defaultLanguage: v.snippet?.defaultLanguage || "",
          thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || "",
          publishedAt: v.snippet?.publishedAt,
          privacyStatus: v.status?.privacyStatus || "private",
          publishAt: v.status?.publishAt || "",

          license: v.status?.license || "youtube",
          embeddable: v.status?.embeddable !== false,
          publicStatsViewable: v.status?.publicStatsViewable !== false,
          madeForKids: !!v.status?.madeForKids,
          duration: v.contentDetails?.duration || "",
        },
        categories: (cres.items || [])
          .filter((c: any) => c.snippet?.assignable)
          .map((c: any) => ({ id: c.id, title: c.snippet.title })),
      };
    }

    // yt_video_update
    if (!canEdit) {
      throw new Error(
        "YT_REAUTH_REQUIRED: editing permission missing. Disconnect and reconnect your YouTube channel to grant edit access.",
      );
    }

    const p = body.patch || {};

    // Read what is live right now + the assignable category list, so validation can
    // refuse an empty/invalid AI payload instead of wiping good metadata.
    const [curRes, catRes] = await Promise.all([
      gapi(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
        token,
      ).catch(() => ({ items: [] })),
      gapi(
        "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN",
        token,
      ).catch(() => ({ items: [] })),
    ]);
    const cur = curRes.items?.[0];
    const currentMeta = {
      title: cur?.snippet?.title || "",
      description: cur?.snippet?.description || "",
      tags: (cur?.snippet?.tags || []) as string[],
      categoryId: String(cur?.snippet?.categoryId || ""),
    };
    const allowedCategories = (catRes.items || [])
      .filter((c: any) => c.snippet?.assignable)
      .map((c: any) => ({ id: String(c.id), title: String(c.snippet.title) }));

    const built = buildYouTubePayload(
      {
        title: p.title,
        description: p.description,
        tags: p.tags,
        hashtags: p.hashtags,
        categoryId: p.categoryId,
      },
      { current: currentMeta, allowedCategories },
    );

    if (!built.ok) {
      console.warn("[YT update] refused invalid SEO payload:", built.errors.join(" | "));
      return {
        success: false,
        connected: true,
        code: "YT_INVALID_SEO",
        error: built.errors[0] || "SEO data is not valid — nothing was updated.",
        errors: built.errors,
        removed: built.removed,
      };
    }

    const clean = built.payload;

    // Scheduled publish: YouTube only accepts publishAt while the video is private.
    const publishAtRaw = typeof p.publishAt === "string" ? p.publishAt.trim() : "";
    const publishAtDate = publishAtRaw ? new Date(publishAtRaw) : null;
    const publishAt =
      publishAtDate && !isNaN(publishAtDate.getTime()) && publishAtDate.getTime() > Date.now()
        ? publishAtDate.toISOString()
        : "";

    const payload: Record<string, unknown> = {
      id: videoId,
      snippet: {
        title: clean.title,
        description: clean.description,
        tags: clean.tags,
        categoryId: clean.categoryId,
        ...(p.defaultLanguage ? { defaultLanguage: String(p.defaultLanguage) } : {}),
      },
      status: {
        privacyStatus: publishAt
          ? "private"
          : ["public", "private", "unlisted"].includes(p.privacyStatus)
            ? p.privacyStatus
            : (cur?.status?.privacyStatus || "private"),
        ...(publishAt ? { publishAt } : {}),
        embeddable: p.embeddable !== false,
        publicStatsViewable: p.publicStatsViewable !== false,
        selfDeclaredMadeForKids: !!p.madeForKids,
        ...(p.license ? { license: String(p.license) } : {}),
      },
    };


    const willChange = changedFields(clean, currentMeta);

    const upRes = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const upJson = await upRes.json().catch(() => ({}));
    if (!upRes.ok) throw new Error(upJson?.error?.message || `Update failed (${upRes.status})`);

    // Optional thumbnail upload (base64 data, jpeg/png, < 2MB)
    let thumbnailUpdated = false;
    if (typeof p.thumbnailBase64 === "string" && p.thumbnailBase64.length > 100) {
      const raw = p.thumbnailBase64.replace(/^data:[^,]+,/, "");
      const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const tRes = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": String(p.thumbnailMime || "image/jpeg"),
          },
          body: bin,
        },
      );
      const tJson = await tRes.json().catch(() => ({}));
      if (!tRes.ok) throw new Error(tJson?.error?.message || "Thumbnail upload failed");
      thumbnailUpdated = true;
    }

    // Invalidate cached snapshots so the studio list reflects the edit
    await db.from("youtube_analytics_cache").delete().eq("user_id", userId);

    return {
      success: true,
      connected: true,
      thumbnailUpdated,
      changed: willChange,
      removedTags: built.removed,
      categoryCorrected: built.categoryCorrected,
      applied: { ...clean },
      video: upJson,
    };
  }

  // ---- Upload: start a resumable upload session; browser PUTs the file bytes ----
  if (action === "yt_upload_init" || action === "yt_upload_categories" || action === "yt_upload_thumbnail") {
    const userId = await getUserId(req);
    const conn = await getConnectionForAccount(db, userId, bodyAccountId(body));
    if (!conn) return { success: false, connected: false, error: "YouTube not connected" };

    const token = await refreshIfNeeded(conn);
    const canEdit = String(conn.scope || "").includes("youtube.force-ssl") ||
      String(conn.scope || "").includes("youtube.upload");

    if (action === "yt_upload_categories") {
      const cres = await gapi(
        "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN",
        token,
      ).catch(() => ({ items: [] }));
      return {
        success: true,
        connected: true,
        canEdit,
        categories: (cres.items || [])
          .filter((c: any) => c.snippet?.assignable)
          .map((c: any) => ({ id: c.id, title: c.snippet.title })),
      };
    }

    if (action === "yt_upload_thumbnail") {
      const videoId = String(body.videoId || "").trim();
      const b64 = String(body.thumbnailBase64 || "").replace(/^data:[^,]+,/, "");
      if (!videoId || b64.length < 100) throw new Error("videoId and thumbnail are required");
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const tRes = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": String(body.thumbnailMime || "image/jpeg"),
          },
          body: bin,
        },
      );
      const tJson = await tRes.json().catch(() => ({}));
      if (!tRes.ok) throw new Error(tJson?.error?.message || "Thumbnail upload failed");
      return { success: true, connected: true, thumbnailUpdated: true };
    }

    // yt_upload_init
    if (!canEdit) {
      throw new Error(
        "YT_REAUTH_REQUIRED: upload permission missing. Disconnect and reconnect your YouTube channel to grant upload access.",
      );
    }

    const p = body.meta || {};
    const title = String(p.title || "").trim();
    if (!title) throw new Error("Title is required");
    const fileSize = Number(body.fileSize || 0);
    const fileType = String(body.fileType || "video/*");
    if (!fileSize) throw new Error("fileSize is required");

    const metaPayload = {
      snippet: {
        title: title.slice(0, 100),
        description: String(p.description || "").slice(0, 5000),
        tags: Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 60) : [],
        categoryId: String(p.categoryId || "22"),
        ...(p.defaultLanguage ? { defaultLanguage: String(p.defaultLanguage) } : {}),
      },
      status: {
        privacyStatus: ["public", "private", "unlisted"].includes(p.privacyStatus) ? p.privacyStatus : "private",
        embeddable: p.embeddable !== false,
        publicStatsViewable: p.publicStatsViewable !== false,
        selfDeclaredMadeForKids: !!p.madeForKids,
        license: p.license ? String(p.license) : "youtube",
        ...(p.publishAt ? { publishAt: String(p.publishAt), privacyStatus: "private" } : {}),
      },
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(fileSize),
          "X-Upload-Content-Type": fileType,
        },
        body: JSON.stringify(metaPayload),
      },
    );
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Upload init failed (${initRes.status})`);
    }
    const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
    if (!uploadUrl) throw new Error("Could not start upload session");

    await db.from("youtube_analytics_cache").delete().eq("user_id", userId);
    return { success: true, connected: true, uploadUrl };
  }

  throw new Error(`Unknown growth action: ${action}`);

}

/** Read-only snapshot: channel stats, per-day analytics, recent + top videos, derived scores. */
export async function buildSnapshot(token: string, days: number) {
  const lifetime = !days || days <= 0;

  // 1) Channel
  const chRes = await gapi(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings,status,topicDetails&mine=true",
    token,
  );
  const ch = chRes.items?.[0];
  if (!ch) throw new Error("No YouTube channel found");
  const channel = {
    id: ch.id,
    title: ch.snippet?.title,
    description: ch.snippet?.description,
    thumbnail: ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url,
    banner: ch.brandingSettings?.image?.bannerExternalUrl || null,
    keywords: ch.brandingSettings?.channel?.keywords || null,
    country: ch.snippet?.country || ch.brandingSettings?.channel?.country || null,
    customUrl: ch.snippet?.customUrl,
    publishedAt: ch.snippet?.publishedAt,
    privacyStatus: ch.status?.privacyStatus || null,
    madeForKids: ch.status?.madeForKids ?? null,
    topicCategories: (ch.topicDetails?.topicCategories || []).map((t: string) =>
      decodeURIComponent(String(t).split("/").pop() || "").replace(/_/g, " ")
    ),
    subscriberCount: parseInt(ch.statistics?.subscriberCount || "0"),
    hiddenSubscriberCount: !!ch.statistics?.hiddenSubscriberCount,
    viewCount: parseInt(ch.statistics?.viewCount || "0"),
    videoCount: parseInt(ch.statistics?.videoCount || "0"),
  };

  const endDate = fmtDate(new Date());
  const channelStart = channel.publishedAt ? fmtDate(new Date(channel.publishedAt)) : "2005-02-14";
  const spanDays = lifetime
    ? Math.max(1, Math.round((Date.now() - new Date(channel.publishedAt || "2005-02-14").getTime()) / 86400000))
    : days;
  const startDate = lifetime ? channelStart : fmtDate(new Date(Date.now() - days * 86400000));
  const prevStart = fmtDate(new Date(Date.now() - spanDays * 2 * 86400000));
  const prevEnd = fmtDate(new Date(Date.now() - (spanDays + 1) * 86400000));


  // 2) Daily analytics (YouTube Analytics API — read only)
  const anaUrl = (metrics: string, extra = "") =>
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}${extra}`;

  let daily: Array<Record<string, number | string>> = [];
  let totals: Record<string, number> = {};
  let analyticsError: string | null = null;
  const DAILY_METRICS =
    "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,dislikes,shares,comments";
  try {
    const rep = await gapi(anaUrl(DAILY_METRICS, "&dimensions=day&sort=day"), token);
    const cols: string[] = (rep.columnHeaders || []).map((c: any) => c.name);
    daily = (rep.rows || []).map((r: any[]) => {
      const o: Record<string, number | string> = {};
      cols.forEach((c, i) => (o[c] = r[i]));
      return o;
    });
    const rows = rep.rows || [];
    totals = cols.reduce((acc: Record<string, number>, c, i) => {
      if (c === "day") return acc;
      const sum = rows.reduce((s: number, r: any[]) => s + (Number(r[i]) || 0), 0);
      // averages must not be summed
      acc[c] = c.startsWith("average") ? (rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0) : sum;
      return acc;
    }, {});
  } catch (e) {
    analyticsError = e instanceof Error ? e.message : "Analytics unavailable";
  }

  // Previous period comparison
  const prevTotals: Record<string, number> = {};
  if (!analyticsError && !lifetime) {
    try {
      const rep = await gapi(
        `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${prevStart}&endDate=${prevEnd}&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost`,
        token,
      );
      const cols: string[] = (rep.columnHeaders || []).map((c: any) => c.name);
      const row = rep.rows?.[0] || [];
      cols.forEach((c, i) => (prevTotals[c] = Number(row[i]) || 0));
    } catch { /* optional */ }
  }

  const dimReport = async (dimension: string, max = 10) => {
    try {
      const rep = await gapi(anaUrl("views", `&dimensions=${dimension}&sort=-views&maxResults=${max}`), token);
      return (rep.rows || []).map((r: any[]) => ({ key: String(r[0]), views: Number(r[1]) || 0 }));
    } catch {
      return [];
    }
  };

  // Traffic sources + audience breakdowns (helps explain reach problems)
  let trafficSources: Array<{ source: string; views: number }> = [];
  let countries: Array<{ key: string; views: number }> = [];
  let devices: Array<{ key: string; views: number }> = [];
  let subscribedStatus: Array<{ key: string; views: number }> = [];
  if (!analyticsError) {
    const [ts, co, de, ss] = await Promise.all([
      dimReport("insightTrafficSourceType", 10),
      dimReport("country", 10),
      dimReport("deviceType", 10),
      dimReport("subscribedStatus", 5),
    ]);
    trafficSources = (ts as Array<{ key: string; views: number }>).map((r) => ({ source: r.key, views: r.views }));
    countries = co;
    devices = de;
    subscribedStatus = ss;
  }

  // 3) All uploads via uploads playlist (paginated)
  const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
  let videos: any[] = [];
  if (uploadsId) {
    const ids: string[] = [];
    let pageToken = "";
    for (let page = 0; page < 4; page++) {
      const pl = await gapi(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`,
        token,
      );
      for (const i of pl.items || []) {
        const id = i.contentDetails?.videoId;
        if (id) ids.push(id);
      }
      pageToken = pl.nextPageToken || "";
      if (!pageToken) break;
    }

    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const vres = await gapi(
        
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status,topicDetails,liveStreamingDetails&id=${chunk.join(",")}`,
        token,
      );
      for (const v of vres.items || []) {
        const seconds = isoToSeconds(v.contentDetails?.duration);
        const publishedAt = v.snippet?.publishedAt;
        const ageDays = Math.max(1, Math.round((Date.now() - new Date(publishedAt).getTime()) / 86400000));
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");
        const favorites = parseInt(v.statistics?.favoriteCount || "0");
        videos.push({
          id: v.id,
          videoId: v.id,
          title: v.snippet?.title,
          description: v.snippet?.description || "",
          thumbnail:
            v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
          publishedAt,
          ageDays,
          durationSeconds: seconds,
          duration: v.contentDetails?.duration || "",
          isShort: seconds > 0 && seconds <= 181,
          isLive: !!v.liveStreamingDetails,
          privacyStatus: v.status?.privacyStatus || null,
          categoryId: v.snippet?.categoryId || null,
          views,
          likes,
          comments,
          favorites,
          viewsPerDay: Math.round((views / ageDays) * 10) / 10,
          engagementRate: views ? Math.round(((likes + comments) / views) * 1000) / 10 : 0,
          tags: v.snippet?.tags?.slice(0, 10) || [],
          topics: [
            ...(v.topicDetails?.topicCategories || []),
          ].map((t: string) => decodeURIComponent(String(t).split("/").pop() || "").replace(/_/g, " ")),
        });
      }
    }
  }

  // Real YouTube categories (People & Blogs etc.) from each video's categoryId
  try {
    const catCounts = new Map<string, number>();
    for (const v of videos) if (v.categoryId) catCounts.set(String(v.categoryId), (catCounts.get(String(v.categoryId)) || 0) + 1);
    if (catCounts.size) {
      const ids = [...catCounts.keys()];
      const nameById = new Map<string, string>();
      // id-based lookup works regardless of region
      try {
        const byId = await gapi(
          `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${ids.join(",")}`,
          token,
        );
        for (const c of byId.items || []) nameById.set(String(c.id), c.snippet?.title || String(c.id));
      } catch (_e) { /* fall back to region list */ }
      if (!nameById.size) {
        const region = channel.country || "US";
        const catRes = await gapi(
          `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=${region}`,
          token,
        );
        for (const c of catRes.items || []) nameById.set(String(c.id), c.snippet?.title || String(c.id));
      }
      const list = ids
        .map((id) => ({ id, name: nameById.get(id) || `Category ${id}`, count: catCounts.get(id) || 0 }))
        .sort((a, b) => b.count - a.count);
      (channel as any).categories = list;
      (channel as any).primaryCategory = list[0]?.name || null;
    }
  } catch (_e) {
    // categories are optional
  }


  // Topics: channel-level topicDetails + video topics (Wikipedia topic taxonomy).
  // Drop YouTube's generic parent buckets so only meaningful topics remain.
  {
    const GENERIC = new Set([
      "knowledge",
      "society",
      "lifestyle (sociology)",
      "entertainment",
      "hobby",
      "music",
      "sport",
      "activities",
      "other",
    ]);
    const counts = new Map<string, number>();
    for (const t of channel.topicCategories as string[]) counts.set(t, (counts.get(t) || 0) + 1000);
    for (const v of videos) for (const t of (v.topics || []) as string[]) {
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
    const all = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
    const specific = all.filter((t) => !GENERIC.has(t.trim().toLowerCase()));
    channel.topicCategories = specific.length ? specific : all;
  }




  const sortedByViews = [...videos].sort((a, b) => b.views - a.views);
  const recent = [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  ).slice(0, 12);

  // Real audience feedback for the newest upload. Comment access can be
  // disabled per video/channel, so this is deliberately best-effort.
  let recentComments: Array<Record<string, unknown>> = [];
  const newestVideoId = recent[0]?.videoId;
  if (newestVideoId) {
    try {
      const commentRes = await gapi(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${newestVideoId}&maxResults=20&order=relevance&textFormat=plainText`,
        token,
      );
      recentComments = (commentRes.items || []).map((item: any) => {
        const top = item.snippet?.topLevelComment?.snippet || {};
        return {
          text: String(top.textDisplay || top.textOriginal || "").slice(0, 500),
          author: top.authorDisplayName || "YouTube user",
          likes: Number(top.likeCount || 0),
          publishedAt: top.publishedAt || null,
          replyCount: Number(item.snippet?.totalReplyCount || 0),
        };
      }).filter((comment: Record<string, unknown>) => Boolean(comment.text));
    } catch (e) {
      console.warn("[YouTube Growth] latest-video comments unavailable:", e);
    }
  }
  const topVideos = sortedByViews.slice(0, 10);
  const weakVideos = sortedByViews.slice(-5).reverse();

  const medianViews = (() => {
    if (!videos.length) return 0;
    const s = [...videos].map((v) => v.views).sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  })();

  const shorts = videos.filter((v) => v.isShort);
  const longs = videos.filter((v) => !v.isShort);
  const avg = (arr: any[], k: string) => (arr.length ? Math.round(arr.reduce((s, v) => s + v[k], 0) / arr.length) : 0);

  // Upload consistency over the last 90 days
  const last90 = videos.filter((v) => v.ageDays <= 90);
  const uploadsPerWeek = Math.round((last90.length / 13) * 10) / 10;
  const gapsDays = (() => {
    const dates = [...videos]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 12)
      .map((v) => new Date(v.publishedAt).getTime());
    const gaps: number[] = [];
    for (let i = 0; i < dates.length - 1; i++) gaps.push(Math.round((dates[i] - dates[i + 1]) / 86400000));
    return gaps;
  })();
  const avgGap = gapsDays.length ? Math.round(gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length) : null;

  const engagementRate = totals.views
    ? Math.round((((totals.likes || 0) + (totals.comments || 0)) / totals.views) * 1000) / 10
    : videos.length
      ? Math.round((avg(videos, "engagementRate")) * 10) / 10
      : 0;

  const netSubs = (totals.subscribersGained || 0) - (totals.subscribersLost || 0);
  const subsPer1kViews = totals.views ? Math.round((netSubs / totals.views) * 1000 * 10) / 10 : 0;
  const viewsChangePct = prevTotals.views ? Math.round(((totals.views - prevTotals.views) / prevTotals.views) * 1000) / 10 : null;
  const watchTimeChangePct = prevTotals.estimatedMinutesWatched
    ? Math.round(((totals.estimatedMinutesWatched - prevTotals.estimatedMinutesWatched) / prevTotals.estimatedMinutesWatched) * 1000) / 10
    : null;

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const consistencyScore = clamp(avgGap === null ? 30 : avgGap <= 3 ? 95 : avgGap <= 7 ? 85 : avgGap <= 14 ? 65 : avgGap <= 30 ? 40 : 20);
  const engagementScore = clamp(engagementRate * 20);
  const subscriberScore = clamp(subsPer1kViews * 15);
  const contentScore = clamp(medianViews && topVideos[0]?.views ? (medianViews / topVideos[0].views) * 120 : 30);
  const topicStrategyScore = (() => {
    if (videos.length < 4) return 30;
    const above = videos.filter((v) => v.views >= medianViews).length;
    return clamp((above / videos.length) * 160);
  })();
  const trendScore = clamp(viewsChangePct === null ? 50 : 50 + viewsChangePct);
  const overallScore = clamp(
    consistencyScore * 0.2 + engagementScore * 0.2 + subscriberScore * 0.2 + contentScore * 0.15 + topicStrategyScore * 0.15 + trendScore * 0.1,
  );

  return {
    connected: true,
    range: { days, startDate, endDate },
    channel,
    analyticsError,
    totals: {
      views: totals.views || 0,
      estimatedMinutesWatched: totals.estimatedMinutesWatched || 0,
      averageViewDuration: totals.averageViewDuration || 0,
      averageViewPercentage: totals.averageViewPercentage || 0,
      subscribersGained: totals.subscribersGained || 0,
      subscribersLost: totals.subscribersLost || 0,
      netSubscribers: netSubs,
      likes: totals.likes || 0,
      dislikes: totals.dislikes || 0,
      shares: totals.shares || 0,
      comments: totals.comments || 0,
      engagementRate,
      subsPer1kViews,
      viewsChangePct,
      watchTimeChangePct,
    },
    daily: daily.map((d) => ({
      date: String((d as any).day ?? (d as any).date ?? ""),
      views: Number((d as any).views) || 0,
      estimatedMinutesWatched: Number((d as any).estimatedMinutesWatched) || 0,
      averageViewDuration: Number((d as any).averageViewDuration) || 0,
      averageViewPercentage: Number((d as any).averageViewPercentage) || 0,
      subscribersGained: Number((d as any).subscribersGained) || 0,
      subscribersLost: Number((d as any).subscribersLost) || 0,
      likes: Number((d as any).likes) || 0,
      shares: Number((d as any).shares) || 0,
      comments: Number((d as any).comments) || 0,
    })),
    trafficSources,
    countries,
    devices,
    subscribedStatus,
    posts: {
      supported: false,
      items: [],
      note: "YouTube Data API does not expose community posts. Only videos and Shorts analytics are available.",
    },
    videos: {
      all: videos,
      recent,
      top: topVideos,
      weak: weakVideos,
      total: videos.length,
      medianViews,
      shortsCount: shorts.length,
      longCount: longs.length,
    },
    recentComments,
    format: {
      shorts: { count: shorts.length, avgViews: avg(shorts, "views"), avgEngagement: avg(shorts, "engagementRate") },
      longForm: { count: longs.length, avgViews: avg(longs, "views"), avgEngagement: avg(longs, "engagementRate") },
    },
    cadence: { uploadsPerWeekLast90: uploadsPerWeek, avgGapDays: avgGap, recentGaps: gapsDays },
    scores: {
      overall: overallScore,
      content: contentScore,
      consistency: consistencyScore,
      engagement: engagementScore,
      subscriberGrowth: subscriberScore,
      topicStrategy: topicStrategyScore,
      trend: trendScore,
    },
  };
}

/** Compact snapshot used as AI context (keeps prompt small). */
export async function getSnapshotForUser(userId: string, days = 28, accountId?: string | null): Promise<any | null> {
  const db = admin();
  const conn = await getConnectionForAccount(db, userId, accountId ?? null);
  if (!conn) return null;
  // Versioned separately from the dashboard snapshot because AI context now
  // includes real comments for the latest upload.
  const cacheKey = `snapshot_ai_v2_${days}_${conn.channel_id}`;
  const { data: cached } = await db
    .from("youtube_analytics_cache")
    .select("data, expires_at")
    .eq("user_id", userId)
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() > Date.now()) return cached.data;

  try {
    const token = await refreshIfNeeded(conn);
    const snapshot = await buildSnapshot(token, days);
    await db.from("youtube_analytics_cache").upsert(
      {
        user_id: userId,
        cache_key: cacheKey,
        data: snapshot as unknown as Record<string, unknown>,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,cache_key" },
    );
    return snapshot;
  } catch (e) {
    console.error("[YouTube Growth] snapshot failed:", e);
    return cached?.data ?? null;
  }
}

/** Read-only per-video analytics for the connected channel. */
export async function buildVideoAnalytics(token: string, videoId: string, days: number) {
  const lifetime = !days || days <= 0;
  const endDate = fmtDate(new Date());

  const vres = await gapi(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoId}`,
    token,
  );
  const v = vres.items?.[0];
  if (!v) throw new Error("Video not found on your channel");

  const seconds = isoToSeconds(v.contentDetails?.duration);
  const publishedAt = v.snippet?.publishedAt;
  const ageDays = Math.max(1, Math.round((Date.now() - new Date(publishedAt).getTime()) / 86400000));
  const views = parseInt(v.statistics?.viewCount || "0");
  const likes = parseInt(v.statistics?.likeCount || "0");
  const comments = parseInt(v.statistics?.commentCount || "0");

  const video = {
    videoId: v.id,
    title: v.snippet?.title,
    description: v.snippet?.description || "",
    thumbnail:
      v.snippet?.thumbnails?.maxres?.url ||
      v.snippet?.thumbnails?.high?.url ||
      v.snippet?.thumbnails?.medium?.url,
    publishedAt,
    ageDays,
    durationSeconds: seconds,
    duration: v.contentDetails?.duration || "",
    isShort: seconds > 0 && seconds <= 181,
    privacyStatus: v.status?.privacyStatus || null,
    tags: v.snippet?.tags || [],
    categoryId: v.snippet?.categoryId || null,
    definition: v.contentDetails?.definition || null,
    caption: v.contentDetails?.caption === "true",
    lifetime: {
      views,
      likes,
      comments,
      favorites: parseInt(v.statistics?.favoriteCount || "0"),
      viewsPerDay: Math.round((views / ageDays) * 10) / 10,
      engagementRate: views ? Math.round(((likes + comments) / views) * 1000) / 10 : 0,
    },
  };

  const startDate = lifetime
    ? fmtDate(new Date(publishedAt))
    : fmtDate(new Date(Date.now() - days * 86400000));

  const filter = `&filters=video==${videoId}`;
  const anaUrl = (metrics: string, extra = "") =>
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}${filter}${extra}`;

  let analyticsError: string | null = null;
  let daily: any[] = [];
  let totals: Record<string, number> = {};
  const METRIC_SETS = [
    "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,dislikes,shares,comments",
    "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,shares,comments",
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments",
    "views,estimatedMinutesWatched,likes,comments",
    "views",
  ];

  for (const METRICS of METRIC_SETS) {
    try {
      const rep = await gapi(anaUrl(METRICS, "&dimensions=day&sort=day"), token);
      const cols: string[] = (rep.columnHeaders || []).map((c: any) => c.name);
      const rows: any[][] = rep.rows || [];
      daily = rows.map((r) => {
        const o: Record<string, number | string> = {};
        cols.forEach((c, i) => (o[c] = r[i]));
        return {
          date: String(o.day || ""),
          views: Number(o.views) || 0,
          estimatedMinutesWatched: Number(o.estimatedMinutesWatched) || 0,
          averageViewDuration: Number(o.averageViewDuration) || 0,
          averageViewPercentage: Number(o.averageViewPercentage) || 0,
          subscribersGained: Number(o.subscribersGained) || 0,
          subscribersLost: Number(o.subscribersLost) || 0,
          likes: Number(o.likes) || 0,
          shares: Number(o.shares) || 0,
          comments: Number(o.comments) || 0,
        };
      });
      totals = cols.reduce((acc: Record<string, number>, c, i) => {
        if (c === "day") return acc;
        const sum = rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);
        acc[c] = c.startsWith("average") ? (rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0) : sum;
        return acc;
      }, {});
      analyticsError = null;
      break;
    } catch (e) {
      analyticsError = e instanceof Error ? e.message : "Analytics unavailable";
    }
  }

  // Shorts (and very new videos) sometimes return no day-dimension rows.
  // Fall back to an un-dimensioned totals report so the page still has data.
  if (!daily.length) {
    for (const METRICS of METRIC_SETS) {
      try {
        const rep = await gapi(anaUrl(METRICS), token);
        const cols: string[] = (rep.columnHeaders || []).map((c: any) => c.name);
        const row: any[] = rep.rows?.[0] || [];
        if (!row.length) continue;
        totals = cols.reduce((acc: Record<string, number>, c, i) => {
          acc[c] = Number(row[i]) || 0;
          return acc;
        }, {});
        analyticsError = null;
        break;
      } catch (e) {
        analyticsError = e instanceof Error ? e.message : "Analytics unavailable";
      }
    }
  }

  // Final fallback: Shorts / brand-new videos often have no Analytics rows yet
  // (data lag or unsupported dimension). Use lifetime v3 statistics so the page
  // is not entirely zeros.
  const analyticsEmpty =
    !(totals.views || 0) && !(totals.likes || 0) && !(totals.comments || 0) &&
    !(totals.estimatedMinutesWatched || 0);
  if (analyticsEmpty && (views || likes || comments)) {
    totals = {
      ...totals,
      views,
      likes,
      comments,
    };
  }






  const dim = async (dimension: string, max = 10) => {
    try {
      const rep = await gapi(anaUrl("views", `&dimensions=${dimension}&sort=-views&maxResults=${max}`), token);
      return (rep.rows || []).map((r: any[]) => ({ key: String(r[0]), views: Number(r[1]) || 0 }));
    } catch {
      return [];
    }
  };

  const [trafficSources, countries, devices, subscribedStatus] = analyticsError
    ? [[], [], [], []]
    : await Promise.all([
        dim("insightTrafficSourceType"),
        dim("country"),
        dim("deviceType"),
        dim("subscribedStatus", 5),
      ]);

  // Audience-retention curve is a separate YouTube Analytics report. It is
  // available only when YouTube has enough processed audience data for the
  // video, so absence must be reported as unavailable rather than guessed.
  let retentionCurve: Array<{
    elapsedRatio: number;
    elapsedSeconds: number;
    audienceWatchRatio: number;
    relativeRetentionPerformance: number | null;
  }> = [];
  try {
    const rep = await gapi(
      anaUrl(
        "audienceWatchRatio,relativeRetentionPerformance",
        "&dimensions=elapsedVideoTimeRatio&sort=elapsedVideoTimeRatio",
      ),
      token,
    );
    const cols: string[] = (rep.columnHeaders || []).map((c: any) => c.name);
    retentionCurve = (rep.rows || []).map((row: any[]) => {
      const value = (name: string) => Number(row[cols.indexOf(name)]);
      const elapsedRatio = value("elapsedVideoTimeRatio") || 0;
      const relative = value("relativeRetentionPerformance");
      return {
        elapsedRatio,
        elapsedSeconds: Math.round(elapsedRatio * seconds),
        audienceWatchRatio: Math.round((value("audienceWatchRatio") || 0) * 1000) / 10,
        relativeRetentionPerformance: Number.isFinite(relative)
          ? Math.round(relative * 1000) / 1000
          : null,
      };
    });
  } catch {
    retentionCurve = [];
  }

  // Fetch real comments for the selected video, not only the channel's newest
  // upload. This lets the coach summarize actual audience feedback safely.
  let recentComments: Array<Record<string, unknown>> = [];
  try {
    const commentRes = await gapi(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=20&order=relevance&textFormat=plainText`,
      token,
    );
    recentComments = (commentRes.items || []).map((item: any) => {
      const top = item.snippet?.topLevelComment?.snippet || {};
      return {
        text: String(top.textDisplay || top.textOriginal || "").slice(0, 500),
        author: top.authorDisplayName || "YouTube user",
        likes: Number(top.likeCount || 0),
        publishedAt: top.publishedAt || null,
        replyCount: Number(item.snippet?.totalReplyCount || 0),
      };
    }).filter((comment: Record<string, unknown>) => Boolean(comment.text));
  } catch {
    recentComments = [];
  }

  return {
    range: { days, startDate, endDate },
    video,
    analyticsError,
    totals: {
      views: totals.views || 0,
      estimatedMinutesWatched: totals.estimatedMinutesWatched || 0,
      averageViewDuration: totals.averageViewDuration || 0,
      averageViewPercentage: totals.averageViewPercentage || 0,
      subscribersGained: totals.subscribersGained || 0,
      subscribersLost: totals.subscribersLost || 0,
      netSubscribers: (totals.subscribersGained || 0) - (totals.subscribersLost || 0),
      likes: totals.likes || 0,
      dislikes: totals.dislikes || 0,
      shares: totals.shares || 0,
      comments: totals.comments || 0,
    },
    daily,
    trafficSources: (trafficSources as any[]).map((t) => ({ source: t.key, views: t.views })),
    countries,
    devices,
    subscribedStatus,
    retentionCurve,
    recentComments,
  };
}

/** Cached private analytics for one video owned by the connected user. */
export async function getVideoAnalyticsForUser(
  userId: string,
  videoId: string,
  days = 28,
  accountId?: string | null,
): Promise<any | null> {
  if (!userId || !videoId) return null;
  const db = admin();
  const cacheKey = `video_ai_v1_${videoId}_${days}`;
  const { data: cached } = await db
    .from("youtube_analytics_cache")
    .select("data, expires_at")
    .eq("user_id", userId)
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() > Date.now()) return cached.data;

  const conn = await getConnectionForAccount(db, userId, accountId ?? null);
  if (!conn) return null;

  try {
    const token = await refreshIfNeeded(conn);
    const detail = await buildVideoAnalytics(token, videoId, days);
    await db.from("youtube_analytics_cache").upsert(
      {
        user_id: userId,
        cache_key: cacheKey,
        data: detail as unknown as Record<string, unknown>,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,cache_key" },
    );
    return detail;
  } catch (e) {
    console.error("[YouTube Growth] video analytics failed:", e);
    return cached?.data ?? null;
  }
}

// ---------------------------------------------------------------------------
// AI-driven video editing helpers (used by the AI chat tools).
// These let the assistant read a video's real metadata and apply a partial,
// merge-safe update (title / description / tags / category / privacy / schedule).
// ---------------------------------------------------------------------------

/**
 * The AI sometimes passes a slightly wrong video id (typo / mis-transcribed
 * from an earlier message). Instead of failing with "video not found", resolve
 * the closest id that actually exists on the connected channel.
 */
function idDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

/**
 * Pulls the bare 11-char video id out of whatever the model/user passed:
 * a full watch URL, a Shorts link, youtu.be, an embed URL, or the id itself.
 */
export function extractYoutubeVideoId(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const patterns = [
    /(?:v=|\/videos\/|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  // Last resort: first 11-char id-looking token in the string.
  const loose = raw.match(/[A-Za-z0-9_-]{11}/);
  return loose ? loose[0] : raw;
}

export async function resolveOwnedVideoId(
  userId: string,
  videoId: string,
  accountId?: string | null,
): Promise<{ videoId: string; corrected: boolean; candidates: any[] }> {
  const raw = extractYoutubeVideoId(videoId);
  let ids: any[] = [];
  try {
    const snap = await getSnapshotForUser(userId, 28, accountId ?? null);
    ids = Array.isArray(snap?.videos?.all) ? snap.videos.all : [];
  } catch (_e) { /* best effort */ }
  if (!ids.length) return { videoId: raw, corrected: false, candidates: [] };

  const exact = ids.find((v) => String(v.videoId) === raw);
  if (exact) return { videoId: raw, corrected: false, candidates: [] };

  // Video ids are case sensitive, so only fix a case mismatch when exactly one
  // owned video matches case-insensitively.
  const lower = raw.toLowerCase();
  const ciMatches = ids.filter((v) => String(v.videoId).toLowerCase() === lower);
  if (ciMatches.length === 1) {
    return { videoId: String(ciMatches[0].videoId), corrected: true, candidates: [] };
  }

  const candidates = [...ids]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10)
    .map((v) => ({ videoId: v.videoId, title: v.title, publishedAt: v.publishedAt }));

  // Only auto-correct a single-character typo, and never silently swap the id
  // for a different video: an ambiguous guess used to point the AI at the wrong
  // video, so keep the id as-is and let the caller verify it live instead.
  let best: any = null;
  let bestD = Infinity;
  let bestCount = 0;
  for (const v of ids) {
    const d = idDistance(lower, String(v.videoId).toLowerCase());
    if (d < bestD) { bestD = d; best = v; bestCount = 1; }
    else if (d === bestD) bestCount++;
  }
  if (best && bestD === 1 && bestCount === 1) {
    return { videoId: String(best.videoId), corrected: true, candidates };
  }

  // Not in the cached snapshot (it only covers recent videos) — keep the id so
  // the live API decides, and pass candidates along for the error path.
  return { videoId: raw, corrected: false, candidates };
}


async function connFor(userId: string, accountId?: string | null) {
  const db = admin();
  return await getConnectionForAccount(db, userId, accountId ?? null);
}

/** Compact list of the connected channel's own videos (id, title, privacy, stats). */
export async function listMyVideosForUser(userId: string, limit = 30) {
  const conn = await connFor(userId);
  if (!conn) return { success: false, connected: false, error: "YouTube not connected" };
  const snap = await getSnapshotForUser(userId, 28);
  const all: any[] = Array.isArray(snap?.videos?.all) ? snap.videos.all : [];
  const videos = [...all]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, Math.max(1, Math.min(60, limit)))
    .map((v) => {
      const desc = String(v.description || "");
      const tags: string[] = Array.isArray(v.tags) ? v.tags : [];
      return {
        videoId: v.videoId,
        title: v.title,
        publishedAt: v.publishedAt,
        privacyStatus: v.privacyStatus || "public",
        isShort: !!v.isShort,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        categoryId: v.categoryId || null,
        // Cached preview only — call get_my_youtube_video_meta for the FULL live text.
        descriptionPreview: desc.slice(0, 300),
        descriptionLength: desc.length,
        hasDescription: desc.trim().length > 0,
        hashtags: (desc.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 10),
        tagsPreview: tags.slice(0, 10),
        tagCount: tags.length,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
      };
    });

  return {
    success: true,
    connected: true,
    channel: snap?.channel?.title || conn.channel_title,
    count: videos.length,
    note:
      "descriptionPreview / tagsPreview / hashtags are cached previews. Never tell the user a field is empty based on this list — call get_my_youtube_video_meta for the full live description, tags and hashtags.",
    videos,
  };

}

/**
 * Truthful not-found reason for a video id. The old code said "channel pe nahi
 * mili" for every miss, even when the id was simply mistyped or belonged to
 * someone else's channel. Probe the public API to tell those cases apart.
 */
async function videoNotFoundResult(
  videoIdInput: string,
  videoId: string,
  channelId: string | null,
  candidates: any[],
) {
  let publicVideo: any = null;
  try {
    const auth = await getYoutubePublicAuth();
    if (auth.headers.Authorization || auth.keyParam) {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}${auth.keyParam ? `&key=${auth.keyParam}` : ""}`;
      const res = await fetch(url, { headers: auth.headers }).then((r) => r.json()).catch(() => null);
      publicVideo = res?.items?.[0] || null;
    }
  } catch (_e) { /* best effort */ }

  if (publicVideo) {
    const owner = publicVideo.snippet?.channelTitle || publicVideo.snippet?.channelId || "another channel";
    const sameChannel = channelId && publicVideo.snippet?.channelId === channelId;
    return {
      success: false,
      connected: true,
      code: sameChannel ? "YT_NOT_ACCESSIBLE" : "YT_NOT_OWNED",
      videoId,
      error: sameChannel
        ? `Video id "${videoId}" aapke channel ki hai lekin owner API se access nahi ho rahi — YouTube dobara connect karke permission dein.`
        : `Video id "${videoId}" aapke channel ki nahi hai — ye "${owner}" channel ki video hai, isliye edit nahi kar sakte.`,
      action: sameChannel ? "reconnect_youtube" : "verify_video_id",
      candidates,
    };
  }

  return {
    success: false,
    connected: true,
    code: "YT_NOT_FOUND",
    videoId,
    error: `Video id "${videoId}" YouTube pe hi exist nahi karti (galat id ya delete ho chuki hai). Sahi id ke liye list_my_youtube_videos use karein.`,
    action: "verify_video_id",
    candidates,
  };
}

/** Full editable metadata for one owned video + assignable categories. */
export async function getMyVideoMetaForUser(userId: string, videoIdInput: string, accountId?: string | null) {
  const conn = await connFor(userId, accountId ?? null);
  if (!conn) return { success: false, connected: false, error: "YouTube not connected" };
  const resolved = await resolveOwnedVideoId(userId, videoIdInput, accountId ?? null);
  const videoId = resolved.videoId;
  const token = await refreshIfNeeded(conn);
  const canEdit = String(conn.scope || "").includes("youtube.force-ssl");


  const [vres, cres] = await Promise.all([
    gapi(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails,statistics&id=${videoId}`,
      token,
    ),
    gapi(
      "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN",
      token,
    ).catch(() => ({ items: [] })),
  ]);
  const v = vres.items?.[0];
  if (!v) {
    return await videoNotFoundResult(
      videoIdInput,
      videoId,
      conn.channel_id || null,
      resolved.candidates,
    );
  }




  // Self-heal: if the owner-authorised call comes back without description/tags
  // (stale token scope, partial API response), fall back to the cached snapshot
  // and to the public record so the AI NEVER reports an empty field wrongly.
  let description = String(v.snippet?.description || "");
  let tags: string[] = Array.isArray(v.snippet?.tags) ? v.snippet.tags : [];
  const sources: string[] = ["youtube_owner_api"];

  if (!description.trim() || !tags.length) {
    try {
      const snap = await getSnapshotForUser(userId, 28, accountId ?? null);
      const cachedVideo = (Array.isArray(snap?.videos?.all) ? snap.videos.all : [])
        .find((x: any) => String(x.videoId) === String(videoId));
      if (cachedVideo) {
        if (!description.trim() && String(cachedVideo.description || "").trim()) {
          description = String(cachedVideo.description);
          sources.push("snapshot_cache_description");
        }
        if (!tags.length && Array.isArray(cachedVideo.tags) && cachedVideo.tags.length) {
          tags = cachedVideo.tags.map(String);
          sources.push("snapshot_cache_tags");
        }
      }
    } catch (_e) { /* cache is best-effort */ }
  }

  if (!description.trim()) {
    // Last resort: public record (description is public even when tags are not).
    try {
      const auth = await getYoutubePublicAuth();
      const pubUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}${auth.keyParam ? `&key=${auth.keyParam}` : ""}`;
      const pub = await fetch(pubUrl, { headers: auth.headers }).then((r) => r.json()).catch(() => null);
      const pd = String(pub?.items?.[0]?.snippet?.description || "");
      if (pd.trim()) {
        description = pd;
        sources.push("public_api_description");
      }
    } catch (_e) { /* best-effort */ }
  }


  const hashtags = description.match(/#[\p{L}\p{N}_]+/gu) || [];

  return {
    success: true,
    connected: true,
    canEdit,
    fieldSources: sources,
    note:
      "This is the LIVE metadata of the user's own video. description/tags/hashtags here are complete. Only say a field is empty when hasDescription / hasTags / hasHashtags is false — never guess from a preview or from public data.",
    video: {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: v.snippet?.title || "",
      description,
      descriptionLength: description.length,
      hasDescription: description.trim().length > 0,
      hashtags,
      hasHashtags: hashtags.length > 0,
      tags,
      hasTags: tags.length > 0,
      tagCount: tags.length,
      tagsCharCount: tags.join(",").length,


      categoryId: v.snippet?.categoryId || "",
      defaultLanguage: v.snippet?.defaultLanguage || "",
      publishedAt: v.snippet?.publishedAt,
      privacyStatus: v.status?.privacyStatus || "private",
      publishAt: v.status?.publishAt || null,
      license: v.status?.license || "youtube",
      embeddable: v.status?.embeddable !== false,
      madeForKids: !!v.status?.madeForKids,
      duration: v.contentDetails?.duration || "",
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
      thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || "",
    },
    categories: (cres.items || [])
      .filter((c: any) => c.snippet?.assignable)
      .map((c: any) => ({ id: c.id, title: c.snippet.title })),
  };
}

/**
 * Partial update: only the provided fields change, everything else is kept
 * exactly as it is on YouTube right now (no accidental data loss).
 * Supports scheduling via publishAt (RFC3339, forces privacy = private).
 */
export async function patchMyVideoForUser(
  userId: string,
  videoIdInput: string,
  patch: Record<string, any>,
  opts: { dryRun?: boolean; accountId?: string | null } = {},
) {
  let videoId = String(videoIdInput || "").trim();
  let idCorrected = false;
  let idCandidates: any[] = [];
  if (videoId) {
    try {
      const r = await resolveOwnedVideoId(userId, videoId, opts.accountId ?? null);
      videoId = r.videoId;
      idCorrected = r.corrected;
      idCandidates = r.candidates;
    } catch (_e) { /* best effort */ }
  }

  const db = admin();
  const dryRun = !!opts.dryRun;
  const conn = await connFor(userId, opts.accountId ?? null);
  if (!conn) {
    return {
      success: false,
      connected: false,
      code: "YT_NOT_CONNECTED",
      error: "YouTube channel connected nahi hai. Pehle AI Assistant > YouTube settings se channel connect karo.",
      action: "connect_youtube",
    };
  }
  if (!String(conn.scope || "").includes("youtube.force-ssl")) {
    return {
      success: false,
      connected: true,
      code: "YT_REAUTH_REQUIRED",
      error:
        "Edit permission missing hai. Channel ko disconnect karke dobara connect karo taaki edit access (youtube.force-ssl) mil jaye.",
      action: "reconnect_youtube_with_edit_scope",
    };
  }
  if (!videoId) {
    return {
      success: false,
      connected: true,
      code: "YT_MISSING_VIDEO_ID",
      error: "video_id missing hai. list_my_youtube_videos se sahi video id lo.",
      action: "verify_video_id",
    };
  }

  let token: string;
  try {
    token = await refreshIfNeeded(conn);
  } catch (e: any) {
    return {
      success: false,
      connected: true,
      code: "YT_REAUTH_REQUIRED",
      error: "YouTube token refresh fail ho gaya. Channel dobara connect karo.",
      action: "reconnect_youtube",
      raw: e?.message || String(e),
    };
  }

  let cur: any;
  try {
    cur = await gapi(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
      token,
    );
  } catch (e: any) {
    return { connected: true, ...(e?.mapped || { success: false, code: "YT_UNKNOWN_ERROR", error: e?.message }) };
  }
  const v = cur.items?.[0];
  if (!v) {
    return await videoNotFoundResult(
      videoIdInput,
      videoId,
      conn.channel_id || null,
      idCandidates,
    );
  }


  const before = {
    title: v.snippet?.title || "",
    description: v.snippet?.description || "",
    tags: (v.snippet?.tags || []) as string[],
    categoryId: v.snippet?.categoryId || "22",
    privacyStatus: v.status?.privacyStatus || "private",
    publishAt: v.status?.publishAt || null,
  };

  // ---- Validator + sanitizer: raw AI text must never reach the YouTube API ----
  // Only the fields the caller actually sent are rewritten; untouched fields keep
  // exactly what is live today.
  const allowedCategories = Object.entries(YT_CATEGORY_NAMES).map(([id, title]) => ({ id, title }));
  const built = buildYouTubePayload(
    {
      title: patch.title !== undefined ? patch.title : before.title,
      description: patch.description !== undefined ? patch.description : before.description,
      tags: patch.tags !== undefined ? patch.tags : before.tags,
      hashtags: patch.hashtags,
      categoryId: patch.categoryId ?? before.categoryId,
    },
    { current: before, allowedCategories },
  );

  const title = patch.title !== undefined ? built.payload.title : before.title;
  if (!title) {
    return { success: false, connected: true, code: "YT_INVALID_REQUEST", error: "Title empty nahi ho sakta.", action: "fix_fields" };
  }
  const description = patch.description !== undefined ? built.payload.description : before.description;
  if (patch.description !== undefined && !description.trim() && before.description.trim()) {
    return {
      success: false,
      connected: true,
      code: "YT_INVALID_SEO",
      error: "Nayi description validation ke baad khali reh gayi — purani description safe hai, kuch update nahi kiya.",
      action: "regenerate_seo",
    };
  }
  const cappedTags: string[] = patch.tags !== undefined ? built.payload.tags : before.tags;
  if (patch.tags !== undefined && !cappedTags.length && before.tags.length) {
    return {
      success: false,
      connected: true,
      code: "YT_INVALID_SEO",
      error: "Nayi tags validation ke baad khali reh gayi — purane tags safe hain, kuch update nahi kiya.",
      action: "regenerate_seo",
      removed_tags: built.removed,
    };
  }
  const tagChars = cappedTags.join(",").length;
  const droppedTags = built.removed;
  const categoryId = patch.categoryId !== undefined || !before.categoryId
    ? built.payload.categoryId
    : String(before.categoryId);

  const publishAt = patch.publishAt ? new Date(String(patch.publishAt)) : null;
  // YouTube needs whole-minute, comfortably-future RFC3339 times.
  if (publishAt && !isNaN(publishAt.getTime())) publishAt.setSeconds(0, 0);
  if (patch.publishAt && (isNaN(publishAt!.getTime()) || publishAt!.getTime() < Date.now() + 120000)) {
    return {
      success: false,
      connected: true,
      code: "YT_INVALID_REQUEST",
      error:
        "Schedule time abhi se kam se kam 2 minute aage hona chahiye (valid future date/time, e.g. 2026-08-20T13:30:00Z).",
      action: "fix_fields",
    };
  }
  let privacyStatus = ["public", "private", "unlisted"].includes(patch.privacyStatus)
    ? patch.privacyStatus
    : before.privacyStatus;
  if (publishAt) privacyStatus = "private";

  const after = {
    title,
    description,
    tags: cappedTags,
    tagsCharCount: tagChars,
    categoryId,
    privacyStatus,
    publishAt: publishAt ? publishAt.toISOString() : before.publishAt,
  };

  const catName = (id: string) => YT_CATEGORY_NAMES[id] || `Category ${id}`;
  const changed = {
    title: before.title !== title,
    description: before.description !== description,
    tags: JSON.stringify(before.tags) !== JSON.stringify(cappedTags),
    categoryId: before.categoryId !== categoryId,
    privacyStatus: before.privacyStatus !== privacyStatus,
    schedule: !!publishAt,
  };
  const addedTags = cappedTags.filter((t) => !before.tags.includes(t));
  const removedTags = before.tags.filter((t) => !cappedTags.includes(t));

  const diff: any[] = [];
  if (changed.title) {
    diff.push({
      field: "title",
      before: before.title,
      after: title,
      before_chars: before.title.length,
      after_chars: title.length,
      limit: 100,
    });
  }
  if (changed.description) {
    diff.push({
      field: "description",
      before: before.description,
      after: description,
      before_chars: before.description.length,
      after_chars: description.length,
      limit: 5000,
    });
  }
  if (changed.tags) {
    diff.push({
      field: "tags",
      before: before.tags,
      after: cappedTags,
      added: addedTags,
      removed: removedTags,
      before_count: before.tags.length,
      after_count: cappedTags.length,
      before_chars: before.tags.join(",").length,
      after_chars: tagChars,
      limit_chars: 500,
      dropped_because_over_limit: droppedTags,
    });
  }
  if (changed.categoryId) {
    diff.push({
      field: "category",
      before: `${before.categoryId} (${catName(before.categoryId)})`,
      after: `${categoryId} (${catName(categoryId)})`,
    });
  }
  if (changed.privacyStatus) {
    diff.push({ field: "privacy", before: before.privacyStatus, after: privacyStatus });
  }
  if (changed.schedule) {
    diff.push({
      field: "publish_at",
      before: before.publishAt || "not scheduled",
      after: publishAt!.toISOString(),
      note: "Schedule set hone par video publish time tak private rahegi.",
    });
  }

  const unchangedFields = Object.entries(changed)
    .filter(([, v2]) => !v2)
    .map(([k]) => k);

  const warnings: string[] = [];
  if (title.length > 70) warnings.push("Title 70+ characters ka hai — mobile search me kat sakta hai.");
  if (description.length < 150) warnings.push("Description 150 characters se chhoti hai — SEO ke liye kam hai.");
  if (cappedTags.length < 8) warnings.push("Tags 8 se kam hain — 10-25 tags better hote hain.");
  if (droppedTags.length) {
    warnings.push(`${droppedTags.length} tag validation me hata diye gaye: ${droppedTags.join(", ")}`);
  }
  if (patch.title !== undefined && String(patch.title).length > 100) {
    warnings.push("Bheja gaya title 100 chars se bada tha, trim kar diya gaya.");
  }
  if (patch.description !== undefined && description !== String(patch.description)) {
    warnings.push("Description se labels / AI text / tag-dump hata kar sirf viewer-facing content bheja gaya.");
  }
  if (built.categoryCorrected && patch.categoryId !== undefined) {
    warnings.push(`Bheji gayi category valid nahi thi — "${YT_CATEGORY_NAMES[categoryId] || categoryId}" use ki gayi.`);
  }

  const baseResult = {
    connected: true,
    videoId,
    requestedVideoId: videoIdInput,
    idCorrected,
    ...(idCorrected
      ? { idCorrectionNote: `Bheja gaya id "${videoIdInput}" galat tha, closest owned video "${videoId}" par update kiya gaya — user ko title confirm karke bata do.` }
      : {}),
    url: `https://www.youtube.com/watch?v=${videoId}`,

    has_changes: diff.length > 0,
    change_count: diff.length,
    changed,
    changed_fields: diff.map((d) => d.field),
    unchanged_fields: unchangedFields,
    diff,
    before,
    after,
    sanitized: {
      removed_tags: built.removed,
      category_corrected: built.categoryCorrected,
      description_cleaned: patch.description !== undefined && description !== String(patch.description),
    },
    warnings,
  };

  // 🔍 DRY-RUN / PREVIEW: nothing is sent to YouTube.
  if (dryRun) {
    return {
      ...baseResult,
      success: true,
      dry_run: true,
      applied: false,
      summary: diff.length
        ? `Preview: ${diff.length} field badlenge — ${diff.map((d) => d.field).join(", ")}. Kuch bhi YouTube pe change NAHI hua.`
        : "Preview: koi change nahi hai — proposed values current values ke same hain.",
      next_step:
        "Ye before/after comparison user ko dikhao (field-by-field) aur unka confirmation lo. 'Haan/kar do' ke baad hi update_my_youtube_video ko dry_run: false ke saath dobara call karo.",
    };
  }

  if (!baseResult.has_changes) {
    return {
      ...baseResult,
      success: true,
      dry_run: false,
      applied: false,
      summary: "Koi change nahi hua — nayi values already current values ke same hain, isliye YouTube ko koi request nahi bheji.",
    };
  }

  const payload: Record<string, unknown> = {
    id: videoId,
    snippet: {
      title,
      description,
      tags: cappedTags.slice(0, 60),
      categoryId,
      ...(v.snippet?.defaultLanguage ? { defaultLanguage: v.snippet.defaultLanguage } : {}),
    },
    status: {
      privacyStatus,
      embeddable: v.status?.embeddable !== false,
      publicStatsViewable: v.status?.publicStatsViewable !== false,
      selfDeclaredMadeForKids: !!v.status?.madeForKids,
      license: v.status?.license || "youtube",
      ...(publishAt ? { publishAt: publishAt.toISOString() } : {}),
    },
  };

  // YouTube rejects publishAt ("invalid scheduled publishing time") while the
  // video is still public/unlisted — it must be private FIRST, in its own request.
  if (publishAt && before.privacyStatus !== "private") {
    const preRes = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: videoId,
        status: {
          privacyStatus: "private",
          embeddable: v.status?.embeddable !== false,
          publicStatsViewable: v.status?.publicStatsViewable !== false,
          selfDeclaredMadeForKids: !!v.status?.madeForKids,
          license: v.status?.license || "youtube",
        },
      }),
    });
    if (!preRes.ok) {
      const preJson = await preRes.json().catch(() => ({}));
      return {
        connected: true,
        applied: false,
        dry_run: false,
        ...mapGoogleApiError(preRes.status, preJson, { videoId }),
      };
    }
  }

  const upRes = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet,status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const upJson = await upRes.json().catch(() => ({}));
  if (!upRes.ok) {
    return {
      connected: true,
      applied: false,
      dry_run: false,
      ...mapGoogleApiError(upRes.status, upJson, { videoId }),
    };
  }

  await db.from("youtube_analytics_cache").delete().eq("user_id", userId);

  return {
    ...baseResult,
    success: true,
    dry_run: false,
    applied: true,
    summary: `Update ho gaya — ${diff.length} field change hue: ${diff.map((d) => d.field).join(", ")}.`,
  };
}

/** Human names for YouTube category ids (IN region assignable set). */
const YT_CATEGORY_NAMES: Record<string, string> = {
  "1": "Film & Animation",
  "2": "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "19": "Travel & Events",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Technology",
  "29": "Nonprofits & Activism",
};

/**
 * 🩺 One-shot health check: connection, scopes, token validity, live API/quota
 * probe and channel category. Returns "sab theek hai" or exactly what to fix.
 */
export async function checkMyYouTubeHealth(userId: string, accountId?: string | null) {
  const checks: Array<{
    name: string;
    status: "ok" | "warn" | "fail";
    detail: string;
    fix?: string;
  }> = [];

  const conn = await connFor(userId, accountId ?? null);
  if (!conn) {
    return {
      success: true,
      connected: false,
      overall: "fail",
      headline: "YouTube channel connected nahi hai.",
      checks: [
        {
          name: "connection",
          status: "fail",
          detail: "Is account se koi YouTube channel connect nahi hai.",
          fix: "AI Assistant > YouTube settings me jaakar 'Connect YouTube' karo (edit permission ke saath).",
        },
      ],
      fix_list: ["YouTube channel connect karo."],
    };
  }

  checks.push({
    name: "connection",
    status: "ok",
    detail: `Channel connected: ${conn.channel_title || conn.channel_id || "unknown"}`,
  });

  const scope = String(conn.scope || "");
  const canEdit = scope.includes("youtube.force-ssl");
  const hasReadonly = canEdit || scope.includes("youtube.readonly") || scope.includes("/youtube");
  const hasAnalytics = scope.includes("yt-analytics");
  checks.push({
    name: "edit_scope",
    status: canEdit ? "ok" : "fail",
    detail: canEdit
      ? "Edit scope (youtube.force-ssl) available hai — title/description/tags/privacy update ho sakte hain."
      : "Edit scope missing hai — sirf read kaam karega, update fail hoga.",
    fix: canEdit ? undefined : "Channel disconnect karke dobara connect karo aur edit permission allow karo.",
  });
  checks.push({
    name: "read_scope",
    status: hasReadonly ? "ok" : "warn",
    detail: hasReadonly ? "Read scope available hai." : "Read scope clearly nahi mila — video list/meta fail ho sakta hai.",
    fix: hasReadonly ? undefined : "Channel dobara connect karo.",
  });
  checks.push({
    name: "analytics_scope",
    status: hasAnalytics ? "ok" : "warn",
    detail: hasAnalytics
      ? "Analytics scope available hai — real views/watch time/CTR mil sakta hai."
      : "Analytics scope missing hai — private analytics (watch time, CTR, impressions) nahi milega.",
    fix: hasAnalytics ? undefined : "Reconnect karte waqt YouTube Analytics permission bhi allow karo.",
  });

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const minsLeft = expiresAt ? Math.round((expiresAt - Date.now()) / 60000) : 0;
  let token: string | null = null;
  try {
    token = await refreshIfNeeded(conn);
    checks.push({
      name: "token",
      status: "ok",
      detail:
        minsLeft > 1
          ? `Access token valid hai (~${minsLeft} min baaki, auto-refresh on).`
          : "Access token refresh ho gaya, ab valid hai.",
    });
  } catch (e: any) {
    checks.push({
      name: "token",
      status: "fail",
      detail: "Token expire ho gaya hai aur refresh fail hua (refresh token invalid/revoked).",
      fix: "Channel disconnect karke dobara connect karo.",
    });
  }
  checks.push({
    name: "refresh_token",
    status: conn.refresh_token ? "ok" : "warn",
    detail: conn.refresh_token
      ? "Refresh token stored hai — long-term access chalega."
      : "Refresh token nahi hai — token expire hone par reconnect maangega.",
    fix: conn.refresh_token ? undefined : "Reconnect karo taaki refresh token mile.",
  });

  let channelCategoryNote = "";
  let topCategory: { id: string; name: string; count: number } | null = null;
  if (token) {
    // Live API + quota probe on the cheapest possible call.
    try {
      const ch = await gapi(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
        token,
      );
      const c = ch.items?.[0];
      checks.push({
        name: "api_and_quota",
        status: "ok",
        detail: `YouTube API reachable hai aur quota available hai. Channel: ${c?.snippet?.title || "-"} (${
          Number(c?.statistics?.subscriberCount || 0)
        } subs, ${Number(c?.statistics?.videoCount || 0)} videos).`,
      });

      // Channel main category = most common category across recent uploads.
      try {
        const uploads = c?.contentDetails?.relatedPlaylists?.uploads;
        if (uploads) {
          const pl = await gapi(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${uploads}`,
            token,
          );
          const ids = (pl.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
          if (ids.length) {
            const vids = await gapi(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(",")}`,
              token,
            );
            const counts = new Map<string, number>();
            for (const item of vids.items || []) {
              const id = item.snippet?.categoryId;
              if (id) counts.set(id, (counts.get(id) || 0) + 1);
            }
            const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
            if (sorted.length) {
              topCategory = {
                id: sorted[0][0],
                name: YT_CATEGORY_NAMES[sorted[0][0]] || `Category ${sorted[0][0]}`,
                count: sorted[0][1],
              };
              const mismatches = sorted.slice(1).reduce((s, [, n]) => s + n, 0);
              channelCategoryNote = mismatches
                ? `${mismatches} recent video main category se different category me hain.`
                : "Sabhi recent videos ek hi category me hain.";
              checks.push({
                name: "channel_category",
                status: mismatches > 0 ? "warn" : "ok",
                detail: `Main category: ${topCategory.name} (${topCategory.count}/${
                  (vids.items || []).length
                } recent videos). ${channelCategoryNote}`,
                fix: mismatches
                  ? "audit_my_youtube_seo chala kar mismatched videos ki category theek karo."
                  : undefined,
              });
            }
          }
        }
      } catch (_e) {
        checks.push({
          name: "channel_category",
          status: "warn",
          detail: "Category detect nahi kar paye (uploads playlist read nahi hui).",
        });
      }
    } catch (e: any) {
      const mapped = (e as any)?.mapped;
      checks.push({
        name: "api_and_quota",
        status: "fail",
        detail: mapped?.error || e?.message || "YouTube API call fail hui.",
        fix:
          mapped?.action === "retry_tomorrow"
            ? "Quota khatam hai — IST midnight reset ke baad try karo."
            : mapped?.action === "reconnect_youtube" || mapped?.action === "reconnect_youtube_with_edit_scope"
            ? "Channel dobara connect karo."
            : "Thodi der baad dobara try karo.",
      });
    }
  }

  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const overall = fails.length ? "fail" : warns.length ? "warn" : "ok";

  return {
    success: true,
    connected: true,
    channel: conn.channel_title || conn.channel_id,
    overall,
    can_edit: canEdit,
    channel_category: topCategory,
    headline:
      overall === "ok"
        ? "✅ Sab theek hai — connection, permissions, token, quota aur category sab sahi."
        : overall === "warn"
        ? "⚠️ Kaam chal jayega, par kuch cheezein improve karni chahiye."
        : "❌ Kuch fix karna padega — niche diye gaye steps follow karo.",
    checks,
    fix_list: [...fails, ...warns].map((c) => c.fix).filter(Boolean),
  };
}

