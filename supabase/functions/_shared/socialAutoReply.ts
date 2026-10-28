// Generic per-user social platform brain (X / LinkedIn).
// Same behaviour as the YouTube AI auto-reply: settings, A-Z data snapshot,
// AI generated replies on new comments/replies, and a reply log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withBusinessContext, getBusinessContext } from "./businessProfile.ts";
import {
  hasXAppCredentials,
  xAppBearer,
  xOAuth1Creds,
  xOAuth1Header,
  xOAuth2Fallback,
} from "./xCredentials.ts";
import { WEBSITE_DOMAIN } from './domain.ts';
import { askAiChain } from './aiChain.ts';
import { reserveAiChatMessage } from './aiChatLimit.ts';
import { identifyTokenOwner } from './socialTokenOwner.ts';

export const SOCIAL_ACTIONS = [
  "social_status",
  "social_set_default",
  "social_link",
  "social_bot_setup",
  "social_disconnect",
  "social_snapshot",
  "social_autoreply_get",
  "social_autoreply_save",
  "social_autoreply_run",
  "social_autoreply_log",
  "social_autoreply_cron",
] as const;

export type SocialAction = (typeof SOCIAL_ACTIONS)[number];
export type Platform =
  | "x"
  | "linkedin"
  | "github"
  | "gitlab"
  | "bitbucket"
  | "discord"
  | "figma"
  | "notion"
  | "twitch"
  | "slack"
  | "spotify"
  | "workos"
  | "azure";

export const SUPPORTED_SOCIAL_PLATFORMS: Platform[] = [
  "x",
  "linkedin",
  "github",
  "gitlab",
  "bitbucket",
  "discord",
  "figma",
  "notion",
  "twitch",
  "slack",
  "spotify",
  "workos",
  "azure",
];

export const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

export async function getUserId(req: Request): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) throw new Error("AUTH_REQUIRED: sign in first");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw new Error("AUTH_REQUIRED: invalid session");
  return data.user.id;
}

function normPlatform(p: unknown): Platform {
  const v = String(p || "").toLowerCase();
  if (v === "x" || v === "twitter") return "x";
  if (v === "linkedin" || v === "linkedin_oidc") return "linkedin";
  if (SUPPORTED_SOCIAL_PLATFORMS.includes(v as Platform)) return v as Platform;
  throw new Error(`Unsupported platform: ${v}`);
}

/* ------------------------------- Settings -------------------------------- */

export interface SocialAutoReplySettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_scope: "all" | "mentions" | "comments";
  reply_length: "auto" | "short" | "medium";
  max_replies_per_run: number;
  custom_instructions: string;
  signature: string;
  skip_negative: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

const DEFAULTS: SocialAutoReplySettings = {
  enabled: false,
  tone: "friendly",
  language: "auto",
  reply_scope: "all",
  reply_length: "auto",
  max_replies_per_run: 0,
  custom_instructions: "",
  signature: "",
  skip_negative: true,
};

const SETTING_KEYS = [
  "enabled", "tone", "language", "reply_scope", "reply_length",
  "max_replies_per_run", "custom_instructions", "signature", "skip_negative",
];

async function loadSettings(userId: string, platform: Platform, accountId = ""): Promise<SocialAutoReplySettings> {
  const { data } = await admin()
    .from("social_autoreply_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("account_id", accountId)
    .maybeSingle();
  return { ...DEFAULTS, ...(data || {}) } as SocialAutoReplySettings;
}

async function saveSettings(
  userId: string,
  platform: Platform,
  patch: Record<string, unknown>,
  accountId = "",
): Promise<SocialAutoReplySettings> {
  const clean: Record<string, unknown> = {};
  for (const k of SETTING_KEYS) if (k in (patch || {})) clean[k] = (patch as any)[k];
  const { error } = await admin()
    .from("social_autoreply_settings")
    .upsert(
      { user_id: userId, platform, account_id: accountId, ...clean, updated_at: new Date().toISOString() },
      { onConflict: "user_id,platform,account_id" },
    );
  if (error) throw new Error(error.message);
  return loadSettings(userId, platform, accountId);
}

/* ------------------------------ Connections ------------------------------ */

export interface SocialConnection {
  platform: Platform;
  account_id: string | null;
  account_name: string | null;
  account_handle: string | null;
  account_picture: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  can_post: boolean;
  scopes: string | null;
  access_token?: string | null;
  token_expires_at?: string | null;
  profile_data?: Record<string, unknown>;
  last_synced_at?: string | null;
}

async function getConnection(userId: string, platform: Platform, accountId?: string | null) {
  let q = admin()
    .from("social_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform);
  if (accountId !== undefined && accountId !== null) q = q.eq("account_id", accountId);
  else q = q.order("is_default", { ascending: false }).order("created_at", { ascending: true });
  const { data } = await q.limit(1).maybeSingle();
  let conn = data as (SocialConnection & { access_token: string | null; refresh_token?: string | null }) | null;

  if (platform === "x") {
    // App-level credentials keep X working even when the user's own OAuth 2.0
    // token is missing or expired.
    if (!conn && hasXAppCredentials()) {
      conn = {
        platform: "x",
        account_id: null, account_name: null, account_handle: null, account_picture: null,
        followers_count: 0, following_count: 0, posts_count: 0,
        can_post: !!xOAuth1Creds(),
        scopes: null,
        access_token: xOAuth2Fallback()?.access_token || null,
        refresh_token: xOAuth2Fallback()?.refresh_token || null,
      } as any;
      return conn;
    }
    if (conn) {
      conn = await refreshXTokenIfNeeded(userId, conn);
      if (!conn?.access_token && hasXAppCredentials()) {
        (conn as any).access_token = xOAuth2Fallback()?.access_token || null;
      }
    }
  }
  return conn;
}

/**
 * X access tokens expire in ~2 hours, so a connected account goes silent very
 * fast. If we have a refresh token AND the app's X client credentials, renew it
 * automatically; otherwise we fall back to the app-level credentials, and only
 * error out when nothing at all is available.
 */
async function refreshXTokenIfNeeded(userId: string, conn: any) {
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const stale = !exp || exp - Date.now() < 5 * 60 * 1000;
  if (!stale) return conn;

  const clientId = Deno.env.get("X_CLIENT_ID");
  const clientSecret = Deno.env.get("X_CLIENT_SECRET");
  const expired = !!exp && exp <= Date.now();
  if (!conn.refresh_token || !clientId) {
    if (expired) {
      // App credentials can still serve the request (xApi falls back to them).
      if (hasXAppCredentials()) return { ...conn, access_token: xOAuth2Fallback()?.access_token || null };
      throw new Error(
        "RECONNECT_REQUIRED: X ka access token expire ho gaya hai. " +
          (conn.refresh_token
            ? "Auto-refresh ke liye X_CLIENT_ID / X_CLIENT_SECRET set karna zaroori hai."
            : "Dobara Connect karke X account link karein (offline.access scope ke saath)."),
      );
    }
    return conn; // not expired yet, the old token still works
  }


  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: clientId,
    });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (clientSecret) headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    const res = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers, body: params });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.access_token) {
      console.error("[social] X token refresh failed", res.status, JSON.stringify(json).slice(0, 200));
      if (expired) {
        if (hasXAppCredentials()) return { ...conn, access_token: xOAuth2Fallback()?.access_token || null };
        throw new Error(
          "RECONNECT_REQUIRED: X token refresh fail ho gaya, please X account dobara connect karein.",
        );
      }
      return conn;
    }
    const expiresAt = new Date(Date.now() + Number(json.expires_in || 7200) * 1000).toISOString();
    await admin().from("social_connections").update({
      access_token: json.access_token,
      refresh_token: json.refresh_token || conn.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("platform", "x").eq("account_id", conn.account_id ?? "");
    console.log("[social] X token refreshed");
    return { ...conn, access_token: json.access_token, refresh_token: json.refresh_token || conn.refresh_token, token_expires_at: expiresAt };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("RECONNECT_REQUIRED")) throw e;
    console.error("[social] X token refresh error", e);
    return conn;
  }
}

const publicConn = (c: any) => c && ({
  platform: c.platform,
  accountId: c.account_id,
  accountName: c.account_name,
  accountHandle: c.account_handle,
  accountPicture: c.account_picture,
  followers: Number(c.followers_count || 0),
  following: Number(c.following_count || 0),
  posts: Number(c.posts_count || 0),
  canPost: !!c.can_post,
  scopes: c.scopes,
  connectedAt: c.created_at,
  lastSyncedAt: c.last_synced_at,
  tokenExpiresAt: c.token_expires_at,
  channelName: c.profile_data?.channel_name || null,
  isDefault: !!c.is_default,
});

/* --------------------------------- X API --------------------------------- */

const X_BASE = "https://api.x.com/2";
const LI_BASE = "https://api.linkedin.com";
// LinkedIn retires versioned APIs after ~1 year; 202405 is dead and returns 426.
const LI_VERSION = Deno.env.get("LINKEDIN_API_VERSION") || "202508";

/**
 * Calls the X API with the user's OAuth 2.0 token and, when that token is
 * missing / expired / lacks permission, silently retries with the app-level
 * credentials (OAuth 1.0a first — it can also write — then the app-only
 * Bearer token, which is read-only).
 */
async function xApi(path: string, token: string | null | undefined, init: RequestInit = {}) {
  const url = `${X_BASE}${path}`;
  const method = (init.method || "GET").toUpperCase();

  const attempts: Array<() => Promise<Record<string, string>>> = [];
  if (token) attempts.push(async () => ({ Authorization: `Bearer ${token}` }));

  const o1 = xOAuth1Creds();
  if (o1) attempts.push(async () => ({ Authorization: await xOAuth1Header(method, url, o1) }));

  const bearer = xAppBearer();
  if (bearer && method === "GET") attempts.push(async () => ({ Authorization: `Bearer ${bearer}` }));

  if (!attempts.length) {
    throw new Error("RECONNECT_REQUIRED: X account connected nahi hai aur app-level X credentials bhi set nahi hain.");
  }

  let lastError: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const headers = await attempts[i]();
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...headers, ...(init.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json;

    const msg = json?.detail || json?.title || json?.errors?.[0]?.message || `X API error (${res.status})`;
    const retryable = res.status === 401 || res.status === 403;
    lastError = new Error(retryable && i === attempts.length - 1 ? `RECONNECT_REQUIRED: ${msg}` : msg);
    if (!retryable) throw lastError;
    console.warn(`[social] X auth attempt ${i + 1}/${attempts.length} failed (${res.status}) — trying fallback`);
  }
  throw lastError || new Error("X API error");
}


async function liApi(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${LI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LI_VERSION,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.message || json?.raw || `LinkedIn API error (${res.status})`;
    if (res.status === 401) throw new Error(`RECONNECT_REQUIRED: ${msg}`);
    throw new Error(String(msg).slice(0, 300));
  }
  return json;
}

/* ------------------------------- AI gateway ------------------------------- */

interface Gateway { name: string; url: string; key: string; model: string; extraHeaders?: Record<string, string> }

function buildGateways(): Gateway[] {
  const gws: Gateway[] = [];
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const google = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  const groq = Deno.env.get("GROQ_API_KEY");
  const openrouter = Deno.env.get("OPENROUTER_API_KEY");
  if (lovable) gws.push({ name: "Lovable", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovable, model: "google/gemini-2.5-flash" });
  if (google) gws.push({ name: "GoogleAIStudio", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: google, model: "gemini-2.5-flash" });
  if (groq) gws.push({ name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groq, model: "llama-3.1-8b-instant" });
  if (openrouter) gws.push({
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: openrouter,
    model: "meta-llama/llama-3.3-70b-instruct:free",
    extraHeaders: { "HTTP-Referer": WEBSITE_DOMAIN, "X-Title": "Social Auto Reply" },
  });
  return gws;
}

// Multi-provider / multi-model chain (same routing as the AI chat page).
async function askAi(system: string, user: string): Promise<string | null> {
  return await askAiChain(system, user, {
    label: "social-autoreply",
    temperature: 0.8,
    maxTokens: 600,
  });
}

/* ------------------------------- Snapshots -------------------------------- */

export interface SocialSnapshot {
  connected: boolean;
  platform: Platform;
  account: Record<string, unknown>;
  totals: Record<string, number>;
  posts: Array<Record<string, unknown>>;
  note?: string | null;
  error?: string | null;
}

async function xSnapshot(conn: any): Promise<SocialSnapshot> {
  const token = conn.access_token as string;
  const me = await xApi(
    "/users/me?user.fields=public_metrics,description,profile_image_url,created_at,verified,location,url,pinned_tweet_id",
    token,
  );
  const u = me?.data || {};
  const m = u.public_metrics || {};
  let posts: any[] = [];
  let error: string | null = null;
  try {
    const tl = await xApi(
      `/users/${u.id}/tweets?max_results=50&exclude=retweets&tweet.fields=created_at,public_metrics,text,conversation_id,entities,lang`,
      token,
    );
    posts = (tl?.data || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      createdAt: t.created_at,
      lang: t.lang,
      likes: t.public_metrics?.like_count || 0,
      replies: t.public_metrics?.reply_count || 0,
      reposts: t.public_metrics?.retweet_count || 0,
      quotes: t.public_metrics?.quote_count || 0,
      impressions: t.public_metrics?.impression_count || 0,
      bookmarks: t.public_metrics?.bookmark_count || 0,
      url: `https://x.com/${u.username}/status/${t.id}`,
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load posts";
  }

  const sum = (k: string) => posts.reduce((a, p) => a + Number((p as any)[k] || 0), 0);
  return {
    connected: true,
    platform: "x",
    account: {
      id: u.id, name: u.name, handle: u.username, bio: u.description,
      picture: u.profile_image_url, createdAt: u.created_at, verified: u.verified,
      location: u.location, url: u.url,
      followers: m.followers_count || 0, following: m.following_count || 0,
      tweetCount: m.tweet_count || 0, listedCount: m.listed_count || 0,
    },
    totals: {
      postsAnalyzed: posts.length,
      likes: sum("likes"), replies: sum("replies"), reposts: sum("reposts"),
      quotes: sum("quotes"), impressions: sum("impressions"), bookmarks: sum("bookmarks"),
      avgLikes: posts.length ? Math.round(sum("likes") / posts.length) : 0,
      engagementRate: sum("impressions")
        ? Math.round(((sum("likes") + sum("replies") + sum("reposts")) / sum("impressions")) * 10000) / 100
        : 0,
    },
    posts,
    error,
  };
}

async function liSnapshot(conn: any): Promise<SocialSnapshot> {
  const token = conn.access_token as string;
  const me = await liApi("/v2/userinfo", token);
  const urn = `urn:li:person:${me?.sub}`;
  let posts: any[] = [];
  let note: string | null = null;
  try {
    const res = await liApi(
      `/rest/posts?author=${encodeURIComponent(urn)}&q=author&count=25&sortBy=LAST_MODIFIED`,
      token,
    );
    posts = (res?.elements || []).map((p: any) => ({
      id: p.id,
      text: p?.commentary || p?.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
      createdAt: p?.createdAt ? new Date(p.createdAt).toISOString() : null,
      visibility: p?.visibility,
      lifecycleState: p?.lifecycleState,
      url: `https://www.linkedin.com/feed/update/${p.id}`,
    }));
  } catch (e) {
    const raw = e instanceof Error ? e.message : "error";
    note = /ACCESS_DENIED|403|permission/i.test(raw)
      ? "LinkedIn post list unavailable: LinkedIn ke member posts read karne ke liye 'Community Management API' product approval chahiye (sirf profile data + naya post publish karna abhi possible hai). Ye app-level LinkedIn approval hai, user ki galti nahi."
      : `LinkedIn post data unavailable: ${raw}`;
  }
  return {
    connected: true,
    platform: "linkedin",
    account: {
      id: me?.sub, urn, name: me?.name, givenName: me?.given_name, familyName: me?.family_name,
      handle: me?.email || null, picture: me?.picture, locale: me?.locale,
      emailVerified: me?.email_verified, email: me?.email,
      followers: Number(conn.followers_count || 0),
    },
    totals: { postsAnalyzed: posts.length },
    posts,
    note,
  };
}

export async function getSocialSnapshot(userId: string, platform: Platform, accountId?: string | null): Promise<SocialSnapshot> {
  const conn = await getConnection(userId, platform, accountId);
  const xApp = platform === "x" && hasXAppCredentials();
  if (!conn?.access_token && !xApp) {
    return { connected: false, platform, account: {}, totals: {}, posts: [] };
  }
  const c: any = conn || { platform, access_token: null };
  const snap = platform === "x" ? await xSnapshot(c) : await liSnapshot(c);
  // keep the stored profile fresh so the AI chat has data even without an API hit
  await admin().from("social_connections").update({
    account_name: (snap.account as any).name ?? c.account_name,
    account_handle: (snap.account as any).handle ?? c.account_handle,
    account_picture: (snap.account as any).picture ?? c.account_picture,
    followers_count: Number((snap.account as any).followers || c.followers_count || 0),
    following_count: Number((snap.account as any).following || c.following_count || 0),
    posts_count: Number((snap.account as any).tweetCount || snap.posts.length || c.posts_count || 0),
    profile_data: { account: snap.account, totals: snap.totals, posts: snap.posts.slice(0, 25) },
    last_synced_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("platform", platform).eq("account_id", c.account_id ?? "");
  return snap;
}

/* ------------------------------ Auto replies ------------------------------ */

const PER_RUN_CAP = 5;
const HOURLY_CAP = 10;
const DAILY_CAP = 60;
const MIN_GAP_MS = 20000;
const MAX_GAP_MS = 45000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STYLE_HINTS = [
  "Seedha point par jawab do, koi bhoomika nahi.",
  "Pehle baat ko halke se acknowledge karo, phir jawab.",
  "Ek chhoti si personal line ke saath jawab do.",
  "Jawab ke saath ek chhota practical tip add karo.",
  "Casual, dost jaisi baat-cheet wali line likho.",
];
const pickStyle = () => STYLE_HINTS[Math.floor(Math.random() * STYLE_HINTS.length)];

/**
 * Platform owner check: only users with the `owner` role reply as the
 * official website customer-support voice.
 */
async function isPlatformOwner(userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin()
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

function ownerSupportSystemPrompt(
  platform: Platform,
  settings: any,
  lengthHint: string,
): string {
  return [
    `You are the official customer support voice of Workly India (${WEBSITE_DOMAIN}), replying publicly on ${platformLabel(platform)}.`,
    "Workly India is a job platform for job seekers and employers: job search and applications, company profiles, resume and interview tools, employer job posting, points/wallet and referrals.",
    "Behave exactly like a polite, professional support agent: greet briefly, understand the issue, give a clear helpful answer or the next step, and thank them.",
    "If it is a complaint or problem, apologise once, give the concrete fix or tell them to share details/DM so the team can check. Never argue, never blame the user.",
    "If the question is about jobs, applications, payments, account or employer features, answer helpfully for the platform and point to the relevant part of the website when useful.",
    "Never promise refunds, timelines, salaries or anything you are not sure about. Never share private user data. Never reveal that you are an AI.",
    `Tone: professional, warm, supportive. Reply language: ${settings.language === "auto" ? "same language/script as the comment" : settings.language}.`,
    lengthHint,
    "No hashtags, max 1 emoji, no marketing spam.",
    settings.skip_negative
      ? 'If the comment is abusive, hateful, spam or pure promotion, reply with exactly "SKIP".'
      : "",
    settings.custom_instructions ? `Owner instructions: ${settings.custom_instructions}` : "",
    "Output only the reply text, nothing else.",
  ].filter(Boolean).join("\n");
}

async function countRepliesSince(userId: string, platform: Platform, sinceIso: string) {
  const { count } = await admin()
    .from("social_autoreply_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("status", "replied")
    .gte("created_at", sinceIso);
  return Number(count || 0);
}

async function alreadyHandled(userId: string, platform: Platform, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data } = await admin()
    .from("social_autoreply_log")
    .select("target_id")
    .eq("user_id", userId)
    .eq("platform", platform)
    .in("target_id", ids);
  return new Set((data || []).map((r: any) => r.target_id));
}

interface Candidate {
  targetId: string;      // the comment/reply we answer
  postId: string | null; // our own post it belongs to
  postText: string;
  author: string;
  text: string;
}

/** New replies/mentions on the user's own X posts. */
async function xCandidates(conn: any, scope: string): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const me = await xApi("/users/me?user.fields=username", token);
  const uid = me?.data?.id;
  const username = me?.data?.username;
  const out: Candidate[] = [];

  const mentions = await xApi(
    `/users/${uid}/mentions?max_results=25&tweet.fields=created_at,text,conversation_id,in_reply_to_user_id,referenced_tweets&expansions=author_id,referenced_tweets.id&user.fields=name,username`,
    token,
  );
  const users = new Map<string, any>((mentions?.includes?.users || []).map((u: any) => [u.id, u]));
  const refTweets = new Map<string, any>((mentions?.includes?.tweets || []).map((t: any) => [t.id, t]));

  for (const t of mentions?.data || []) {
    if (t.author_id === uid) continue;
    const repliedTo = (t.referenced_tweets || []).find((r: any) => r.type === "replied_to");
    const isReplyToMe = !!repliedTo && t.in_reply_to_user_id === uid;
    if (scope === "comments" && !isReplyToMe) continue;
    if (scope === "mentions" && isReplyToMe) continue;
    const parent = repliedTo ? refTweets.get(repliedTo.id) : null;
    const u = users.get(t.author_id);
    out.push({
      targetId: t.id,
      postId: repliedTo?.id || t.conversation_id || null,
      postText: parent?.text || "",
      author: u?.name || (u?.username ? `@${u.username}` : "Someone"),
      text: t.text || "",
    });
  }
  void username;
  return out;
}

/** New comments on the user's own LinkedIn posts. */
async function liCandidates(conn: any): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const me = await liApi("/v2/userinfo", token);
  const urn = `urn:li:person:${me?.sub}`;
  const posts = await liApi(
    `/rest/posts?author=${encodeURIComponent(urn)}&q=author&count=10&sortBy=LAST_MODIFIED`,
    token,
  );
  const out: Candidate[] = [];
  for (const p of posts?.elements || []) {
    const postText = p?.commentary || "";
    try {
      const cs = await liApi(`/v2/socialActions/${encodeURIComponent(p.id)}/comments?count=20`, token);
      for (const c of cs?.elements || []) {
        if (String(c?.actor || "") === urn) continue;
        out.push({
          targetId: String(c?.$URN || c?.id || ""),
          postId: p.id,
          postText,
          author: String(c?.actor || "LinkedIn member"),
          text: c?.message?.text || "",
        });
      }
    } catch (e) {
      console.error("[social-autoreply] linkedin comments error", e);
    }
  }
  return out.filter((c) => c.targetId && c.text);
}

/* ------------------------- GitHub / GitLab replies ------------------------- */

const REPLY_PLATFORMS: Platform[] = ["x", "linkedin", "github", "gitlab", "discord", "slack", "twitch"];

export function platformLabel(p: Platform): string {
  return ({ x: "X (Twitter)", linkedin: "LinkedIn", github: "GitHub", gitlab: "GitLab", discord: "Discord", slack: "Slack", twitch: "Twitch" } as Record<string, string>)[p] || p;
}

/* ------------------------- Discord / Slack (bot) ------------------------- */

function botChannelId(conn: any): string {
  const ch = String(conn?.profile_data?.channel_id || "").trim();
  if (!ch) throw new Error("Channel ID set nahi hai — pehle bot setup mein channel ID daalo.");
  return ch;
}

async function dcApi(path: string, botToken: string, init: RequestInit = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Discord bot token galat hai. Bot setup mein token dobara daalo.");
    if (res.status === 403) throw new Error("Discord bot ko is channel ka access nahi hai. Bot ko server mein invite karke channel permission do.");
    if (res.status === 404) throw new Error("Discord channel nahi mila. Channel ID check karo.");
    throw new Error(`Discord error ${res.status}`);
  }
  return txt ? JSON.parse(txt) : null;
}

async function slApi(method: string, botToken: string, body?: Record<string, unknown>, query?: Record<string, string>) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const res = await fetch(`https://slack.com/api/${method}${qs}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${botToken}`,
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const err = data?.error || `HTTP ${res.status}`;
    if (err === "invalid_auth" || err === "token_revoked") throw new Error("Slack bot token galat hai. Bot setup mein token dobara daalo.");
    if (err === "not_in_channel") throw new Error("Slack bot us channel mein nahi hai. Channel mein /invite @yourbot karo.");
    if (err === "channel_not_found") throw new Error("Slack channel nahi mila. Channel ID check karo.");
    throw new Error(`Slack error: ${err}`);
  }
  return data;
}


/* ------------------------------ Twitch (EventSub) ------------------------------ */

async function twValidate(userToken: string) {
  const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${userToken}` } });
  if (!res.ok) throw new Error("Twitch token galat ya expire hai. Naya token daalo.");
  return await res.json() as { client_id: string; login: string; user_id: string; scopes: string[] };
}

async function twAppToken(clientId: string, clientSecret: string) {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })}`, { method: "POST" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error("Twitch Client Secret galat hai (token ke Client ID se match hona chahiye).");
  return data.access_token as string;
}

async function twApi(path: string, token: string, clientId: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Client-Id": clientId, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const txt = await res.text();
  if (!res.ok) {
    let msg = txt; try { msg = JSON.parse(txt)?.message || txt; } catch { /* */ }
    throw new Error(`Twitch error ${res.status}: ${String(msg).slice(0, 200)}`);
  }
  return txt ? JSON.parse(txt) : null;
}

async function twSetup(userId: string, botToken: string, channelLogin: string, clientSecret: string) {
  const v = await twValidate(botToken);
  const need = ["user:read:chat", "user:write:chat", "user:bot"];
  const missing = need.filter((s) => !v.scopes?.includes(s));
  if (missing.length) throw new Error(`Twitch token mein ye scopes missing hain: ${missing.join(", ")}`);
  const clientId = v.client_id;
  const users = await twApi(`/users?login=${encodeURIComponent(channelLogin.replace(/^#/, "").toLowerCase())}`, botToken, clientId);
  const broadcaster = users?.data?.[0];
  if (!broadcaster) throw new Error("Twitch channel nahi mila. Channel name check karo.");
  const appToken = await twAppToken(clientId, clientSecret);

  const existing = await getConnection(userId, "twitch", String(broadcaster.id));
  const oldSub = existing?.profile_data?.subscription_id;
  if (oldSub) await twApi(`/eventsub/subscriptions?id=${oldSub}`, appToken, clientId, { method: "DELETE" }).catch(() => null);

  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const callback = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unified-social-api`;
  let sub;
  try {
    sub = await twApi("/eventsub/subscriptions", appToken, clientId, {
      method: "POST",
      body: JSON.stringify({
        type: "channel.chat.message", version: "1",
        condition: { broadcaster_user_id: broadcaster.id, user_id: v.user_id },
        transport: { method: "webhook", callback, secret },
      }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/403/.test(m)) throw new Error("Bot ko is channel mein permission nahi. Channel owner token mein channel:bot scope do ya bot ko /mod karo.");
    throw e;
  }
  const row: Record<string, unknown> = {
    user_id: userId, platform: "twitch", access_token: botToken, token_secret: clientSecret, can_post: true,
    account_id: String(broadcaster.id), account_name: `${v.login} (bot) · #${broadcaster.login}`, account_handle: v.login,
    profile_data: {
      ...(existing?.profile_data || {}), bot: true, client_id: clientId, bot_user_id: v.user_id,
      channel_id: broadcaster.id, channel_name: `#${broadcaster.login}`,
      subscription_id: sub?.data?.[0]?.id, eventsub_secret: secret,
    },
    updated_at: new Date().toISOString(),
  };
  if (!existing) {
    const { count } = await admin().from("social_connections").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("platform", "twitch");
    if (!count) row.is_default = true;
  }
  const { error } = await admin().from("social_connections").upsert(row, { onConflict: "user_id,platform,account_id" });
  if (error) throw new Error(error.message);
  return `#${broadcaster.login}`;
}

async function twCandidates(conn: any): Promise<Candidate[]> {
  const { data } = await admin().from("social_inbox").select("*")
    .eq("user_id", conn.user_id).eq("platform", "twitch").eq("channel_id", String(conn.profile_data?.channel_id || conn.account_id || ""))
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
    .order("created_at", { ascending: true }).limit(25);
  return (data || []).map((m: any) => ({
    targetId: m.message_id, postId: m.channel_id, postText: "",
    author: m.author || "viewer", text: String(m.text || "").slice(0, 500),
  })).filter((c) => c.text.trim());
}

/** Twitch EventSub webhook: verify signature, buffer chat message, reply in background. */
export async function handleTwitchEventSub(req: Request): Promise<Response> {
  const raw = await req.text();
  const type = req.headers.get("twitch-eventsub-message-type") || "";
  const id = req.headers.get("twitch-eventsub-message-id") || "";
  const ts = req.headers.get("twitch-eventsub-message-timestamp") || "";
  const sig = req.headers.get("twitch-eventsub-message-signature") || "";
  let body: any; try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  const subId = body?.subscription?.id;
  const { data: conn } = await admin().from("social_connections").select("*")
    .eq("platform", "twitch").filter("profile_data->>subscription_id", "eq", subId).maybeSingle();
  if (!conn?.profile_data?.eventsub_secret) return new Response("unknown subscription", { status: 404 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(conn.profile_data.eventsub_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + ts + raw)));
  const expected = "sha256=" + Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected !== sig) return new Response("bad signature", { status: 403 });

  if (type === "webhook_callback_verification") {
    return new Response(String(body.challenge || ""), { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (type === "revocation") {
    await admin().from("social_autoreply_settings").update({ last_run_status: `error: Twitch subscription revoked (${body?.subscription?.status}) — bot setup dobara karo` })
      .eq("user_id", conn.user_id).eq("platform", "twitch").eq("account_id", conn.account_id ?? "");
    return new Response(null, { status: 204 });
  }
  if (type === "notification") {
    const ev = body.event || {};
    if (ev.chatter_user_id && ev.chatter_user_id !== conn.profile_data.bot_user_id && ev.message?.text) {
      await admin().from("social_inbox").upsert({
        user_id: conn.user_id, platform: "twitch", message_id: ev.message_id,
        channel_id: ev.broadcaster_user_id, author: ev.chatter_user_login || ev.chatter_user_name,
        text: String(ev.message.text).slice(0, 1000),
      }, { onConflict: "user_id,platform,message_id" });
      const job = runSocialAutoReply(conn.user_id, "twitch", { accountId: conn.account_id ?? "" }).catch((e) => console.error("[twitch] autoreply", e));
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(job);
    }
  }
  return new Response(null, { status: 204 });
}

/** Recent messages from other people in the user's Discord channel. */
async function dcCandidates(conn: any): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const channelId = botChannelId(conn);
  const channel = await dcApi(`/channels/${channelId}`, token).catch(() => null);
  const channelName = channel?.name ? `#${channel.name}` : "Discord channel";
  const me = await dcApi(`/users/@me`, token);
  const msgs = await dcApi(`/channels/${channelId}/messages?limit=25`, token);
  const out: Candidate[] = [];
  for (const m of msgs || []) {
    if (m?.author?.bot) continue;
    if (m?.author?.id === me?.id) continue;
    const text = String(m?.content || "").trim();
    if (!text) continue;
    out.push({
      targetId: String(m.id),
      postId: channelId,
      postText: channelName,
      author: m.author?.global_name || m.author?.username || "Discord user",
      text: text.slice(0, 1500),
    });
  }
  return out;
}

/** Recent messages from other people in the user's Slack channel. */
async function slCandidates(conn: any): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const channelId = botChannelId(conn);
  const auth = await slApi("auth.test", token);
  const myId = auth?.user_id;
  const info = await slApi("conversations.info", token, undefined, { channel: channelId }).catch(() => null);
  const channelName = info?.channel?.name ? `#${info.channel.name}` : "Slack channel";
  const hist = await slApi("conversations.history", token, undefined, { channel: channelId, limit: "25" });
  const out: Candidate[] = [];
  for (const m of hist?.messages || []) {
    if (m?.bot_id || (m?.subtype && m.subtype !== "thread_broadcast")) continue;
    if (m?.user === myId) continue;
    const text = String(m?.text || "").trim();
    if (!text) continue;
    let author = "Slack user";
    if (m?.user) {
      const u = await slApi("users.info", token, undefined, { user: m.user }).catch(() => null);
      author = u?.user?.real_name || u?.user?.name || author;
    }
    out.push({
      targetId: String(m.ts),
      postId: channelId,
      postText: channelName,
      author,
      text: text.slice(0, 1500),
    });
  }
  return out;
}

async function ghApi(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "WorklyIndia-AI",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("GitHub login expired. Please reconnect GitHub.");
    if (res.status === 403 || res.status === 404) throw new Error("GitHub needs reply permission. Please disconnect and connect GitHub again.");
    throw new Error(`GitHub error ${res.status}`);
  }
  return txt ? JSON.parse(txt) : null;
}

async function glApi(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://gitlab.com/api/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("GitLab login expired. Please reconnect GitLab.");
    if (res.status === 403) throw new Error("GitLab needs reply permission. Please disconnect and connect GitLab again.");
    throw new Error(`GitLab error ${res.status}`);
  }
  return txt ? JSON.parse(txt) : null;
}

/** New issues and issue/PR comments from other people on the user's own GitHub repos. */
async function ghCandidates(conn: any): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const me = await ghApi("/user", token);
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const repos = await ghApi("/user/repos?affiliation=owner&sort=pushed&per_page=10", token);
  const out: Candidate[] = [];
  for (const r of repos || []) {
    const full = r.full_name as string;
    try {
      const issues = await ghApi(`/repos/${full}/issues?state=open&since=${since}&per_page=15`, token);
      const titles = new Map<number, string>();
      for (const i of issues || []) {
        titles.set(i.number, `${i.title}\n${(i.body || "").slice(0, 500)}`);
        if (i.user?.login === me.login || i.user?.type === "Bot" || i.comments > 0) continue;
        out.push({
          targetId: `issue:${full}#${i.number}`,
          postId: `${full}#${i.number}`,
          postText: `Repository ${full}`,
          author: i.user?.login || "GitHub user",
          text: `${i.title}\n${i.body || ""}`.slice(0, 1500),
        });
      }
      const comments = await ghApi(`/repos/${full}/issues/comments?sort=created&direction=desc&since=${since}&per_page=20`, token);
      for (const c of comments || []) {
        if (c.user?.login === me.login || c.user?.type === "Bot") continue;
        const num = Number(String(c.issue_url || "").split("/").pop());
        if (!num) continue;
        out.push({
          targetId: `comment:${c.id}`,
          postId: `${full}#${num}`,
          postText: titles.get(num) || `Repository ${full}`,
          author: c.user?.login || "GitHub user",
          text: String(c.body || "").slice(0, 1500),
        });
      }
    } catch (e) {
      console.error("[social-autoreply] github repo error", full, e);
      if (e instanceof Error && /reconnect|permission/.test(e.message) && !out.length) throw e;
    }
  }
  return out.filter((c) => c.text.trim());
}

/** New issues and issue comments from other people on the user's own GitLab projects. */
async function glCandidates(conn: any): Promise<Candidate[]> {
  const token = conn.access_token as string;
  const me = await glApi("/user", token);
  const after = new Date(Date.now() - 7 * 86400_000).toISOString();
  const projects = await glApi("/projects?owned=true&order_by=last_activity_at&per_page=10&simple=true", token);
  const out: Candidate[] = [];
  for (const p of projects || []) {
    try {
      const issues = await glApi(`/projects/${p.id}/issues?state=opened&updated_after=${after}&per_page=10`, token);
      for (const i of issues || []) {
        const postId = `${p.id}#${i.iid}`;
        const postText = `${i.title}\n${(i.description || "").slice(0, 500)}`;
        if (i.author?.id !== me.id && !i.user_notes_count) {
          out.push({
            targetId: `issue:${postId}`, postId, postText: `Project ${p.path_with_namespace}`,
            author: i.author?.username || "GitLab user",
            text: `${i.title}\n${i.description || ""}`.slice(0, 1500),
          });
        }
        const notes = await glApi(`/projects/${p.id}/issues/${i.iid}/notes?sort=desc&order_by=created_at&per_page=10`, token);
        for (const n of notes || []) {
          if (n.system || n.author?.id === me.id || n.created_at < after) continue;
          out.push({
            targetId: `note:${n.id}`, postId, postText,
            author: n.author?.username || "GitLab user",
            text: String(n.body || "").slice(0, 1500),
          });
        }
      }
    } catch (e) {
      console.error("[social-autoreply] gitlab project error", p?.id, e);
      if (e instanceof Error && /reconnect|permission/.test(e.message) && !out.length) throw e;
    }
  }
  return out.filter((c) => c.text.trim());
}

async function postReply(
  platform: Platform,
  conn: any,
  cand: Candidate,
  text: string,
): Promise<void> {
  const token = conn.access_token as string;
  if (platform === "twitch") {
    const pd = conn.profile_data || {};
    await twApi("/chat/messages", token, pd.client_id, {
      method: "POST",
      body: JSON.stringify({ broadcaster_id: cand.postId, sender_id: pd.bot_user_id, message: text.slice(0, 490), reply_parent_message_id: cand.targetId }),
    });
    return;
  }
  if (platform === "discord") {
    await dcApi(`/channels/${cand.postId}/messages`, token, {
      method: "POST",
      body: JSON.stringify({
        content: text.slice(0, 1900),
        message_reference: { message_id: cand.targetId },
      }),
    });
    return;
  }
  if (platform === "slack") {
    await slApi("chat.postMessage", token, {
      channel: cand.postId,
      text: text.slice(0, 3900),
      thread_ts: cand.targetId,
    });
    return;
  }
  if (platform === "github") {
    const [full, num] = String(cand.postId || "").split("#");
    await ghApi(`/repos/${full}/issues/${num}/comments`, token, {
      method: "POST", body: JSON.stringify({ body: `@${cand.author} ${text}`.slice(0, 4000) }),
    });
    return;
  }
  if (platform === "gitlab") {
    const [pid, iid] = String(cand.postId || "").split("#");
    await glApi(`/projects/${pid}/issues/${iid}/notes`, token, {
      method: "POST", body: JSON.stringify({ body: `@${cand.author} ${text}`.slice(0, 4000) }),
    });
    return;
  }
  if (platform === "x") {
    await xApi("/tweets", token, {
      method: "POST",
      body: JSON.stringify({ text: text.slice(0, 275), reply: { in_reply_to_tweet_id: cand.targetId } }),
    });
    return;
  }
  const me = await liApi("/v2/userinfo", token);
  await liApi(`/v2/socialActions/${encodeURIComponent(cand.postId || "")}/comments`, token, {
    method: "POST",
    body: JSON.stringify({
      actor: `urn:li:person:${me?.sub}`,
      object: cand.postId,
      message: { text: text.slice(0, 1200) },
      parentComment: cand.targetId,
    }),
  });
}

export async function runSocialAutoReply(
  userId: string,
  platform: Platform,
  opts: { dryRun?: boolean; limit?: number; accountId?: string | null } = {},
) {
  const conn = await getConnection(userId, platform, opts.accountId);
  const acct = String((conn as any)?.account_id ?? opts.accountId ?? "");
  if (!conn?.access_token && !(platform === "x" && hasXAppCredentials())) {
    throw new Error(`${platformLabel(platform)} is not connected`);
  }
  if (!REPLY_PLATFORMS.includes(platform)) {
    throw new Error(`AI auto reply is not available for ${platform} yet`);
  }

  const settings = await loadSettings(userId, platform, acct);
  if (!settings.enabled && !opts.dryRun) {
    return { scanned: 0, replied: 0, skipped: 0, items: [], note: "AI auto reply is OFF for this platform." };
  }

  const nowIso = new Date().toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const usedHour = await countRepliesSince(userId, platform, hourAgo);
  const usedDay = await countRepliesSince(userId, platform, dayAgo);

  const perRun = Math.max(
    0,
    Math.min(
      opts.limit || settings.max_replies_per_run || PER_RUN_CAP,
      PER_RUN_CAP,
      HOURLY_CAP - usedHour,
      DAILY_CAP - usedDay,
    ),
  );

  let candidates: Candidate[] = [];
  try {
    candidates = platform === "x"
      ? await xCandidates(conn, settings.reply_scope)
      : platform === "github"
        ? await ghCandidates(conn)
        : platform === "gitlab"
          ? await glCandidates(conn)
          : platform === "discord"
            ? await dcCandidates(conn)
            : platform === "slack"
              ? await slCandidates(conn)
              : platform === "twitch"
                ? await twCandidates(conn)
              : await liCandidates(conn);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read comments";
    await saveSettings(userId, platform, {}, acct);
    await admin().from("social_autoreply_settings")
      .update({ last_run_at: nowIso, last_run_status: `error: ${msg.slice(0, 150)}` })
      .eq("user_id", userId).eq("platform", platform).eq("account_id", acct);
    throw new Error(msg);
  }

  const handled = await alreadyHandled(userId, platform, candidates.map((c) => c.targetId));
  const fresh = candidates.filter((c) => !handled.has(c.targetId));

  const items: Array<Record<string, unknown>> = [];
  let replied = 0;
  let skipped = 0;

  const lengthHint = settings.reply_length === "short"
    ? "Reply exactly 1 short line."
    : settings.reply_length === "medium"
      ? "Reply in max 2 short lines."
      : "Reply length comment ke hisab se rakho (1-2 lines).";

  const ownerMode = await isPlatformOwner(userId);
  const pd: any = (conn as any)?.profile_data?.account || {};
  const accountCtx = [
    `Connected ${platformLabel(platform)} account (this is YOU):`,
    (conn as any)?.account_name ? `- Name: ${(conn as any).account_name}` : "",
    (conn as any)?.account_handle ? `- Handle: ${(conn as any).account_handle}` : "",
    pd.bio ? `- Bio: ${String(pd.bio).slice(0, 300)}` : "",
    pd.location ? `- Location: ${pd.location}` : "",
    (conn as any)?.followers_count ? `- Followers: ${(conn as any).followers_count}` : "",
  ].filter(Boolean).join("\n");

  for (const cand of fresh) {
    if (replied >= perRun) break;

    const system = ownerMode
      ? ownerSupportSystemPrompt(platform, settings, lengthHint)
      : [
        `You are the owner of this ${platformLabel(platform)} account replying to a real person.`,
        `Tone: ${settings.tone}. Reply language: ${settings.language === "auto" ? "same language/script as the comment" : settings.language}.`,
        lengthHint,
        pickStyle(),
        "Never sound like a bot, never use hashtags unless the comment used them, no emojis spam (max 1).",
        settings.skip_negative
          ? 'If the comment is abusive, hateful, spam or pure promotion, reply with exactly "SKIP".'
          : "",
        settings.custom_instructions ? `Owner instructions: ${settings.custom_instructions}` : "",
        "Use the post content to make the reply specific to what the post is about.",
        "Output only the reply text, nothing else.",
        accountCtx,
      ].filter(Boolean).join("\n");

    const userMsg = [
      cand.postText ? `My post: "${String(cand.postText).slice(0, 500)}"` : "",
      `Person: ${cand.author}`,
      `Their comment: "${String(cand.text).slice(0, 500)}"`,
    ].filter(Boolean).join("\n");

    if (!opts.dryRun) {
      const quota = await reserveAiChatMessage(admin(), userId, "telegram");
      if (!quota.allowed) {
        items.push({ targetId: cand.targetId, author: cand.author, comment: cand.text, reply: "", posted: false, skipped: true, error: quota.reason || "plan_limit_reached" });
        break;
      }
    }

    let reply = (await askAi(ownerMode ? system : await withBusinessContext(system, userId, platform, acct), userMsg)) || "";
    reply = reply.replace(/^["']|["']$/g, "").trim();

    if (!reply || /^skip$/i.test(reply)) {
      skipped++;
      items.push({ targetId: cand.targetId, author: cand.author, comment: cand.text, reply: "", posted: false, skipped: true });
      if (!opts.dryRun) {
        await admin().from("social_autoreply_log").upsert({
          user_id: userId, platform, target_id: cand.targetId, post_id: cand.postId,
          post_text: cand.postText?.slice(0, 500), author_name: cand.author,
          comment_text: cand.text?.slice(0, 1000), reply_text: null, status: "skipped",
        }, { onConflict: "user_id,platform,target_id" });
      }
      continue;
    }

    if (settings.signature) reply = `${reply}\n${settings.signature}`;

    if (opts.dryRun) {
      items.push({ targetId: cand.targetId, author: cand.author, comment: cand.text, reply, posted: false });
      replied++;
      continue;
    }

    try {
      await postReply(platform, conn, cand, reply);
      replied++;
      items.push({ targetId: cand.targetId, author: cand.author, comment: cand.text, reply, posted: true });
      await admin().from("social_autoreply_log").upsert({
        user_id: userId, platform, target_id: cand.targetId, post_id: cand.postId,
        post_text: cand.postText?.slice(0, 500), author_name: cand.author,
        comment_text: cand.text?.slice(0, 1000), reply_text: reply.slice(0, 1000), status: "replied",
      }, { onConflict: "user_id,platform,target_id" });
      if (replied < perRun) await sleep(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "post failed";
      items.push({ targetId: cand.targetId, author: cand.author, comment: cand.text, reply, posted: false, error: msg });
      await admin().from("social_autoreply_log").upsert({
        user_id: userId, platform, target_id: cand.targetId, post_id: cand.postId,
        post_text: cand.postText?.slice(0, 500), author_name: cand.author,
        comment_text: cand.text?.slice(0, 1000), reply_text: reply.slice(0, 1000),
        status: "error", error: msg.slice(0, 300),
      }, { onConflict: "user_id,platform,target_id" });
      if (msg.startsWith("RECONNECT_REQUIRED")) break;
    }
  }

  if (!opts.dryRun) {
    await admin().from("social_autoreply_settings").upsert({
      user_id: userId, platform, account_id: acct,
      last_run_at: nowIso,
      last_run_status: `${replied} replied, ${skipped} skipped`,
      updated_at: nowIso,
    }, { onConflict: "user_id,platform,account_id" });
  }

  return {
    scanned: candidates.length,
    replied,
    skipped,
    items,
    note: perRun === 0 ? "Safety limit reached — thodi der baad try karo." : undefined,
  };
}

/* -------------------------------- Handler --------------------------------- */

export async function handleSocialAction(action: SocialAction, body: any, req: Request) {
  if (action === "social_autoreply_cron") {
    // Same auth scheme as the YouTube auto-reply cron so both can share a schedule/key.
    const key =
      req.headers.get("x-cron-key") || req.headers.get("x-cron-secret") || body?.cronKey || "";
    const cronKey = Deno.env.get("YT_AUTOREPLY_CRON_KEY") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const ok =
      key === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      (cronKey && key === cronKey) ||
      (cronSecret && key === cronSecret);
    if (!ok) throw new Error("AUTH_REQUIRED: bad cron secret");
    const { data } = await admin()
      .from("social_autoreply_settings")
      .select("user_id, platform, account_id")
      .eq("enabled", true);
    const results: unknown[] = [];
    for (const row of data || []) {
      try {
        const r = await runSocialAutoReply(row.user_id, row.platform as Platform, { accountId: row.account_id ?? "" });
        results.push({ user: row.user_id, platform: row.platform, replied: r.replied });
      } catch (e) {
        results.push({ user: row.user_id, platform: row.platform, error: e instanceof Error ? e.message : "error" });
      }
    }
    return { success: true, results };
  }

  const userId = await getUserId(req);

  if (action === "social_status") {
    const { data } = await admin().from("social_connections").select("*").eq("user_id", userId)
      .order("is_default", { ascending: false }).order("created_at", { ascending: true });
    return { success: true, connections: (data || []).map(publicConn) };
  }

  const platform = normPlatform(body?.platform);
  const reqAccount: string | null = typeof body?.accountId === "string" ? body.accountId : null;
  const resolveAccount = async () => String((await getConnection(userId, platform, reqAccount))?.account_id ?? reqAccount ?? "");
  const hasAny = async () => {
    const { count } = await admin().from("social_connections").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("platform", platform);
    return Number(count || 0) > 0;
  };

  switch (action) {
    case "social_set_default": {
      if (reqAccount === null) throw new Error("Missing accountId");
      await admin().from("social_connections").update({ is_default: false }).eq("user_id", userId).eq("platform", platform);
      await admin().from("social_connections").update({ is_default: true }).eq("user_id", userId).eq("platform", platform).eq("account_id", reqAccount);
      return { success: true };
    }

    case "social_link": {
      const accessToken = String(body?.accessToken || "").trim();
      if (!accessToken) throw new Error("Missing access token");
      // Identify the account from the token itself so a newly added account never
      // overwrites an existing one that shares stale sign-in metadata.
      const who = await identifyTokenOwner(platform, accessToken);
      const row: Record<string, unknown> = {
        user_id: userId,
        platform,
        access_token: accessToken,
        refresh_token: body?.refreshToken || null,
        token_secret: body?.tokenSecret || null,
        token_expires_at: body?.expiresAt || null,
        scopes: body?.scopes || null,
        can_post: body?.canPost !== false,
        account_id: String(who?.id || body?.accountId || ""),
        account_name: who?.name || body?.accountName || null,
        account_handle: who?.handle || body?.accountHandle || null,
        account_picture: who?.picture || body?.accountPicture || null,
        account_email: who?.email || body?.accountEmail || null,
        updated_at: new Date().toISOString(),
      };
      if (!(await hasAny())) row.is_default = true;
      const { error } = await admin().from("social_connections").upsert(row, { onConflict: "user_id,platform,account_id" });
      if (error) throw new Error(error.message);
      // best-effort profile sync so the card + AI have real data right away
      let snap: SocialSnapshot | null = null;
      try { snap = await getSocialSnapshot(userId, platform, String(row.account_id)); } catch (e) {
        console.error("[social-link] snapshot failed", e);
      }
      const conn = await getConnection(userId, platform, String(row.account_id));
      return { success: true, connection: publicConn(conn), snapshotError: snap?.error || snap?.note || null };
    }

    case "social_bot_setup": {
      // Save a bot token + channel ID for bot-based platforms (discord, slack).
      if (platform === "twitch") {
        const botToken = String(body?.botToken || "").trim().replace(/^oauth:/i, "");
        const channel = String(body?.channelId || "").trim();
        const clientSecret = String(body?.clientSecret || "").trim();
        if (!botToken || !channel || !clientSecret) throw new Error("Token, channel name aur Client Secret teeno daalo");
        const channelName = await twSetup(userId, botToken, channel, clientSecret);
        return { success: true, connection: publicConn(await getConnection(userId, platform)), channelName };
      }
      if (platform !== "discord" && platform !== "slack") {
        throw new Error("Bot setup is only available for Discord, Slack and Twitch");
      }
      const botToken = String(body?.botToken || "").trim();
      const channelId = String(body?.channelId || "").trim();
      if (!botToken) throw new Error("Bot token daalo");
      if (!channelId) throw new Error("Channel ID daalo");

      // Verify the token + channel before saving.
      let accountName = platform === "discord" ? "Discord bot" : "Slack bot";
      let channelName = "";
      if (platform === "discord") {
        const me = await dcApi("/users/@me", botToken);
        const ch = await dcApi(`/channels/${channelId}`, botToken);
        accountName = me?.username ? `${me.username} (bot)` : accountName;
        channelName = ch?.name ? `#${ch.name}` : "";
      } else {
        const auth = await slApi("auth.test", botToken);
        const ch = await slApi("conversations.info", botToken, undefined, { channel: channelId });
        accountName = auth?.user ? `${auth.user} (bot)` : accountName;
        channelName = ch?.channel?.name ? `#${ch.channel.name}` : "";
      }

      const existing = await getConnection(userId, platform, channelId);
      const row: Record<string, unknown> = {
        user_id: userId,
        platform,
        account_id: channelId,
        access_token: botToken,
        can_post: true,
        account_name: accountName,
        profile_data: { ...(existing?.profile_data || {}), channel_id: channelId, channel_name: channelName, bot: true },
        updated_at: new Date().toISOString(),
      };
      if (!existing && !(await hasAny())) row.is_default = true;
      const { error } = await admin().from("social_connections").upsert(row, { onConflict: "user_id,platform,account_id" });
      if (error) throw new Error(error.message);
      const conn = await getConnection(userId, platform, channelId);
      return { success: true, connection: publicConn(conn), channelName };
    }

    case "social_disconnect": {
      let del = admin().from("social_connections").delete().eq("user_id", userId).eq("platform", platform);
      let off = admin().from("social_autoreply_settings").update({ enabled: false }).eq("user_id", userId).eq("platform", platform);
      if (reqAccount !== null) { del = del.eq("account_id", reqAccount); off = off.eq("account_id", reqAccount); }
      await del;
      await off;
      const { data: left } = await admin().from("social_connections").select("account_id, is_default")
        .eq("user_id", userId).eq("platform", platform).order("created_at", { ascending: true });
      if (left?.length && !left.some((r: any) => r.is_default)) {
        await admin().from("social_connections").update({ is_default: true })
          .eq("user_id", userId).eq("platform", platform).eq("account_id", left[0].account_id);
      }
      return { success: true };
    }

    case "social_snapshot":
      return { success: true, ...(await getSocialSnapshot(userId, platform, reqAccount)) };

    case "social_autoreply_get": {
      const settings = await loadSettings(userId, platform, await resolveAccount());
      const { count } = await admin()
        .from("social_autoreply_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("platform", platform).eq("status", "replied");
      return { success: true, settings, totalReplies: Number(count || 0) };
    }

    case "social_autoreply_save":
      return { success: true, settings: await saveSettings(userId, platform, body?.settings || {}, await resolveAccount()) };

    case "social_autoreply_run":
      return { success: true, ...(await runSocialAutoReply(userId, platform, { dryRun: !!body?.dryRun, limit: body?.limit, accountId: reqAccount })) };

    case "social_autoreply_log": {
      const limit = Math.min(Number(body?.limit || 20), 100);
      let q = admin().from("social_autoreply_log").select("*")
        .eq("user_id", userId).eq("platform", platform)
        .order("created_at", { ascending: false }).limit(limit);
      if (body?.todayOnly) q = q.gte("created_at", new Date(Date.now() - 86400_000).toISOString());
      const { data } = await q;
      return { success: true, items: data || [] };
    }

    default:
      throw new Error(`Unknown social action: ${action}`);
  }
}
