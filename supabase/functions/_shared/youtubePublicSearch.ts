// Public YouTube Data API v3 helpers (read-only, no user OAuth needed).
// Used by the AI chat so it can search ANY video / Short / channel on YouTube,
// read titles, descriptions, tags, stats and durations, and answer in full detail.
//
// Auth: YOUTUBE_DATA_API_JSON saved on the Owner Secrets page preferred,
//       then YOUTUBE_SERVICE_ACCOUNT env secret,
//       falls back to a plain YOUTUBE_API_KEY if configured.
//       Embedded-player lookups (embeddable search + playback status) prefer
//       YOUTUBE_EMBEDDED_PLAYER_JSON from the Owner Secrets page first.

import { getOwnerSecretJson } from "./ownerSecrets.ts";

const BASE = "https://www.googleapis.com/youtube/v3";

function base64urlEncode(data: Uint8Array): string {
  let s = "";
  for (const b of data) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(serviceAccount: any): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const pem = String(serviceAccount.private_key)
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64urlEncode(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: Date.now() + 3500_000 };
  return data.access_token;
}

/** Resolve the service account: Owner Secrets page JSON first, then env secret. */
async function resolveServiceAccount(): Promise<any | null> {
  const owner = await getOwnerSecretJson("YOUTUBE_DATA_API_JSON");
  if (owner) return owner;
  const raw = Deno.env.get("YOUTUBE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve the service account for embedded-player lookups (embeddable/syndicated
 * search + playback status checks): YOUTUBE_EMBEDDED_PLAYER_JSON from the Owner
 * Secrets page first, then the normal YouTube Data chain.
 */
async function resolveEmbedServiceAccount(): Promise<any | null> {
  const owner = await getOwnerSecretJson("YOUTUBE_EMBEDDED_PLAYER_JSON");
  if (owner) return owner;
  return resolveServiceAccount();
}

/** Auth for public (key-or-service-account) YouTube API calls. Exported for other shared helpers. */
export async function getYoutubePublicAuth(): Promise<{ headers: Record<string, string>; keyParam: string | null }> {
  const sa = await resolveServiceAccount();
  if (sa) {
    try {
      const token = await getAccessToken(sa);
      return { headers: { Authorization: `Bearer ${token}` }, keyParam: null };
    } catch (_e) { /* fall back to plain API key */ }
  }
  return { headers: {}, keyParam: Deno.env.get("YOUTUBE_API_KEY") || null };
}

/** Perform an authenticated YouTube Data API GET. Pass `forEmbed: true` for embedded-player lookups. */
async function ytGet(path: string, params: Record<string, string | number | undefined>, opts?: { forEmbed?: boolean }) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const sa = opts?.forEmbed ? await resolveEmbedServiceAccount() : await resolveServiceAccount();
  const apiKey = Deno.env.get("YOUTUBE_API_KEY");

  let headers: Record<string, string> = {};
  if (sa) {
    try {
      const token = await getAccessToken(sa);
      headers = { Authorization: `Bearer ${token}` };
    } catch (e) {
      console.warn("[youtubeSearch] service account auth failed:", (e as Error)?.message);
      if (!apiKey) throw e;
      url.searchParams.set("key", apiKey);
    }
  } else if (apiKey) {
    url.searchParams.set("key", apiKey);
  } else {
    throw new Error("YOUTUBE_NOT_CONFIGURED — save the YouTube Data API v3 JSON on the Owner Secrets page.");
  }

  const res = await fetch(url.toString(), { headers });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "YouTube API error");
  return json;
}

const iso8601ToSeconds = (d?: string): number => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + Math.round(+(m[3] || 0));
};

const fmtDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

export interface PublicVideo {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  ageDays: number;
  durationSeconds: number;
  duration: string;
  isShort: boolean;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number;
  viewsPerDay: number;
  tags: string[];
  thumbnail: string;
  definition?: string;
  language?: string;
  categoryId?: string;
  category?: string;
  thumbnails?: Record<string, string>;
  privacyStatus?: string;
  license?: string;
  captionsAvailable?: boolean;
  licensedContent?: boolean;
  madeForKids?: boolean;
  favorites?: number;
  topicCategories?: string[];
  liveBroadcastContent?: string;
  live?: {
    isLive: boolean;
    wasLive: boolean;
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
    concurrentViewers?: number;
  } | null;
  regionRestriction?: { allowed?: string[]; blocked?: string[] } | null;
  url: string;
  embedUrl: string;
}

// videoCategories.list is tiny and stable — cache per region for the isolate.
const categoryCache = new Map<string, Map<string, string>>();

async function getCategoryNames(regionCode = "IN"): Promise<Map<string, string>> {
  const hit = categoryCache.get(regionCode);
  if (hit) return hit;
  const map = new Map<string, string>();
  try {
    const d = await ytGet("videoCategories", { part: "snippet", regionCode });
    for (const it of d.items || []) map.set(String(it.id), it.snippet?.title || "");
  } catch { /* category names are optional */ }
  categoryCache.set(regionCode, map);
  return map;
}

function mapVideo(v: any): PublicVideo {
  const durationSeconds = iso8601ToSeconds(v.contentDetails?.duration);
  const views = Number(v.statistics?.viewCount || 0);
  const likes = Number(v.statistics?.likeCount || 0);
  const comments = Number(v.statistics?.commentCount || 0);
  const published = new Date(v.snippet?.publishedAt || Date.now());
  const ageDays = Math.max(1, Math.round((Date.now() - published.getTime()) / 86400000));
  const isShort = durationSeconds > 0 && durationSeconds <= 60;
  return {
    videoId: v.id,
    title: v.snippet?.title || "",
    description: v.snippet?.description || "",
    channelTitle: v.snippet?.channelTitle || "",
    channelId: v.snippet?.channelId || "",
    publishedAt: v.snippet?.publishedAt || "",
    ageDays,
    durationSeconds,
    duration: fmtDuration(durationSeconds),
    isShort,
    views,
    likes,
    comments,
    engagementRate: views ? Number((((likes + comments) / views) * 100).toFixed(2)) : 0,
    viewsPerDay: Math.round(views / ageDays),
    tags: v.snippet?.tags || [],
    thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || "",
    definition: v.contentDetails?.definition,
    language: v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage,
    categoryId: v.snippet?.categoryId,
    thumbnails: Object.fromEntries(
      Object.entries(v.snippet?.thumbnails || {}).map(
        ([k, t]: [string, any]) => [k, t?.url],
      ),
    ),
    privacyStatus: v.status?.privacyStatus,
    license: v.status?.license,
    captionsAvailable: v.contentDetails?.caption === "true",
    licensedContent: v.contentDetails?.licensedContent ?? undefined,
    madeForKids: v.status?.madeForKids ?? undefined,
    favorites: Number(v.statistics?.favoriteCount || 0),
    topicCategories: (v.topicDetails?.topicCategories || []).map((u: string) =>
      decodeURIComponent(String(u).split("/").pop() || "").replace(/_/g, " ")
    ),
    liveBroadcastContent: v.snippet?.liveBroadcastContent,
    live: v.liveStreamingDetails
      ? {
        isLive: v.snippet?.liveBroadcastContent === "live",
        wasLive: !!v.liveStreamingDetails.actualEndTime,
        scheduledStartTime: v.liveStreamingDetails.scheduledStartTime,
        actualStartTime: v.liveStreamingDetails.actualStartTime,
        actualEndTime: v.liveStreamingDetails.actualEndTime,
        concurrentViewers: v.liveStreamingDetails.concurrentViewers
          ? Number(v.liveStreamingDetails.concurrentViewers)
          : undefined,
      }
      : null,
    regionRestriction: v.contentDetails?.regionRestriction || null,
    url: isShort
      ? `https://www.youtube.com/shorts/${v.id}`
      : `https://www.youtube.com/watch?v=${v.id}`,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
  };
}

/**
 * True only for videos that are public, fully processed and embeddable, and
 * not region-blocked for the target region. Anything else renders as
 * "Video unavailable" inside an iframe, so we never surface it.
 */
function isPlayablePublicVideo(v: any, regionCode = "IN"): boolean {
  const st = v?.status;
  // `status` is explicitly requested by every caller. Fail closed if YouTube
  // omits any playback guarantee instead of risking an unavailable iframe.
  if (!st) return false;
  if (st.privacyStatus !== "public") return false;
  if (st.uploadStatus !== "processed") return false;
  if (st.embeddable !== true) return false;
  const rr = v?.contentDetails?.regionRestriction;
  if (rr?.blocked?.includes(regionCode)) return false;
  if (rr?.allowed && !rr.allowed.includes(regionCode)) return false;
  // Upcoming / live-scheduled streams are not playable yet
  const bc = v?.snippet?.liveBroadcastContent;
  if (bc === "upcoming") return false;
  return true;
}

/** Hydrate video IDs into full details (stats, duration, tags, description). */
export async function getVideosByIds(
  ids: string[],
  regionCode = "IN",
): Promise<PublicVideo[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!unique.length) return [];
  const data = await ytGet("videos", {
    part:
      "snippet,statistics,contentDetails,status,liveStreamingDetails,topicDetails",
    id: unique.join(","),
    maxResults: 50,
  }, { forEmbed: true });
  const categories = await getCategoryNames(regionCode);
  const order = new Map(unique.map((id, i) => [id, i]));
  return (data.items || [])
    .filter((v: any) => isPlayablePublicVideo(v, regionCode))
    .map((v: any) => {
      const mapped = mapVideo(v);
      mapped.category = mapped.categoryId
        ? categories.get(mapped.categoryId) || undefined
        : undefined;
      return mapped;
    })
    .sort(
      (a: PublicVideo, b: PublicVideo) =>
        (order.get(a.videoId) ?? 0) - (order.get(b.videoId) ?? 0),
    );
}

export type VideoKind = "any" | "short" | "long";
export type SortOrder = "relevance" | "date" | "viewCount" | "rating" | "title";

export interface SearchParams {
  query?: string;
  channel?: string;
  kind?: VideoKind;
  order?: SortOrder;
  maxResults?: number;
  publishedAfterDays?: number;
  regionCode?: string;
  language?: string;
}

/** Resolve a channel name / handle / URL / ID into a channel record. */
export async function resolveChannel(input: string): Promise<any | null> {
  const raw = String(input || "").trim();
  if (!raw) return null;

  let channelId: string | undefined;
  let handle: string | undefined;

  const urlMatch = /youtube\.com\/(channel\/([\w-]+)|@([\w.\-]+)|c\/([\w.\-]+)|user\/([\w.\-]+))/i.exec(raw);
  if (urlMatch) {
    channelId = urlMatch[2];
    handle = urlMatch[3] || urlMatch[4] || urlMatch[5];
  } else if (/^UC[\w-]{20,}$/.test(raw)) {
    channelId = raw;
  } else if (raw.startsWith("@")) {
    handle = raw.slice(1);
  }

  const part = "snippet,statistics,brandingSettings,contentDetails,topicDetails";
  if (channelId) {
    const d = await ytGet("channels", { part, id: channelId });
    if (d.items?.length) return d.items[0];
  }
  if (handle) {
    try {
      const d = await ytGet("channels", { part, forHandle: `@${handle}` });
      if (d.items?.length) return d.items[0];
    } catch { /* fall through to search */ }
  }

  // Fallback: search channels by name
  const s = await ytGet("search", {
    part: "snippet",
    type: "channel",
    q: handle || raw,
    maxResults: 1,
  });
  const found = s.items?.[0]?.snippet?.channelId || s.items?.[0]?.id?.channelId;
  if (!found) return null;
  const d = await ytGet("channels", { part, id: found });
  return d.items?.[0] || null;
}

export function mapChannel(c: any) {
  return {
    channelId: c.id,
    title: c.snippet?.title || "",
    handle: c.snippet?.customUrl || "",
    description: c.snippet?.description || "",
    country: c.snippet?.country || "",
    createdAt: c.snippet?.publishedAt || "",
    thumbnail: c.snippet?.thumbnails?.high?.url || c.snippet?.thumbnails?.default?.url || "",
    subscribers: Number(c.statistics?.subscriberCount || 0),
    totalViews: Number(c.statistics?.viewCount || 0),
    videoCount: Number(c.statistics?.videoCount || 0),
    keywords: c.brandingSettings?.channel?.keywords || "",
    banner: c.brandingSettings?.image?.bannerExternalUrl || "",
    thumbnails: Object.fromEntries(
      Object.entries(c.snippet?.thumbnails || {}).map(
        ([k, t]: [string, any]) => [k, t?.url],
      ),
    ),
    hiddenSubscriberCount: !!c.statistics?.hiddenSubscriberCount,
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || "",
    topicCategories: (c.topicDetails?.topicCategories || []).map((u: string) =>
      decodeURIComponent(String(u).split("/").pop() || "").replace(/_/g, " ")
    ),
    url: c.snippet?.customUrl
      ? `https://www.youtube.com/${c.snippet.customUrl}`
      : `https://www.youtube.com/channel/${c.id}`,
  };
}

/**
 * Search YouTube for videos and/or Shorts, optionally scoped to a channel.
 * Always returns FULL video details (stats, duration, tags, description).
 */
export async function searchYouTube(params: SearchParams) {
  const {
    query,
    channel,
    kind = "any",
    order = "relevance",
    maxResults = 8,
    publishedAfterDays,
    regionCode = "IN",
    language,
  } = params;

  let channelInfo: any = null;
  if (channel) {
    const c = await resolveChannel(channel);
    if (!c) {
      return {
        success: false,
        error: `Channel "${channel}" not found on YouTube.`,
        videos: [],
      };
    }
    channelInfo = mapChannel(c);
  }

  if (!query && !channelInfo) {
    return { success: false, error: "Provide a search query or a channel name.", videos: [] };
  }

  // Over-fetch so short/long + unavailable-video filtering still leaves enough.
  const want = Math.max(1, Math.min(25, Number(maxResults) || 8));
  const fetchCount = kind === "any" ? Math.min(50, want * 3) : Math.min(50, want * 5);

  const searchParams: Record<string, string | number | undefined> = {
    part: "snippet",
    type: "video",
    q: query,
    channelId: channelInfo?.channelId,
    order,
    maxResults: fetchCount,
    regionCode,
    relevanceLanguage: language,
    // Only ask YouTube for videos that can actually be embedded/played outside
    videoEmbeddable: "true",
    videoSyndicated: "true",
  };
  if (kind === "short") searchParams.videoDuration = "short";
  // "long" = any normal (non-Short) video. Do NOT restrict to "medium" (4-20 min),
  // that would hide longer uploads. Shorts are filtered out below by duration.
  if (kind === "long") searchParams.videoDuration = "any";
  if (publishedAfterDays) {
    searchParams.publishedAfter = new Date(
      Date.now() - Number(publishedAfterDays) * 86400000,
    ).toISOString();
  }

  const search = await ytGet("search", searchParams, { forEmbed: true });
  const ids = (search.items || [])
    .map((i: any) => i.id?.videoId)
    .filter(Boolean);

  let videos = await getVideosByIds(ids, regionCode);
  if (kind === "short") videos = videos.filter((v) => v.isShort);
  if (kind === "long") videos = videos.filter((v) => !v.isShort);

  // ── Relevance guard: never hand back videos unrelated to what was asked.
  // Example: "Manoj Dey vlog" must not return "The Indian Vlogger" uploads.
  if (query && !channelInfo) {
    const GENERIC = new Set([
      "video", "videos", "vlog", "vlogs", "latest", "new", "newest", "recent",
      "shorts", "short", "youtube", "channel", "full", "best", "top", "hindi",
      "english", "please", "chahiye", "dedo", "de", "do", "ka", "ki", "ke",
      "wala", "wale", "dekhna", "dikhao", "batao", "aur", "kuch", "mera",
    ]);
    const tokens = String(query)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !GENERIC.has(t));

    if (tokens.length) {
      const haystack = (v: PublicVideo) =>
        `${v.title} ${v.channelTitle} ${(v.tags || []).join(" ")} ${v.description || ""}`
          .toLowerCase();

      // If the query names a creator, prefer that creator's own channel only.
      const creatorMatches = videos.filter((v) => {
        const ch = v.channelTitle.toLowerCase();
        return tokens.every((t) => ch.includes(t));
      });

      if (creatorMatches.length) {
        const channelIds = new Set(creatorMatches.map((v) => v.channelId));
        videos = videos.filter((v) => channelIds.has(v.channelId));
      } else {
        // Otherwise require a real token overlap; keep original order.
        const relevant = videos.filter((v) => {
          const h = haystack(v);
          return tokens.some((t) => h.includes(t));
        });
        if (relevant.length) videos = relevant;
      }
    }
  }

  videos = videos.slice(0, want);

  if (!videos.length) {
    return {
      success: false,
      error: query
        ? `No currently available YouTube videos found for "${query}".`
        : "No currently available YouTube videos found.",
      query: query || null,
      kind,
      order,
      channel: channelInfo,
      count: 0,
      videos: [],
    };
  }

  return {
    success: true,
    query: query || null,
    kind,
    order,
    channel: channelInfo,
    totalResults: search.pageInfo?.totalResults ?? videos.length,
    count: videos.length,
    videos,
  };
}


/** Full details for one video, from an ID or any YouTube URL. */
export async function getYouTubeVideoDetails(input: string) {
  const raw = String(input || "").trim();
  const m =
    /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(raw) ||
    /^([\w-]{11})$/.exec(raw);
  const id = m?.[1];
  if (!id) return { success: false, error: "Could not read a YouTube video ID from that input." };

  const videos = await getVideosByIds([id]);
  if (!videos.length) {
    return {
      success: false,
      error:
        "Video not available publicly (private, deleted, or embedding disabled).",
    };
  }

  const video = videos[0];

  // One call from the user = one complete answer: video + channel + top
  // comments + the channel's playlists, all fetched in parallel.
  const [channel, comments, playlists] = await Promise.all([
    resolveChannel(video.channelId).then((c) => (c ? mapChannel(c) : null)).catch(
      () => null,
    ),
    getVideoComments(id, { maxResults: 15 }).catch(() => null),
    getChannelPlaylists(video.channelId, 15).catch(() => null),
  ]);

  return {
    success: true,
    video,
    channel,
    comments: comments?.comments || [],
    commentsNote: (comments as any)?.note,
    playlists: (playlists as any)?.playlists || [],
  };
}

/** Latest / most popular uploads for a channel (videos + Shorts). */
export async function getChannelUploads(
  channelName: string,
  opts: { kind?: VideoKind; order?: SortOrder; maxResults?: number } = {},
) {
  return await searchYouTube({
    channel: channelName,
    kind: opts.kind || "any",
    order: opts.order || "date",
    maxResults: opts.maxResults ?? 10,
  });
}

/** Trending videos for a region (no query needed). */
export async function getTrendingVideos(regionCode = "IN", maxResults = 10) {
  const data = await ytGet("videos", {
    part:
      "snippet,statistics,contentDetails,status,liveStreamingDetails,topicDetails",
    chart: "mostPopular",
    regionCode,
    maxResults: Math.min(25, maxResults),
  });
  const categories = await getCategoryNames(regionCode);
  return {
    success: true,
    regionCode,
    videos: (data.items || [])
      .filter((v: any) => isPlayablePublicVideo(v, regionCode))
      .map((v: any) => {
        const mapped = mapVideo(v);
        mapped.category = mapped.categoryId
          ? categories.get(mapped.categoryId) || undefined
          : undefined;
        return mapped;
      }),
  };
}


// ==================== PLAYLISTS ====================

export function mapPlaylist(p: any) {
  return {
    playlistId: p.id,
    title: p.snippet?.title || "",
    description: p.snippet?.description || "",
    channelId: p.snippet?.channelId || "",
    channelTitle: p.snippet?.channelTitle || "",
    publishedAt: p.snippet?.publishedAt || "",
    privacyStatus: p.status?.privacyStatus,
    itemCount: Number(p.contentDetails?.itemCount || 0),
    thumbnail: p.snippet?.thumbnails?.high?.url ||
      p.snippet?.thumbnails?.medium?.url || "",
    url: `https://www.youtube.com/playlist?list=${p.id}`,
  };
}

/** All public playlists of a channel (name / @handle / URL / ID). */
export async function getChannelPlaylists(channel: string, maxResults = 25) {
  const c = await resolveChannel(channel);
  if (!c) {
    return { success: false, error: `Channel "${channel}" not found on YouTube.`, playlists: [] };
  }
  const d = await ytGet("playlists", {
    part: "snippet,contentDetails,status",
    channelId: c.id,
    maxResults: Math.min(50, Math.max(1, maxResults)),
  });
  return {
    success: true,
    channel: mapChannel(c),
    count: (d.items || []).length,
    totalResults: d.pageInfo?.totalResults ?? (d.items || []).length,
    playlists: (d.items || []).map(mapPlaylist),
  };
}

/** One playlist (from URL or ID) with its videos. */
export async function getPlaylistDetails(input: string, maxItems = 25) {
  const raw = String(input || "").trim();
  const m = /[?&]list=([\w-]+)/.exec(raw) || /^([\w-]{13,})$/.exec(raw);
  const id = m?.[1];
  if (!id) return { success: false, error: "Could not read a YouTube playlist ID from that input." };

  const d = await ytGet("playlists", { part: "snippet,contentDetails,status", id });
  if (!d.items?.length) return { success: false, error: "Playlist not found or not public." };

  const items = await ytGet("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: id,
    maxResults: Math.min(50, Math.max(1, maxItems)),
  });
  const ids = (items.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
  const videos = ids.length ? await getVideosByIds(ids) : [];

  return {
    success: true,
    playlist: mapPlaylist(d.items[0]),
    count: videos.length,
    videos,
  };
}

// ==================== COMMENTS ====================

export function mapCommentThread(t: any) {
  const top = t.snippet?.topLevelComment?.snippet || {};
  return {
    commentId: t.snippet?.topLevelComment?.id || t.id,
    text: top.textOriginal || top.textDisplay || "",
    author: top.authorDisplayName || "",
    authorChannelUrl: top.authorChannelUrl || "",
    authorAvatar: top.authorProfileImageUrl || "",
    likeCount: Number(top.likeCount || 0),
    publishedAt: top.publishedAt || "",
    updatedAt: top.updatedAt || "",
    replyCount: Number(t.snippet?.totalReplyCount || 0),
    replies: (t.replies?.comments || []).map((r: any) => ({
      commentId: r.id,
      text: r.snippet?.textOriginal || r.snippet?.textDisplay || "",
      author: r.snippet?.authorDisplayName || "",
      likeCount: Number(r.snippet?.likeCount || 0),
      publishedAt: r.snippet?.publishedAt || "",
    })),
  };
}

/** Top-level comments (with replies) for a video URL/ID. */
export async function getVideoComments(
  input: string,
  opts: { maxResults?: number; order?: "relevance" | "time" } = {},
) {
  const raw = String(input || "").trim();
  const m = /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(raw) ||
    /^([\w-]{11})$/.exec(raw);
  const id = m?.[1];
  if (!id) return { success: false, error: "Could not read a YouTube video ID from that input.", comments: [] };

  try {
    const d = await ytGet("commentThreads", {
      part: "snippet,replies",
      videoId: id,
      order: opts.order || "relevance",
      maxResults: Math.min(50, Math.max(1, opts.maxResults ?? 20)),
      textFormat: "plainText",
    });
    return {
      success: true,
      videoId: id,
      count: (d.items || []).length,
      totalResults: d.pageInfo?.totalResults ?? (d.items || []).length,
      comments: (d.items || []).map(mapCommentThread),
    };
  } catch (e) {
    const msg = (e as Error)?.message || "";
    if (/disabled/i.test(msg)) {
      return { success: true, videoId: id, count: 0, comments: [], note: "Comments are disabled on this video." };
    }
    return { success: false, error: msg || "Could not load comments.", comments: [] };
  }
}
