// YouTube AI Auto-Reply — replies to new comments on videos & shorts.
// Runs inside the existing `unified-youtube-api` edge function (no new function).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withBusinessContext, getBusinessContext } from "./businessProfile.ts";
import { refreshIfNeeded, getConnectionForAccount } from "./youtubeGrowth.ts";
import { WEBSITE_DOMAIN } from './domain.ts';
import { askAiChain } from './aiChain.ts';
import { reserveAiChatMessage } from './aiChatLimit.ts';

export const AUTOREPLY_ACTIONS = [
  "yt_autoreply_get",
  "yt_autoreply_save",
  "yt_autoreply_run",
  "yt_autoreply_log",
  "yt_autoreply_cron",
] as const;

export type AutoReplyAction = (typeof AUTOREPLY_ACTIONS)[number];

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

async function getUserId(req: Request): Promise<string> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!token) throw new Error("AUTH_REQUIRED: sign in first");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw new Error("AUTH_REQUIRED: invalid session");
  return data.user.id;
}

export interface AutoReplySettings {
  enabled: boolean;
  tone: string;
  language: string;
  reply_scope: "all" | "shorts" | "long";
  reply_length: "auto" | "short" | "medium";
  max_replies_per_run: number;
  custom_instructions: string;
  signature: string;
  skip_negative: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
  account_id?: string;
  account_email?: string | null;
  is_default?: boolean;
}

const DEFAULTS: AutoReplySettings = {
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

/**
 * Settings for a specific channel (account_id = channel_id). Falls back to the
 * legacy "" row (pre-multi-channel settings) when the channel has none yet —
 * this keeps the previously-only-connected channel's settings intact.
 */
async function loadSettings(userId: string, accountId: string = ""): Promise<AutoReplySettings> {
  const db = admin();
  if (accountId) {
    const { data } = await db
      .from("youtube_autoreply_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (data) return { ...DEFAULTS, ...data, account_id: accountId } as AutoReplySettings;
  }
  const { data: legacy } = await db
    .from("youtube_autoreply_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", "")
    .maybeSingle();
  return { ...DEFAULTS, ...(legacy || {}), account_id: accountId } as AutoReplySettings;
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
    extraHeaders: { "HTTP-Referer": WEBSITE_DOMAIN, "X-Title": "YouTube Auto Reply" },
  });
  return gws;
}

// Multi-provider / multi-model chain (same routing as the AI chat page).
async function askAi(system: string, user: string): Promise<string | null> {
  return await askAiChain(system, user, {
    label: "youtube-autoreply",
    temperature: 0.8,
    maxTokens: 900,
  });
}

/* ------------------------------ YouTube calls ----------------------------- */

const gapi = async (url: string, token: string) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `YouTube API error (${res.status})`);
  return json;
};

const isoToSeconds = (iso: string): number => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "") || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

const STOPWORDS = new Set([
  "the","and","for","with","this","that","your","you","from","have","what","how","why","when",
  "video","shorts","short","full","new","best","top","2023","2024","2025","2026","hai","kya",
  "mera","meri","aur","kaise","karo","ka","ki","ke","me","mai","main",
]);

/** Title/comment se search keywords nikalta hai. */
function keywordsOf(text: string, max = 6): string[] {
  return Array.from(
    new Set(
      (text || "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ).slice(0, max);
}

/**
 * Agar apne video ka context kam pade to dusre channels ke similar videos ke
 * title/description dekh kar AI seekh leta hai (read-only research).
 */
const researchCache = new Map<string, string>();
async function learnFromSimilarVideos(query: string, token: string, excludeChannelId: string): Promise<string> {
  const q = keywordsOf(query, 6).join(" ").trim();
  if (!q) return "";
  if (researchCache.has(q)) return researchCache.get(q)!;
  let out = "";
  try {
    const res = await gapi(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&maxResults=6&q=${encodeURIComponent(q)}`,
      token,
    );
    const lines = (res?.items || [])
      .filter((v: any) => v?.snippet?.channelId !== excludeChannelId)
      .slice(0, 4)
      .map((v: any) => `• "${v?.snippet?.title || ""}" — ${(v?.snippet?.description || "").slice(0, 160)}`)
      .filter(Boolean);
    if (lines.length) {
      out = `Similar videos on YouTube (sirf topic samajhne ke liye, copy mat karo):\n${lines.join("\n")}`;
    }
  } catch { /* non-fatal */ }
  researchCache.set(q, out);
  return out;
}

/** Har reply ka andaaz alag rakhne ke liye random human style hint. */
const STYLE_HINTS = [
  "Seedha point par jawab do, koi bhoomika nahi.",
  "Pehle viewer ki baat ko halke se acknowledge karo, phir jawab.",
  "Ek chhoti si personal line ke saath jawab do (jaise banda khud type kar raha ho).",
  "Sawal ka jawab do aur ek chhota practical tip add karo.",
  "Casual, dost jaisi baat-cheet wali line likho.",
  "Thoda enthusiastic lekin over nahi — natural rakho.",
  "Bina kisi greeting ke, comment ke shabdon ko pick karke jawab do.",
];
const pickStyle = () => STYLE_HINTS[Math.floor(Math.random() * STYLE_HINTS.length)];



/* --------------------------- Human-safety limits -------------------------- */
// YouTube spam-detection safe pacing. Ek saath bahut saare reply = channel risk.
const PER_RUN_CAP = 5;          // ek run me max itne reply (edge function time-safe)
const HOURLY_CAP = 10;          // 60 min me max reply
const DAILY_CAP = 100;          // 24h me max reply
const MIN_GAP_MS = 30000;       // do reply ke beech minimum 30 sec
const MAX_GAP_MS = 60000;       // random upper gap 60 sec (human jaisa)
const PAUSE_MINUTES = 60;       // spam/quota signal ke baad itni der auto-pause

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const humanGap = () => MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));

/** India (IST) date string yyyy-mm-dd */
const istDate = (d: Date | string): string => {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
};

/** Promotional / self-advertising comments — inpar auto-reply nahi karna. */
const PROMO_RE = /(subscribe\s*(me|my|back|to my)|sub\s*4\s*sub|sub2sub|check\s*(out\s*)?my\s*(channel|video|page|profile)|visit\s*my|follow\s*me|my\s*channel|promote|promotion|dm\s*me|whats\s*app|whatsapp|telegram|t\.me\/|paid\s*promotion|buy\s*now|earn\s*money|click\s*here|link\s*in\s*bio)/i;
/** Link / contact detect */
const LINK_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|in|io|co|xyz|shop|link|me|ru|tk)\b|\b\d{10}\b|\S+@\S+\.\S+)/i;
/** Abusive / spam words (multi-lingual, basic) */
const ABUSE_RE = /(fuck|bitch|bastard|asshole|idiot|stupid|scam|fraud|fake|chutiy|madarch|behanch|bhosd|gandu|randi|harami|kutte|saale)/i;

type Priority = "high" | "medium" | "low" | "skip";

/** Comment ko priority deta hai — questions sabse upar, spam/link skip. */
function classifyComment(text: string): { priority: Priority; reason?: string } {
  const t = (text || "").trim();
  if (!t) return { priority: "skip", reason: "empty" };
  if (LINK_RE.test(t)) return { priority: "skip", reason: "suspicious link/contact" };
  if (PROMO_RE.test(t)) return { priority: "skip", reason: "promotional comment" };
  if (ABUSE_RE.test(t)) return { priority: "skip", reason: "spam/abusive" };
  if (/[?？]|\b(kaise|kaisa|kya|kyu|kyun|kab|kahan|kaun|kitna|kitne|how|what|why|when|where|which|who|can i|help|doubt|problem)\b/i.test(t)) {
    return { priority: "high" };
  }
  // sirf emoji / 1-2 shabd ka reaction
  const words = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return { priority: "low" };
  return { priority: "medium" };
}

const PRIORITY_ORDER: Record<Exclude<Priority, "skip">, number> = { high: 0, medium: 1, low: 2 };

const normalize = (t: string) =>
  (t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();


/** Reply ko saaf + YouTube-policy safe banata hai. Adhura text return nahi hota. */
function cleanReply(raw: string, signature: string): string {
  let t = (raw || "").trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "").replace(/^reply\s*:\s*/i, "").trim();
  // markdown, links, hashtags, @mentions hatao (policy + spam safety)
  t = t.replace(/```[\s\S]*?```/g, " ")
       .replace(/[*_#`>]+/g, "")
       .replace(/https?:\/\/\S+/gi, "")
       .replace(/\bwww\.\S+/gi, "")
       .replace(/\S+@\S+\.\S+/g, "")
       .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, " ")
       .replace(/[ \t]{2,}/g, " ")
       .replace(/\n{3,}/g, "\n\n")
       .trim();
  // agar bahut lamba ho to poore vaakya par kaato (adhoora sentence nahi)
  if (t.length > 4000) {
    const cut = t.slice(0, 4000);
    const stop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"), cut.lastIndexOf("\n"));
    t = (stop > 200 ? cut.slice(0, stop + 1) : cut).trim();
  }
  if (signature && !t.includes(signature)) t = `${t}\n${signature}`;
  return t.trim();
}

/** Reply post karne layak hai ya nahi (adhoora / khali / AI-leak text block). */
function isValidReply(t: string): boolean {
  const s = (t || "").trim();
  if (s.length < 2) return false;
  if (/^(skip|n\/?a|null|undefined)$/i.test(s)) return false;
  if (/\b(as an ai|language model|i am an ai|i cannot|system prompt)\b/i.test(s)) return false;
  return true;
}

export interface RunResult {
  scanned: number;
  replied: number;
  skipped: number;
  items: Array<{ commentId: string; author: string; comment: string; reply: string; videoTitle?: string; posted: boolean; error?: string }>;
  note?: string;
}


/** Core worker: scan latest comments and reply with AI. */
export async function runAutoReplyForUser(
  userId: string,
  opts: { dryRun?: boolean; limit?: number; ignoreEnabled?: boolean; accountId?: string | null } = {},
): Promise<RunResult> {
  const db = admin();
  const out: RunResult = { scanned: 0, replied: 0, skipped: 0, items: [] };

  const conn = await getConnectionForAccount(db, userId, opts.accountId ?? null);
  if (!conn) return { ...out, note: "YouTube not connected" };
  const channelId: string = conn.channel_id;

  const settings = await loadSettings(userId, channelId);
  const bizCtx = await getBusinessContext(userId, "youtube", channelId);
  const biz = bizCtx ? `\n\n${bizCtx}` : "";
  if (!settings.enabled && !opts.ignoreEnabled) {
    return { ...out, note: "Auto-reply is off" };
  }

  const token = await refreshIfNeeded(conn);

  // Channel context for persona
  let channelTitle = conn.channel_title || "";
  let channelDesc = "";
  try {
    const ch = await gapi(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, token);
    channelTitle = ch?.items?.[0]?.snippet?.title || channelTitle;
    channelDesc = (ch?.items?.[0]?.snippet?.description || "").slice(0, 600);
  } catch { /* non-fatal */ }

  // Safety caps: kabhi bhi ek saath spam-jaisa burst nahi.
  const rawLimit = Number(opts.limit ?? settings.max_replies_per_run ?? 0);
  const wanted = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : PER_RUN_CAP;
  let maxReplies = opts.dryRun ? Math.min(wanted, 3) : Math.min(wanted, PER_RUN_CAP);

  if (!opts.dryRun) {
    // Auto-pause: pichle ghante me YouTube ne spam/quota signal diya ho to run mat karo
    const pauseSince = new Date(Date.now() - PAUSE_MINUTES * 60 * 1000).toISOString();
    const { data: paused } = await db
      .from("youtube_autoreply_log")
      .select("created_at")
      .eq("user_id", userId)
      .eq("account_id", channelId)
      .eq("status", "paused")
      .gte("created_at", pauseSince)
      .limit(1);
    if (paused?.length) {
      return { ...out, note: `Safety pause active — YouTube ne spam/quota signal diya tha. ${PAUSE_MINUTES} min baad dobara chalega.` };
    }

    // 24-ghante ka daily cap
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: todayCount } = await db
      .from("youtube_autoreply_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("account_id", channelId)
      .eq("status", "replied")
      .gte("created_at", since);
    const left = DAILY_CAP - (todayCount || 0);
    if (left <= 0) return { ...out, note: `Daily safety limit (${DAILY_CAP} replies/24h) reached` };
    maxReplies = Math.min(maxReplies, left);

    // 1-ghante ka hourly cap
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count: hourCount } = await db
      .from("youtube_autoreply_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("account_id", channelId)
      .eq("status", "replied")
      .gte("created_at", hourAgo);
    const hourLeft = HOURLY_CAP - (hourCount || 0);
    if (hourLeft <= 0) return { ...out, note: `Hourly safety limit (${HOURLY_CAP} replies/hour) reached` };
    maxReplies = Math.min(maxReplies, hourLeft);
  }



  // Sabhi comment threads (pagination) — video + shorts dono
  const items: any[] = [];
  let pageToken = "";
  for (let page = 0; page < 40; page++) {
    const threads = await gapi(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${channelId}&order=time&maxResults=100&textFormat=plainText${pageToken ? `&pageToken=${pageToken}` : ""}`,
      token,
    );
    items.push(...(threads?.items || []));
    pageToken = threads?.nextPageToken || "";
    if (!pageToken) break;
    if (opts.dryRun && items.length >= 50) break;
  }
  out.scanned = items.length;
  if (!items.length) return { ...out, note: "No comments found" };

  // Sirf AAJ ke (India/IST date) comments par reply — purane/pending comments chhod do
  const today = istDate(new Date());
  const todaysItems = items.filter((t) => {
    const at = t?.snippet?.topLevelComment?.snippet?.publishedAt;
    return at ? istDate(at) === today : false;
  });
  // Naya top-level comment na ho to bhi ruko mat — thread ke andar aaye
  // "reply ka reply" ka jawab dena baaki ho sakta hai (neeche wala pass).


  // Priority: questions (high) → genuine (medium) → reactions (low). Spam/link skip.
  const queue = todaysItems
    .map((t) => {
      const text = t?.snippet?.topLevelComment?.snippet?.textOriginal
        || t?.snippet?.topLevelComment?.snippet?.textDisplay || "";
      return { thread: t, cls: classifyComment(text) };
    })
    .filter((x) => x.cls.priority !== "skip")
    .sort((a, b) =>
      PRIORITY_ORDER[a.cls.priority as Exclude<Priority, "skip">] -
      PRIORITY_ORDER[b.cls.priority as Exclude<Priority, "skip">]
    );
  out.skipped += todaysItems.length - queue.length;


  // Already handled comments
  const ids = items.map((t) => t?.snippet?.topLevelComment?.id).filter(Boolean);
  const doneSet = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: done } = await db
      .from("youtube_autoreply_log")
      .select("comment_id")
      .eq("user_id", userId)
      .eq("account_id", channelId)
      .in("comment_id", ids.slice(i, i + 200));
    for (const d of done || []) doneSet.add((d as any).comment_id);
  }

  // Video metadata (title, description, tags — reply ka context isi se banta hai)
  const videoIds = Array.from(new Set(items.map((t) => t?.snippet?.videoId).filter(Boolean)));
  const videoMap = new Map<string, { title: string; isShort: boolean; description: string; tags: string[] }>();
  for (let i = 0; i < videoIds.length; i += 50) {
    try {
      const vids = await gapi(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.slice(i, i + 50).join(",")}`,
        token,
      );
      for (const v of vids?.items || []) {
        videoMap.set(v.id, {
          title: v?.snippet?.title || "",
          isShort: isoToSeconds(v?.contentDetails?.duration || "") <= 60,
          description: (v?.snippet?.description || "").slice(0, 900),
          tags: Array.isArray(v?.snippet?.tags) ? v.snippet.tags.slice(0, 15) : [],
        });
      }
    } catch { /* non-fatal */ }
  }

  const lengthRule = settings.reply_length === "medium"
    ? "2 short sentences (max 40 words)."
    : settings.reply_length === "short"
    ? "1 short sentence (max 20 words)."
    : "No fixed limit — comment ke hisab se. Chhote comment ka chhota reply; sawal ho to poora, clear aur helpful jawab do (jitni lines chahiye utni).";

  const system = [
    `You are the real human owner of the YouTube channel "${channelTitle}" — not a bot.`,
    channelDesc ? `Channel is about: ${channelDesc}` : "",
    `Write a reply to a viewer's comment as the channel owner.`,
    `Tone: ${settings.tone}. Length: ${lengthRule}`,
    settings.language === "auto"
      ? "Reply in the SAME language/script the commenter used (Hindi, Gujarati, Hinglish or English)."
      : `Always reply in ${settings.language}.`,
    "STEP 1: comment ko dhyan se samjho (viewer asal me kya keh raha/puch raha hai).",
    "STEP 2: video ka Title, Description aur Tags padho — reply usi video ke content se match karna chahiye.",
    "STEP 3: channel ki description dekho taaki reply channel ke niche/persona jaisa lage.",
    "STEP 4: agar tab bhi context clear na ho, diye gaye 'Similar videos' research se topic samajh kar jawab do — par unka text copy mat karo.",
    "Be warm, human and specific to the comment. Never mention that you are an AI, and never say you are automated.",
    "Insaan jaisa likho: har baar alag shuruaat, alag shabd, alag structure. Template/copy-paste jaisa same text kabhi mat likho (YouTube isko spam maanta hai).",
    "Robotic phrases mat use karo jaise 'Thank you for your comment', 'We appreciate your feedback'.",
    "Agar comment me koi sawal ho to use pehle samjho, channel aur video ke context se sahi, practical aur satisfying jawab do. Kabhi sawal ignore mat karo.",
    "Never ask for subscribes/likes, never promote anything, no hashtags, no links, no phone/email, no markdown. 0-1 emoji maximum.",
    "Adhura reply mat likho — jo baat shuru karo use poora karo.",
    "TARGET RULE (sabse important): prompt me jo comment 'TARGET COMMENT' ke roop me diya gaya hai, SIRF usi ka jawab dena hai. Thread ka purana/top comment ya conversation history sirf background context hai — unka jawab mat do, unko dobara address mat karo.",
    settings.skip_negative
      ? "If the comment is abusive, spam, hateful, or asks for personal/financial details, reply with exactly: SKIP"
      : "Stay polite even with negative comments.",
    settings.custom_instructions ? `Owner's extra instructions: ${settings.custom_instructions}` : "",
    "Output ONLY the reply text.",
  ].filter(Boolean).join("\n");

  // Recent replies — duplicate text avoid karne ke liye (spam filter safety)
  const recentSet = new Set<string>();
  const recentTexts: string[] = [];
  try {
    const { data: recent } = await db
      .from("youtube_autoreply_log")
      .select("reply_text")
      .eq("user_id", userId)
      .eq("account_id", channelId)
      .eq("status", "replied")
      .order("created_at", { ascending: false })
      .limit(30);
    for (const r of recent || []) {
      const txt = String((r as any).reply_text || "");
      const n = normalize(txt);
      if (n) recentSet.add(n);
      if (txt && recentTexts.length < 8) recentTexts.push(txt.replace(/\s+/g, " ").slice(0, 120));
    }
  } catch { /* non-fatal */ }

  let postedThisRun = 0;


  for (const { thread, cls } of queue) {
    if (out.replied >= maxReplies) break;

    const top = thread?.snippet?.topLevelComment;
    const s = top?.snippet;
    const commentId: string = top?.id;
    if (!commentId || !s) { out.skipped++; continue; }
    if (doneSet.has(commentId)) { out.skipped++; continue; }

    // Skip our own comments
    if (s?.authorChannelId?.value === channelId) { out.skipped++; continue; }

    // Agar owner (aap) ne khud reply kar diya hai to AI us comment ko chhod de
    const replies: any[] = thread?.replies?.comments || [];
    let ownerReplied = replies.some((r) => r?.snippet?.authorChannelId?.value === channelId);
    const totalReplies = Number(thread?.snippet?.totalReplyCount || 0);
    if (!ownerReplied && totalReplies > replies.length) {
      // sirf partial replies mile the — poori list check karo
      try {
        const full = await gapi(
          `https://www.googleapis.com/youtube/v3/comments?part=snippet&parentId=${commentId}&maxResults=100&textFormat=plainText`,
          token,
        );
        ownerReplied = (full?.items || []).some((r: any) => r?.snippet?.authorChannelId?.value === channelId);
      } catch { /* non-fatal */ }
    }
    if (ownerReplied) { out.skipped++; continue; }


    const videoId: string = thread?.snippet?.videoId;
    const meta = videoMap.get(videoId);
    if (settings.reply_scope === "shorts" && meta && !meta.isShort) { out.skipped++; continue; }
    if (settings.reply_scope === "long" && meta && meta.isShort) { out.skipped++; continue; }

    const commentText: string = (s.textOriginal || s.textDisplay || "").slice(0, 800);
    const author: string = s.authorDisplayName || "Viewer";
    if (!commentText.trim()) { out.skipped++; continue; }

    // Context: video title + description + tags, phir channel description (system me),
    // aur agar context patla ho to dusre channels ke similar videos se seekho.
    const thinContext = !meta?.title || ((meta?.description || "").length < 60 && !(meta?.tags || []).length);
    let research = "";
    if (thinContext || cls.priority === "high") {
      research = await learnFromSimilarVideos(
        `${meta?.title || ""} ${commentText}`,
        token,
        channelId,
      );
    }

    const buildPrompt = (styleHint: string) => [
      meta?.title ? `Video title: ${meta.title}` : "",
      meta?.description ? `Video description: ${meta.description}` : "",
      meta?.tags?.length ? `Video tags: ${meta.tags.join(", ")}` : "",
      channelDesc ? `Channel description: ${channelDesc}` : "",
      research,
      `Viewer: ${author}`,
      `Comment priority: ${cls.priority}${cls.priority === "high" ? " (viewer ne sawal pucha hai — sahi aur helpful jawab do)" : cls.priority === "low" ? " (simple reaction — chhota, warm sa jawab)" : ""}`,
      `TARGET COMMENT (comment_id: ${commentId}) — sirf isi ka jawab dena hai:\n"""${commentText}"""`,
      recentTexts.length ? `Aapke haal ke replies (inse alag likhna hai, dohrao mat):\n- ${recentTexts.join("\n- ")}` : "",
      `Is reply ka andaaz: ${styleHint}`,
    ].filter(Boolean).join("\n");

    const userPrompt = buildPrompt(pickStyle());

    if (!opts.dryRun) {
      const quota = await reserveAiChatMessage(db, userId, "telegram");
      if (!quota.allowed) {
        out.note = "AI message plan limit reached. Upgrade your plan to resume auto-replies.";
        break;
      }
    }

    const aiRaw = await askAi(system + biz, userPrompt);
    if (!aiRaw) {
      out.items.push({ commentId, author, comment: commentText, reply: "", posted: false, error: "AI unavailable" });
      out.skipped++;
      continue;
    }
    if (/^skip$/i.test(aiRaw.trim())) {
      out.skipped++;
      if (!opts.dryRun) {
        await db.from("youtube_autoreply_log").upsert({
          user_id: userId, account_id: channelId, comment_id: commentId, video_id: videoId, video_title: meta?.title,
          is_short: meta?.isShort ?? null, author_name: author, comment_text: commentText,
          reply_text: null, status: "skipped",
        }, { onConflict: "user_id,comment_id" });
      }
      continue;
    }

    let reply = cleanReply(aiRaw, settings.signature || "");

    // Duplicate reply => research + naye style ke saath dobara try karo
    if (recentSet.has(normalize(reply))) {
      if (!research) {
        research = await learnFromSimilarVideos(`${meta?.title || ""} ${commentText}`, token, channelId);
      }
      const retry = await askAi(
        system + biz + "\nIMPORTANT: Pichle replies se bilkul alag shabd, alag shuruaat aur alag structure use karo.",
        buildPrompt(pickStyle()),
      );
      if (retry) reply = cleanReply(retry, settings.signature || "");
      if (recentSet.has(normalize(reply))) {
        out.skipped++;
        continue;
      }
    }


    if (!isValidReply(reply)) { out.skipped++; continue; }

    if (opts.dryRun) {
      out.items.push({ commentId, author, comment: commentText, reply, videoTitle: meta?.title, posted: false });
      out.replied++;
      continue;
    }

    // Human-like gap: pehle reply ke baad har reply se pehle thoda ruko
    if (postedThisRun > 0) await sleep(humanGap());

    let posted = false;
    let error: string | undefined;
    let abort = false;
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: reply } }),
      });
      if (!res.ok) {
        const body = await res.text();
        // Quota / spam / rate-limit => turant run band karo (channel safety)
        if (res.status === 403 || res.status === 429) abort = true;
        throw new Error(`[${res.status}] ${body.slice(0, 300)}`);
      }
      posted = true;
      postedThisRun++;
      out.replied++;
      recentSet.add(normalize(reply));
    } catch (e: any) {
      error = e?.message || String(e);
      out.skipped++;
    }

    await db.from("youtube_autoreply_log").upsert({
      user_id: userId, account_id: channelId, comment_id: commentId, video_id: videoId, video_title: meta?.title,
      is_short: meta?.isShort ?? null, author_name: author, comment_text: commentText,
      reply_text: reply, status: posted ? "replied" : "failed", error: error || null,
    }, { onConflict: "user_id,comment_id" });

    out.items.push({ commentId, author, comment: commentText, reply, videoTitle: meta?.title, posted, error });

    if (abort) {
      out.note = `YouTube ne request rok di (quota/spam/rate limit). Auto-reply ${PAUSE_MINUTES} min ke liye safely pause kar diya gaya.`;
      await db.from("youtube_autoreply_log").upsert({
        user_id: userId, account_id: channelId, comment_id: `pause:${Date.now()}`, video_id: videoId, video_title: meta?.title,
        is_short: meta?.isShort ?? null, author_name: "system", comment_text: "auto-pause",
        reply_text: null, status: "paused", error: error || null,
      }, { onConflict: "user_id,comment_id" });
      break;
    }

  }

  /* ------------- Reply-of-reply: hamare reply ka jawab aaya to uska bhi jawab ------------- */
  // YouTube Data API sirf 2 levels support karta hai: top comment + flat replies.
  // Exact target subId prompt/log me rahega, lekin comments.insert ka parentId
  // API requirement ke mutabik top-level comment id hi hona chahiye.
  if (out.replied < maxReplies) {
    type SubItem = {
      thread: any;
      target: any;          // wo reply jiska jawab dena hai
    };
    const subQueue: SubItem[] = [];

    for (const thread of items) {
      const topId: string = thread?.snippet?.topLevelComment?.id;
      if (!topId) continue;
      let replies: any[] = thread?.replies?.comments || [];
      const totalReplies = Number(thread?.snippet?.totalReplyCount || 0);
      if (!replies.length) continue;
      // YouTube ka embedded replies subset/order reliable latest list nahi hota.
      // Multi-reply thread me full list zaroor lao, chahe totalReplyCount stale ho.
      if (replies.length > 1 || totalReplies > replies.length) {
        try {
          const full = await gapi(
            `https://www.googleapis.com/youtube/v3/comments?part=snippet&parentId=${topId}&maxResults=100&textFormat=plainText`,
            token,
          );
          if (full?.items?.length) replies = full.items;
        } catch { /* non-fatal */ }
      }
      // time order (purana -> naya). Same-millisecond timestamps me stable id
      // tie-break rakho, taaki embedded/full API response order target na badle.
      const convo = [...replies].sort((a, b) =>
        new Date(a?.snippet?.publishedAt || 0).getTime() - new Date(b?.snippet?.publishedAt || 0).getTime()
        || String(a?.id || "").localeCompare(String(b?.id || ""))
      );
      // aakhri reply hi candidate hai — aur wo hamara nahi hona chahiye
      const last = convo[convo.length - 1];
      if (!last) continue;
      if (last?.snippet?.authorChannelId?.value === channelId) continue;
      // hamne is thread me pehle reply kiya ho (ya top-level comment hi hamara ho),
      // tabhi ye "reply ka reply" hai
      const topIsOurs = thread?.snippet?.topLevelComment?.snippet?.authorChannelId?.value === channelId;
      const weRepliedBefore = topIsOurs || convo.some((r) =>
        r?.snippet?.authorChannelId?.value === channelId &&
        new Date(r?.snippet?.publishedAt || 0).getTime() < new Date(last?.snippet?.publishedAt || 0).getTime()
      );
      if (!weRepliedBefore) continue;
      // sirf aaj (IST) ka reply
      if (istDate(last?.snippet?.publishedAt || "") !== today) continue;
      const txt = last?.snippet?.textOriginal || last?.snippet?.textDisplay || "";
      if (classifyComment(txt).priority === "skip") { out.skipped++; continue; }
      subQueue.push({ thread, target: last });
    }

    if (subQueue.length) {
      // already handled sub-replies chhod do
      const subIds = subQueue.map((x) => x.target?.id).filter(Boolean);
      for (let i = 0; i < subIds.length; i += 200) {
        const { data: done } = await db
          .from("youtube_autoreply_log")
          .select("comment_id")
          .eq("user_id", userId)
          .eq("account_id", channelId)
          .in("comment_id", subIds.slice(i, i + 200));
        for (const d of done || []) doneSet.add((d as any).comment_id);
      }

      for (const { thread, target } of subQueue) {
        if (out.replied >= maxReplies) break;
        const subId: string = target?.id;
        if (!subId || doneSet.has(subId)) { out.skipped++; continue; }

        const topId: string = thread?.snippet?.topLevelComment?.id;
        if (!topId) { out.skipped++; continue; }
        const videoId: string = thread?.snippet?.videoId;
        const meta = videoMap.get(videoId);
        if (settings.reply_scope === "shorts" && meta && !meta.isShort) { out.skipped++; continue; }
        if (settings.reply_scope === "long" && meta && meta.isShort) { out.skipped++; continue; }

        const author: string = target?.snippet?.authorDisplayName || "Viewer";
        const commentText: string = (target?.snippet?.textOriginal || target?.snippet?.textDisplay || "").slice(0, 800);
        if (!commentText.trim()) { out.skipped++; continue; }

        // Nested reply ke liye purana/top comment model ko bilkul mat bhejo.
        // Selection se posting tak subId hi single source of truth hai.
        const prompt = [
          meta?.title ? `Video title: ${meta.title}` : "",
          meta?.description ? `Video description: ${meta.description}` : "",
          channelDesc ? `Channel description: ${channelDesc}` : "",
          "NESTED REPLY MODE: Neeche sirf ek comment diya gaya hai. Isi exact comment ka seedha jawab likho.",
          `EXACT TARGET (comment_id: ${subId}, author: ${author}):\n"""${commentText}"""`,
          `Apna jawab bhejne se pehle verify karo: kya yeh exact text "${commentText.replace(/\s+/g, " ").slice(0, 180)}" ka jawab hai? Agar nahi, dobara likho.`,
          recentTexts.length ? `Aapke haal ke replies (inse alag likhna hai):\n- ${recentTexts.join("\n- ")}` : "",
          `Is reply ka andaaz: ${pickStyle()}`,
        ].filter(Boolean).join("\n");

        const nestedSystem = `${system}\nNESTED REPLY OVERRIDE: Sirf EXACT TARGET ke andar ka text dekho aur usi ka jawab do. Kisi purane/top comment ka sawal answer karna mana hai, chahe woh unanswered lage.`;
        if (!opts.dryRun) {
          const quota = await reserveAiChatMessage(db, userId, "telegram");
          if (!quota.allowed) {
            out.note = "AI message plan limit reached. Upgrade your plan to resume auto-replies.";
            break;
          }
        }

        const aiRaw = await askAi(nestedSystem + biz, prompt);
        if (!aiRaw) {
          out.items.push({ commentId: subId, author, comment: commentText, reply: "", posted: false, error: "AI unavailable" });
          out.skipped++;
          continue;
        }
        if (/^skip$/i.test(aiRaw.trim())) {
          out.skipped++;
          if (!opts.dryRun) {
            await db.from("youtube_autoreply_log").upsert({
              user_id: userId, account_id: channelId, comment_id: subId, video_id: videoId, video_title: meta?.title,
              is_short: meta?.isShort ?? null, author_name: author, comment_text: commentText,
              reply_text: null, status: "skipped",
            }, { onConflict: "user_id,comment_id" });
          }
          continue;
        }

        let reply = cleanReply(aiRaw, settings.signature || "");
        if (!isValidReply(reply) || recentSet.has(normalize(reply))) { out.skipped++; continue; }
        // sub-reply me mention se saaf pata chalta hai kis ko jawab diya gaya hai
        const cleanAuthor = author.replace(/^@/, "").trim() || "Viewer";
        const mention = `@${cleanAuthor}`;
        const replyText = reply.startsWith("@") ? reply : `${mention} ${reply}`;

        if (opts.dryRun) {
          out.items.push({ commentId: subId, author, comment: commentText, reply: replyText, videoTitle: meta?.title, posted: false });
          out.replied++;
          continue;
        }

        if (postedThisRun > 0) await sleep(humanGap());

        let posted = false;
        let error: string | undefined;
        let abort = false;
        try {
          console.log(`[autoreply] nested target mapping targetCommentId=${subId} apiParentId=${topId}`);
          const res = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ snippet: { parentId: topId, textOriginal: replyText } }),
          });
          if (!res.ok) {
            const body = await res.text();
            if (res.status === 403 || res.status === 429) abort = true;
            throw new Error(`[${res.status}] ${body.slice(0, 300)}`);
          }
          posted = true;
          postedThisRun++;
          out.replied++;
          recentSet.add(normalize(reply));
        } catch (e: any) {
          error = e?.message || String(e);
          out.skipped++;
        }

        await db.from("youtube_autoreply_log").upsert({
          user_id: userId, account_id: channelId, comment_id: subId, video_id: videoId, video_title: meta?.title,
          is_short: meta?.isShort ?? null, author_name: author, comment_text: commentText,
          reply_text: replyText, status: posted ? "replied" : "failed", error: error || null,
        }, { onConflict: "user_id,comment_id" });

        out.items.push({ commentId: subId, author, comment: commentText, reply: replyText, videoTitle: meta?.title, posted, error });

        if (abort) {
          out.note = `YouTube ne request rok di (quota/spam/rate limit). Auto-reply ${PAUSE_MINUTES} min ke liye safely pause kar diya gaya.`;
          await db.from("youtube_autoreply_log").upsert({
            user_id: userId, account_id: channelId, comment_id: `pause:${Date.now()}`, video_id: videoId, video_title: meta?.title,
            is_short: meta?.isShort ?? null, author_name: "system", comment_text: "auto-pause",
            reply_text: null, status: "paused", error: error || null,
          }, { onConflict: "user_id,comment_id" });
          break;
        }
      }
    }
  }

  if (!out.replied && !out.note) {
    out.note = `Aaj (${today} IST) ka koi naya comment ya reply nahi mila`;
  }


  if (!opts.dryRun) {
    await db.from("youtube_autoreply_settings").upsert({
      user_id: userId,
      account_id: channelId,
      last_run_at: new Date().toISOString(),
      last_run_status: `${out.replied} replied, ${out.skipped} skipped`,
    }, { onConflict: "user_id,account_id" });
  }

  return out;
}

/* --------------------------------- Router --------------------------------- */

export async function handleAutoReplyAction(action: AutoReplyAction, body: any, req: Request): Promise<any> {
  const db = admin();

  if (action === "yt_autoreply_cron") {
    const key = req.headers.get("x-cron-key") || body?.cronKey || "";
    const cronKey = Deno.env.get("YT_AUTOREPLY_CRON_KEY") || "";
    if (key !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && !(cronKey && key === cronKey)) {
      return { success: false, error: "Unauthorized" };
    }
    const { data: rows } = await db
      .from("youtube_autoreply_settings")
      .select("user_id, account_id")
      .eq("enabled", true);
    const results: any[] = [];
    for (const r of rows || []) {
      try {
        // Each enabled channel runs on its own; "" = legacy row → default channel.
        const res = await runAutoReplyForUser(r.user_id, { accountId: (r as any).account_id || null });
        results.push({ userId: r.user_id, replied: res.replied, skipped: res.skipped, note: res.note });
      } catch (e: any) {
        results.push({ userId: r.user_id, error: e?.message || String(e) });
      }
    }
    return { success: true, users: results.length, results };
  }

  const userId = await getUserId(req);

  // Resolve the channel this request targets (explicit account_id or default channel).
  const reqConn = await getConnectionForAccount(db, userId, (body?.account_id ? String(body.account_id) : null));
  const reqChannel: string = reqConn?.channel_id || "";

  if (action === "yt_autoreply_get") {
    const settings = await loadSettings(userId, reqChannel);
    let q = db
      .from("youtube_autoreply_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "replied");
    if (reqChannel) q = q.eq("account_id", reqChannel);
    const { count } = await q;
    return { success: true, settings, totalReplies: count || 0 };
  }

  if (action === "yt_autoreply_save") {
    const p = body?.settings || {};
    const current = await loadSettings(userId, reqChannel);
    const base: Record<string, unknown> = {};
    for (const k of ["enabled", "tone", "language", "reply_scope", "reply_length", "max_replies_per_run", "custom_instructions", "signature", "skip_negative"]) {
      if ((current as any)[k] !== undefined) base[k] = (current as any)[k];
    }
    const patch: Record<string, unknown> = { ...base, user_id: userId, account_id: reqChannel, updated_at: new Date().toISOString() };
    if (typeof p.enabled === "boolean") patch.enabled = p.enabled;
    if (typeof p.tone === "string") patch.tone = p.tone.slice(0, 40);
    if (typeof p.language === "string") patch.language = p.language.slice(0, 40);
    if (["all", "shorts", "long"].includes(p.reply_scope)) patch.reply_scope = p.reply_scope;
    if (["auto", "short", "medium"].includes(p.reply_length)) patch.reply_length = p.reply_length;
    if (Number.isFinite(Number(p.max_replies_per_run))) {
      patch.max_replies_per_run = Math.max(0, Number(p.max_replies_per_run));
    }
    if (typeof p.custom_instructions === "string") patch.custom_instructions = p.custom_instructions.slice(0, 1000);
    if (typeof p.signature === "string") patch.signature = p.signature.slice(0, 120);
    if (typeof p.skip_negative === "boolean") patch.skip_negative = p.skip_negative;

    const { error } = await db.from("youtube_autoreply_settings").upsert(patch, { onConflict: "user_id,account_id" });
    if (error) throw new Error(error.message);
    return { success: true, settings: await loadSettings(userId, reqChannel) };
  }

  if (action === "yt_autoreply_run") {
    const res = await runAutoReplyForUser(userId, {
      dryRun: !!body?.dryRun,
      limit: body?.limit,
      ignoreEnabled: true,
    });
    return { success: true, ...res };
  }

  if (action === "yt_autoreply_log") {
    const todayOnly = !!body?.todayOnly;
    const startUtc = new Date(`${istDate(new Date())}T00:00:00+05:30`).toISOString();
    if (todayOnly) {
      // Har naye din data reset — purana log delete
      await db.from("youtube_autoreply_log").delete().eq("user_id", userId).lt("created_at", startUtc);
    }
    let q = db
      .from("youtube_autoreply_log")
      .select("id, comment_id, video_id, video_title, is_short, author_name, comment_text, reply_text, status, error, created_at")
      .eq("user_id", userId);
    if (todayOnly) q = q.gte("created_at", startUtc);
    const { data } = await q
      .order("created_at", { ascending: false })
      .limit(Math.min(200, Number(body?.limit) || 20));
    return { success: true, items: data || [] };
  }

  throw new Error(`Unknown auto-reply action: ${action}`);
}
