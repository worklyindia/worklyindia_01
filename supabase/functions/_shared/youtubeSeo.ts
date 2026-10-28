// YouTube AI SEO Master — generates and validates title / description / tags /
// hashtags / category for videos and Shorts, always inside YouTube's own limits.
// Runs through the existing `unified-youtube-api` edge function.
//
// Safety: this module never deletes anything. It only reads metadata and returns
// suggestions; writing happens through the existing `yt_video_update` action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getMyVideoMetaForUser, refreshIfNeeded, getConnectionForAccount } from "./youtubeGrowth.ts";
import { buildYouTubePayload, sanitizeTitle } from "./youtubeSeoPayload.ts";

export const SEO_ACTIONS = ["yt_seo_pack", "yt_seo_channel_audit"] as const;
export type SeoAction = (typeof SEO_ACTIONS)[number];

/** Official YouTube limits + the practical "best" targets we optimise for. */
export const YT_SEO_LIMITS = {
  titleMax: 100,
  titleIdeal: 70,
  descriptionMax: 5000,
  descriptionIdealMin: 250,
  tagsMaxCount: 60,
  tagsTotalChars: 500,
  tagIdealCount: 22,
  tagMaxChars: 40,
  hashtagsMax: 15,
  hashtagsIdeal: 3,
};

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

/** Soft YouTube GET: never throws, returns {} on any failure so SEO keeps working. */
async function ytGet(url: string, token: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[YT SEO] API warning:", json?.error?.message || res.status);
      return {};
    }
    return json;
  } catch (e) {
    console.warn("[YT SEO] API fetch failed:", e instanceof Error ? e.message : e);
    return {};
  }
}

const isoToSeconds = (iso: string): number => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "") || [];
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

/* ------------------------------- sanitising ------------------------------- */

/** YouTube rejects `<` and `>` in titles/descriptions. */
const stripAngle = (s: string) => String(s || "").replace(/[<>]/g, "");

const cleanTag = (t: unknown) =>
  String(t || "")
    .replace(/[<>"#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, YT_SEO_LIMITS.tagMaxChars);

const hashify = (s: string) =>
  "#" + String(s || "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 40);

/** Keeps tags unique, within 60 count AND 500 total characters (YouTube's real cap). */
function packTags(raw: unknown[], mustHave: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let chars = 0;
  const push = (value: unknown) => {
    const t = cleanTag(value);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    // YouTube counts a quoted tag with a space as +2 chars, plus a separator.
    const cost = t.length + (t.includes(" ") ? 2 : 0) + (out.length ? 1 : 0);
    if (out.length >= YT_SEO_LIMITS.tagsMaxCount) return;
    if (chars + cost > YT_SEO_LIMITS.tagsTotalChars) return;
    seen.add(key);
    chars += cost;
    out.push(t);
  };
  mustHave.forEach(push);
  raw.forEach(push);
  return out;
}

function packHashtags(raw: unknown[], mustHave: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  [...mustHave, ...raw].forEach((v) => {
    const h = hashify(String(v || "").replace(/^#/, ""));
    if (h.length < 3) return;
    const key = h.toLowerCase();
    if (seen.has(key) || out.length >= YT_SEO_LIMITS.hashtagsMax) return;
    seen.add(key);
    out.push(h);
  });
  return out;
}

/** Builds the final description: hook, body, channel block, hashtags. */
function composeDescription(
  body: string,
  opts: {
    channelTitle: string;
    channelHandle?: string | null;
    channelUrl?: string | null;
    hashtags: string[];
    isShort: boolean;
  },
): string {
  let text = stripAngle(body).trim();

  // No forced brand block / subscribe spam — creator-style description only.
  // Hashtags are a SEPARATE field: strip any that leaked into the prose.
  text = text
    .split("\n")
    .filter((line) => !(/#[\p{L}\p{N}_]+/u.test(line) && line.replace(/#[\p{L}\p{N}_]+/gu, "").trim().length < 15))
    .join("\n")
    .replace(/#([\p{L}\p{N}_]+)/gu, "$1");

  return text.replace(/\n{4,}/g, "\n\n\n").trim().slice(0, YT_SEO_LIMITS.descriptionMax);
}

const escapeRe = (s: string) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------------------------- AI ----------------------------------- */

const SEO_MODEL = "openai/gpt-5.6-sol";

async function aiJson(system: string, user: string): Promise<any | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.warn("[YT SEO] LOVABLE_API_KEY missing — using rule-based fallback");
    return null;
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SEO_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[YT SEO] AI gateway error:", json?.error?.message || res.status);
      return null;
    }
    const content = json?.choices?.[0]?.message?.content || "";
    const raw = content.trim().replace(/^```json/i, "").replace(/```$/, "");
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[YT SEO] AI parse/call failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

const SYSTEM_PROMPT = `You are the creator himself writing his own YouTube metadata — simple, natural Hindi/Hinglish, exactly like a farmer/village vlogger talks. You are NOT an SEO tool and the text must never read like one. A viewer reading it must feel "ye khud creator ne likha hai", never "ye kisi tool ne likha hai".

SOUND HUMAN (most important):
- FIRST PERSON, creator's own voice. Write as if the creator wrote it about HIS day, HIS khet, HIS gaon: "aaj khet par aaya tha to socha aap logon ko bhi haal dikha du…". Use "main / mere khet mein / aaj khet par / hamare gaon mein / aap log bataana" where it fits naturally — never forced into every line.
- Vary the rhythm like real speech: mix short lines with longer ones, use everyday spoken words, one small personal detail (mausam, time of day, kaam, koi cheez jo dikh rahi hai). Real people repeat a small habit word sometimes — that is fine — but never repeat a full phrase.
- Every video must start differently. No template opening, no same closing line across videos.
- NEVER write these (instant failure): "aaj ke kisan blog mein <channel> aapko khet ki taaza jaankari de rahe hain", "taaza jaankari", "jaaniye aaj khet mein kya chal raha hai", "prakriti ka anand lein", "yeh video zyada logon tak pahunchega", any SEO explanation, any confirmation to the user.
- No AI-style phrases: "is video mein aap seekhenge", "ground reality", "important tips", "audience", "optimization", "in this video", "let's dive in". No corporate tone, no bullet spam, no emoji spam (max 1-2 emojis, only if natural), no marketing sentences.
- NEVER treat the channel name as a person. The channel name (e.g. "Gohil Khedut") is a brand: never "Gohil Khedut ne bataya…". Use it only as a natural channel reference, and never start the description with it.

YOUTUBE POLICY SAFETY (metadata must pass YouTube's spam & deceptive practices policy):
- Metadata must honestly describe the actual video. No misleading title, no fake claims, no bait ("aisa pehle kabhi nahi dekha") unless it is literally true in the video.
- No engagement bait ("like karo warna...", "sabko share karna hi padega"), no "sub4sub", no giveaway/earning claims, no medical/financial promises, no shocking or violent wording, nothing adult/abusive.
- No keyword stuffing anywhere: no repeated words, no tag walls, no unrelated trending keywords, no other creators'/brands' names, no repeated hashtag spam like "#viral #viral #viral".
- Max 3-5 hashtags total (YouTube ignores/penalises 15+). Nothing misleading like "#shorts" on a long video.
- Never promise virality, never invent statistics, awards, prices or testimonials.

VIRAL BUT HONEST:
- Put the strongest real search phrase near the front of the title, in the words a normal viewer would type.
- Title should create curiosity from a TRUE detail of the video (kya hua, kitna, kaise), not from exaggeration.
- First 1-2 lines of the description are what viewers see — make them a natural, interesting hook about this exact video.

FIELD RULES (BREAKING THESE = FAILED OUTPUT):
- "title" MUST BE THE ACTUAL TITLE TEXT ONLY — the exact line that will appear on YouTube. NEVER write what you changed or why. Sentences like "Changed to be more engaging and descriptive in Hindi, keeping the core elements", "Updated title for better SEO", "Made it more clickable", "Naya title banaya hai" are FORBIDDEN in the title field; that kind of note belongs ONLY in "summary".
- The description must NEVER end with (or contain) a bare keyword line — e.g. "khetvlog farming gohilkhedut gaonkadunia khet". Keywords go ONLY in "tags", hashtags ONLY in "hashtags" (max 5) and never inside the description. A description line must always be a real spoken sentence, never a list of words.
- The description field is VIEWER-FACING PROSE ONLY. Never put labels ("Title:", "Description:", "YouTube Tags:", "Category:", "Hashtags:"), never a tag list, never keywords, never "--" separators, never JSON or markdown inside it. Tags belong ONLY in the tags array and hashtags ONLY in the hashtags array — NEVER write any hashtag (#...) inside the description.
- title: long videos 50-70 characters, Shorts 40-60 (hard max 100). Natural, accurate, no repeated words, no ALL CAPS, no "<" or ">". If the CURRENT title is already clear and relevant, return it unchanged.
- description: long videos 2-4 short paragraphs, Shorts 2-3 short lines (Shorts stay compact, spoken-style, max ~500 characters). Max 5000 characters overall. Main topic appears naturally 1-2 times only, at most one short natural subscribe line.
- End the description with ONE natural question tied to THIS video's actual topic plus a natural CTA — a new question every time, never the same "aapke area mein aaj mausam kaisa hai?" template unless the video is genuinely about mausam. The comment CTA emoji must be 💬 — never 👇 / 👉 / ☝️.
- NEVER write the escape sequence "\\n" (or \\t, \\r) inside "description" — use REAL line breaks in the JSON string. A literal "\\n" becomes visible text on YouTube.
- Grammar must be correct, natural Hindi/Hinglish. Wrong: "आपकी तरफ़ खेत में ऐसे साँप मिलते हैं क्या?" → Right: "आपके खेत में ऐसे साँप मिलते हैं क्या? कमेंट करके ज़रूर बताना 💬". Re-read every sentence before returning it.
- tags: long videos 8-15, Shorts 6-12 — real search terms plus genuine variations of the topic. Each under 40 characters, total under 500, no "#", no "--", no empty/punctuation-only values, no labels, no duplicates or near-duplicates. Channel name only where genuinely useful (1-2 max).
- hashtags: 3-5, only about the video's actual topic, no duplicates. For a Short, "#shorts" may be one of them; on long videos never use it.
- categoryId: the numeric YouTube category id matching the real content — for farmer / village / daily vlog content that is "22" (People & Blogs) unless the content clearly belongs elsewhere. Never send a category name, never a wrong category for SEO reasons.
- Title, description, hashtags, tags and the real video content must describe the SAME topic.
- Compare OLD vs NEW: if the current value is already good, keep it as-is. Not every video needs an SEO update.
- Language: match the language of the video's existing title/description; if unclear, use simple Hindi/Hinglish.
- Anything you want to say ABOUT the SEO (reasoning, score, suggestions) goes only in "summary" / "issues" — never inside title, description, tags or hashtags.

Answer with JSON only, this exact shape:
{"title":"","titleAlternatives":["",""],"description":"","tags":[""],"hashtags":[""],"categoryId":"","categoryReason":"","keywords":[""],"issues":[""],"score":0,"summary":""}`;

/**
 * Creator-approved "perfect" reference examples (public.youtube_seo_examples).
 * STYLE reference only — the AI must never copy this text into a new video.
 */
async function buildGoldExampleBlock(userId?: string | null): Promise<string> {
  try {
    const { data } = await admin()
      .from("youtube_seo_examples")
      .select("title, description, hashtags, tags, category_id, notes, user_id, is_active")
      .eq("is_active", true)
      .or(userId ? `user_id.is.null,user_id.eq.${userId}` : "user_id.is.null")
      .order("created_at", { ascending: false })
      .limit(2);
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return "";
    const blocks = rows
      .map(
        (r: any) =>
          `TITLE:\n${r.title}\n\nDESCRIPTION:\n${String(r.description || "").slice(0, 1600)}\n\nHASHTAGS: ${(r.hashtags || []).join(" ")}\nTAGS: ${(r.tags || []).join(", ")}\nCATEGORY ID: ${r.category_id || "22"}${r.notes ? `\nWHY THIS IS PERFECT: ${r.notes}` : ""}`,
      )
      .join("\n\n---\n\n");
    return `

✅ PERFECT REFERENCE (creator ne khud approve kiya hai — ISI structure aur ISI tone me likho, lekin text copy mat karo; naye video ke hisab se naye shabd likho):
${blocks}

Is example se ye seekho: title = sirf asli title (koi explanation nahi), description = spoken Hinglish paragraphs + ek sawaal + natural subscribe/like line, aur end me sirf hashtags — bare keyword line kabhi nahi.`;
  } catch (e) {
    console.warn("[YT SEO] gold example load failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

/* --------------------------------- context -------------------------------- */

async function loadChannelContext(token: string) {
  const ch = await ytGet(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,topicDetails,contentDetails&mine=true",
    token,
  );
  const c = ch.items?.[0];
  const uploadsPlaylist = c?.contentDetails?.relatedPlaylists?.uploads;

  // Derive the channel's real category mix from its own recent uploads.
  const catCount: Record<string, number> = {};
  let recent: Array<{ videoId: string; title: string; categoryId: string; tags: string[]; description: string; isShort: boolean }> = [];
  if (uploadsPlaylist) {
    const pl = await ytGet(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploadsPlaylist}`,
      token,
    );
    const ids = (pl.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
    if (ids.length) {
      const vids = await ytGet(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.slice(0, 50).join(",")}`,
        token,
      );
      recent = (vids.items || []).map((v: any) => {
        const catId = String(v.snippet?.categoryId || "");
        if (catId) catCount[catId] = (catCount[catId] || 0) + 1;
        return {
          videoId: v.id,
          title: v.snippet?.title || "",
          categoryId: catId,
          tags: v.snippet?.tags || [],
          description: v.snippet?.description || "",
          isShort: isoToSeconds(v.contentDetails?.duration || "") <= 180,
        };
      });
    }
  }

  const cats = await ytGet(
    "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=IN",
    token,
  );
  const categories = (cats.items || [])
    .filter((x: any) => x.snippet?.assignable)
    .map((x: any) => ({ id: String(x.id), title: String(x.snippet.title) }));

  const primaryCategoryId = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    channelId: c?.id || null,
    channelTitle: c?.snippet?.title || "My channel",
    channelDescription: c?.snippet?.description || "",
    channelHandle: c?.snippet?.customUrl ? `@${String(c.snippet.customUrl).replace(/^@/, "")}` : null,
    channelUrl: c?.snippet?.customUrl
      ? `https://www.youtube.com/${String(c.snippet.customUrl).startsWith("@") ? c.snippet.customUrl : "@" + c.snippet.customUrl}`
      : c?.id ? `https://www.youtube.com/channel/${c.id}` : null,
    channelKeywords: c?.brandingSettings?.channel?.keywords || "",
    topics: (c?.topicDetails?.topicCategories || []).map((t: string) => t.split("/").pop()?.replace(/_/g, " ")).filter(Boolean),
    subscriberCount: Number(c?.statistics?.subscriberCount || 0),
    categories,
    categoryMix: catCount,
    primaryCategoryId,
    recent,
  };
}

/** Channel-name variants that must always exist as tags so name-search finds the video. */
function brandTags(ctx: { channelTitle: string; channelHandle?: string | null; channelKeywords?: string }): string[] {
  const name = ctx.channelTitle || "";
  const compact = name.replace(/\s+/g, "");
  const handle = (ctx.channelHandle || "").replace(/^@/, "");
  const kw = String(ctx.channelKeywords || "")
    .match(/"[^"]+"|[^\s"]+/g)?.map((k) => k.replace(/"/g, "")) || [];
  return [name, compact, handle, `${name} channel`, `${name} official`, ...kw.slice(0, 4)]
    .map(cleanTag)
    .filter((t) => t.length > 1);
}

/* --------------------------- trending SEO research ------------------------ */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "you", "kya", "hai", "hain",
  "mein", "me", "ka", "ki", "ke", "aur", "video", "shorts", "short", "full", "new", "latest",
]);

const freqTop = (rows: string[], limit: number) => {
  const map = new Map<string, { value: string; count: number }>();
  for (const raw of rows) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const hit = map.get(key);
    if (hit) hit.count += 1;
    else map.set(key, { value, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
};

/**
 * Public YouTube research: what are the top-performing videos on this topic
 * doing with their title / description / hashtags / tags right now.
 * Read-only, never touches the user's own videos.
 */
export async function researchTrendingSeo(
  token: string,
  topic: string,
  opts: { limit?: number; isShort?: boolean; regionCode?: string } = {},
) {
  const query = String(topic || "").replace(/[#<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!query) return null;
  const limit = Math.min(12, Math.max(3, opts.limit ?? 8));

  const runSearch = async (order: string, days: number) => {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(25, limit * 2)),
      order,
      regionCode: opts.regionCode || "IN",
      publishedAfter: new Date(Date.now() - days * 86400000).toISOString(),
    });
    if (opts.isShort) params.set("videoDuration", "short");
    try {
      const res = await ytGet(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, token);
      return (res.items || []).map((i: any) => i.id?.videoId).filter(Boolean) as string[];
    } catch (_e) {
      return [] as string[];
    }
  };

  // Two passes: all-time best performers on the topic + what is trending right now.
  const [topIds, freshIds] = await Promise.all([
    runSearch("viewCount", 365),
    runSearch("relevance", 60),
  ]);
  const ids = [...new Set([...topIds, ...freshIds])].slice(0, Math.min(40, limit * 4));
  if (!ids.length) return null;


  const det = await ytGet(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`,
    token,
  );

  const videos = (det.items || [])
    .map((v: any) => {
      const description = String(v.snippet?.description || "");
      const seconds = isoToSeconds(v.contentDetails?.duration || "");
      const views = Number(v.statistics?.viewCount || 0);
      const ageDays = Math.max(
        1,
        Math.round((Date.now() - new Date(v.snippet?.publishedAt || Date.now()).getTime()) / 86400000),
      );
      return {
        videoId: v.id,
        title: String(v.snippet?.title || ""),
        channelTitle: String(v.snippet?.channelTitle || ""),
        publishedAt: v.snippet?.publishedAt || "",
        views,
        viewsPerDay: Math.round((views / ageDays) * 10) / 10,
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
        isShort: seconds > 0 && seconds <= 181,
        tags: (v.snippet?.tags || []).slice(0, 15) as string[],
        hashtags: (description.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 10) as string[],
        descriptionSnippet: description.replace(/\s+/g, " ").slice(0, 400),
        descriptionLength: description.length,
      };
    })
    .sort((a: any, b: any) => b.viewsPerDay - a.viewsPerDay)
    .slice(0, limit);

  if (!videos.length) return null;

  const titleWords = videos.flatMap((v: any) =>
    v.title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w: string) => w.length > 3 && !STOP_WORDS.has(w)),
  );

  return {
    query,
    checked: videos.length,
    videos,
    topTags: freqTop(videos.flatMap((v: any) => v.tags), 20),
    topHashtags: freqTop(videos.flatMap((v: any) => v.hashtags), 12),
    topTitleKeywords: freqTop(titleWords, 15),
    avgTitleLength: Math.round(videos.reduce((s: number, v: any) => s + v.title.length, 0) / videos.length),
    avgDescriptionLength: Math.round(
      videos.reduce((s: number, v: any) => s + v.descriptionLength, 0) / videos.length,
    ),
  };
}

/** Same research, resolved for a connected user (used by the AI chat tool). */
export async function researchTrendingSeoForUser(
  userId: string,
  topic: string,
  opts: { limit?: number; isShort?: boolean; regionCode?: string } = {},
) {
  const conn = await getConnectionForAccount(admin(), userId, (opts as any)?.accountId ?? null);
  if (!conn) return { success: false, connected: false, error: "YouTube not connected" };
  const token = await refreshIfNeeded(conn);
  const research = await researchTrendingSeo(token, topic, opts);
  if (!research) {
    return { success: false, connected: true, error: `No trending videos found for "${topic}"` };
  }
  return { success: true, connected: true, research };
}

/* -------------------------------- handler -------------------------------- */


/** HTTP entry point (edge function): resolves the user from the JWT, then runs the SEO action. */
export async function handleSeoAction(action: SeoAction, body: any, req: Request): Promise<any> {
  return await runSeoForUser(action, body, await getUserId(req));
}

/**
 * Direct entry point for trusted server-side callers (AI chat tools) that already
 * know the user id. Never deletes anything — read + suggest only.
 */
export async function runSeoForUser(action: SeoAction, body: any, userId: string): Promise<any> {
  const db = admin();

  const accountId = body?.account_id ?? body?.accountId ?? body?.channel_id ?? null;
  const conn = await getConnectionForAccount(db, userId, accountId ? String(accountId) : null);
  if (!conn) return { success: false, connected: false, error: "YouTube not connected" };

  const token = await refreshIfNeeded(conn);
  const canEdit = String(conn.scope || "").includes("youtube.force-ssl");
  const ctx = await loadChannelContext(token);
  const catTitle = (id: string) => ctx.categories.find((c: any) => c.id === String(id))?.title || (id ? `Category ${id}` : "Not set");

  /* ---------------- yt_seo_channel_audit: scan every recent video ---------------- */
  if (action === "yt_seo_channel_audit") {
    const items = ctx.recent.map((v) => {
      const problems: string[] = [];
      if (v.title.length > YT_SEO_LIMITS.titleMax) problems.push("Title over 100 characters");
      if (v.title.length < 25) problems.push("Title too short for search");
      if (!v.description || v.description.length < 120) problems.push("Description too thin (add 250+ characters)");
      if (!v.tags.length) problems.push("No tags");
      else if (v.tags.length < 8) problems.push("Fewer than 8 tags");
      if (ctx.primaryCategoryId && v.categoryId && v.categoryId !== ctx.primaryCategoryId) {
        problems.push(`Category "${catTitle(v.categoryId)}" differs from your channel's main category "${catTitle(ctx.primaryCategoryId)}"`);
      }
      if (!v.categoryId) problems.push("Category not set");
      return {
        videoId: v.videoId,
        title: v.title,
        isShort: v.isShort,
        categoryId: v.categoryId,
        categoryTitle: catTitle(v.categoryId),
        tagCount: v.tags.length,
        problems,
        health: Math.max(0, 100 - problems.length * 14),
      };
    });

    return {
      success: true,
      connected: true,
      canEdit,
      channel: {
        title: ctx.channelTitle,
        handle: ctx.channelHandle,
        url: ctx.channelUrl,
        subscriberCount: ctx.subscriberCount,
        primaryCategoryId: ctx.primaryCategoryId,
        primaryCategoryTitle: ctx.primaryCategoryId ? catTitle(ctx.primaryCategoryId) : null,
        topics: ctx.topics,
      },
      categories: ctx.categories,
      totals: {
        scanned: items.length,
        needsWork: items.filter((i) => i.problems.length > 0).length,
        categoryMismatch: items.filter((i) => i.problems.some((p) => p.startsWith("Category \""))).length,
        avgHealth: items.length ? Math.round(items.reduce((s, i) => s + i.health, 0) / items.length) : 0,
      },
      items,
    };
  }

  /* -------------------------- yt_seo_pack: one video/draft -------------------------- */
  const videoId = String(body.videoId || "").trim();
  let current = {
    videoId: "",
    title: String(body.draft?.title || ""),
    description: String(body.draft?.description || ""),
    tags: Array.isArray(body.draft?.tags) ? body.draft.tags.map(String) : [],
    categoryId: String(body.draft?.categoryId || ""),
    defaultLanguage: String(body.draft?.defaultLanguage || ""),
    durationSeconds: 0,
    isShort: !!body.draft?.isShort,
    views: 0,
    publishedAt: "",
  };

  if (videoId) {
    const vres = await ytGet(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}`,
      token,
    );
    const v = vres.items?.[0];
    if (!v) throw new Error("Video not found on your channel");
    const secs = isoToSeconds(v.contentDetails?.duration || "");
    current = {
      videoId,
      title: v.snippet?.title || "",
      description: v.snippet?.description || "",
      tags: v.snippet?.tags || [],
      categoryId: String(v.snippet?.categoryId || ""),
      defaultLanguage: v.snippet?.defaultLanguage || v.snippet?.defaultAudioLanguage || "",
      durationSeconds: secs,
      isShort: secs > 0 && secs <= 180,
      views: Number(v.statistics?.viewCount || 0),
      publishedAt: v.snippet?.publishedAt || "",
    };

    // Never treat a missing field as "empty" without a second, independent read.
    if (!current.description.trim() || !current.tags.length) {
      try {
        const live: any = await getMyVideoMetaForUser(userId, videoId, accountId ? String(accountId) : null);
        if (live?.success && live.video) {
          if (!current.description.trim() && live.video.description) {
            current.description = String(live.video.description);
          }
          if (!current.tags.length && Array.isArray(live.video.tags) && live.video.tags.length) {
            current.tags = live.video.tags.map(String);
          }
        }
      } catch (_e) { /* best-effort */ }
    }
  }


  const currentHashtags = (current.description.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 20);
  const kind = current.isShort ? "Short (vertical, under 3 minutes)" : "long-form video";
  const extraBrief = String(body.brief || "").slice(0, 800);

  // Learn from what is already ranking/trending on YouTube for this exact topic.
  // The topic query mixes the creator brief with the real title so the research
  // matches the video's actual subject, not just its old (maybe bad) title.
  const researchTopic = [extraBrief, current.title].filter(Boolean).join(" ").trim() ||
    ctx.channelTitle;
  const research = body.skipResearch
    ? null
    : await researchTrendingSeo(token, researchTopic, {
      limit: 10,
      isShort: current.isShort,
      regionCode: "IN",
    }).catch(() => null);


  const researchBlock = research
    ? `
TRENDING RESEARCH — top YouTube videos ranking for this topic right now (learn the pattern, never copy text):
${research.videos
      .map(
        (v: any, i: number) =>
          `${i + 1}. "${v.title}" — ${v.channelTitle}, ${v.views.toLocaleString("en-IN")} views (${v.viewsPerDay}/day)
   tags: ${v.tags.join(", ") || "(none)"}
   hashtags: ${v.hashtags.join(" ") || "(none)"}
   description start: ${v.descriptionSnippet.slice(0, 220) || "(empty)"}`,
      )
      .join("\n")}
- Most used tags by these videos: ${research.topTags.map((t: any) => `${t.value} (${t.count})`).join(", ") || "(none)"}
- Most used hashtags: ${research.topHashtags.map((t: any) => `${t.value} (${t.count})`).join(", ") || "(none)"}
- Most used title keywords: ${research.topTitleKeywords.map((t: any) => `${t.value} (${t.count})`).join(", ") || "(none)"}
- Their average title length: ${research.avgTitleLength} chars, average description length: ${research.avgDescriptionLength} chars
Use these real search patterns to pick the keywords, tag set and hashtags — but only the ones that genuinely match THIS video's content. Never copy a competitor's sentences and never add an unrelated trending keyword.
`
    : "";

  const userPrompt = `Optimise metadata for this ${kind} on the channel "${ctx.channelTitle}"${ctx.channelHandle ? ` (${ctx.channelHandle})` : ""}.


CHANNEL
- Subscribers: ${ctx.subscriberCount}
- About: ${ctx.channelDescription.slice(0, 600) || "(empty)"}
- Channel keywords: ${ctx.channelKeywords || "(none)"}
- Channel topics: ${ctx.topics.join(", ") || "(unknown)"}
- Main category used by this channel: ${ctx.primaryCategoryId ? `${catTitle(ctx.primaryCategoryId)} (id ${ctx.primaryCategoryId})` : "(unknown)"}
- Recent video titles: ${ctx.recent.slice(0, 12).map((r) => r.title).join(" | ") || "(none)"}

CURRENT METADATA
- Title: ${current.title || "(empty)"}
- Description: ${current.description.slice(0, 1500) || "(empty)"}
- Tags: ${current.tags.join(", ") || "(none)"}
- Hashtags: ${currentHashtags.join(" ") || "(none)"}
- Category: ${current.categoryId ? `${catTitle(current.categoryId)} (id ${current.categoryId})` : "(not set)"}
- Duration: ${current.durationSeconds ? `${current.durationSeconds}s` : "(unknown)"}
${extraBrief ? `\nCREATOR BRIEF: ${extraBrief}` : ""}
${researchBlock}
ALLOWED CATEGORIES (id — title): ${ctx.categories.map((c: any) => `${c.id} — ${c.title}`).join("; ")}


Requirements:
1. Keep the real topic of the video. Do not invent a new subject.
2. Write only about what the current metadata / brief says is actually in the video. Do not force the channel name into every line — add it only where it reads naturally.
3. ${current.isShort ? "This is a SHORT: title 40-60 characters, description 2-3 short spoken-style lines (under ~500 characters), 6-12 tags, 3-5 hashtags (#shorts allowed as one of them)." : "This is a LONG-FORM video: title 50-70 characters, description 2-4 short paragraphs with a strong human hook in the first two lines, 8-15 tags, 3-5 hashtags (never #shorts)."}
3b. It must read like the creator typed it himself on his phone — natural spoken Hindi/Hinglish, one real personal detail, no template, no SEO tone, and fully within YouTube's spam/deceptive-metadata policy.
6. If a current field (title / description / tags / category) is already good, return it unchanged instead of rewriting it, and say so in "summary".
4. In "issues", list every concrete problem you found in the CURRENT metadata (limits, missing keyword, wrong category, missing channel name, spammy tags).
5. "score" = 0-100 quality of the CURRENT metadata.`;

  const goldBlock = await buildGoldExampleBlock(userId);
  const ai = await aiJson(SYSTEM_PROMPT + goldBlock, userPrompt);

  // Rule-based fallback keeps this action working even if the AI is unavailable.
  const fallbackKeyword = (current.title || extraBrief || ctx.channelTitle).slice(0, 60);
  const rawTitle = String(ai?.title || fallbackKeyword);

  const rawHashtags = Array.isArray(ai?.hashtags) ? ai.hashtags : currentHashtags;

  const rawDescription = String(
    ai?.description ||
      current.description ||
      extraBrief ||
      "",
  );

  const rawTags = Array.isArray(ai?.tags) && ai.tags.length
    ? ai.tags
    : [...current.tags, ...String(rawTitle).split(/[\s|,–-]+/).filter((w) => w.length > 3)];

  // Validator + sanitizer + field separation happen BEFORE anything is shown or
  // published, so internal AI text / labels / "--" / bad category can never leak.
  const built = buildYouTubePayload(
    {
      title: rawTitle,
      description: rawDescription,
      tags: rawTags,
      hashtags: rawHashtags,
      categoryId: ai?.categoryId,
    },
    {
      current: {
        title: current.title,
        description: current.description,
        tags: current.tags,
        categoryId: current.categoryId,
      },
      allowedCategories: ctx.categories,
      primaryCategoryId: ctx.primaryCategoryId,
    },
  );

  const suggestedTitle = built.payload.title;
  const hashtags = built.payload.hashtags;
  const description = built.payload.description;
  const tags = packTags(built.payload.tags);
  const aiCategoryId = built.payload.categoryId;
  const suggestionValid = built.ok && !!suggestedTitle && !!description && tags.length > 0;


  const categoryMismatch = !!current.categoryId && aiCategoryId !== current.categoryId;
  const channelCategoryMismatch =
    !!ctx.primaryCategoryId && !!current.categoryId && current.categoryId !== ctx.primaryCategoryId;

  // Deterministic checks on the CURRENT metadata — merged with the AI's findings.
  const checks: Array<{ level: "error" | "warn" | "ok"; message: string }> = [];
  const add = (level: "error" | "warn" | "ok", message: string) => checks.push({ level, message });

  if (!current.title) add("error", "Title is empty.");
  else if (current.title.length > YT_SEO_LIMITS.titleMax) add("error", `Title is ${current.title.length} characters — YouTube allows ${YT_SEO_LIMITS.titleMax}.`);
  else if (current.title.length > YT_SEO_LIMITS.titleIdeal) add("warn", `Title is ${current.title.length} characters — mobile search cuts around ${YT_SEO_LIMITS.titleIdeal}.`);
  else add("ok", `Title length is good (${current.title.length}/${YT_SEO_LIMITS.titleIdeal} ideal).`);

  if (current.description.length < YT_SEO_LIMITS.descriptionIdealMin) {
    add("warn", `Description is only ${current.description.length} characters — aim for ${YT_SEO_LIMITS.descriptionIdealMin}+.`);
  } else add("ok", `Description length is good (${current.description.length}/${YT_SEO_LIMITS.descriptionMax}).`);

  const currentTagChars = current.tags.join(",").length;
  if (!current.tags.length) add("error", "No tags set.");
  else {
    if (current.tags.length > YT_SEO_LIMITS.tagsMaxCount) add("error", `${current.tags.length} tags — YouTube allows ${YT_SEO_LIMITS.tagsMaxCount}.`);
    if (currentTagChars > YT_SEO_LIMITS.tagsTotalChars) add("error", `Tags total ${currentTagChars} characters — YouTube allows ${YT_SEO_LIMITS.tagsTotalChars}.`);
    if (current.tags.length < 6) add("warn", `Only ${current.tags.length} tags — 8-15 relevant tags work best.`);
  }

  if (currentHashtags.length > YT_SEO_LIMITS.hashtagsMax) {
    add("error", `${currentHashtags.length} hashtags — YouTube ignores all of them above ${YT_SEO_LIMITS.hashtagsMax}.`);
  } else if (currentHashtags.length > 5) {
    add("warn", `${currentHashtags.length} hashtags — only the first 3 are shown, keep 3-5.`);
  }

  if (!current.categoryId) add("error", "Category is not set.");
  if (channelCategoryMismatch) {
    add("warn", `Category is "${catTitle(current.categoryId)}" but your channel mostly publishes in "${catTitle(ctx.primaryCategoryId!)}" — mixed categories confuse recommendations.`);
  }
  if (categoryMismatch) {
    add("warn", `Suggested category "${catTitle(aiCategoryId)}" fits this content better than "${catTitle(current.categoryId)}".`);
  }
  if (!current.defaultLanguage) add("warn", "Video language is not set — set it so YouTube can index and caption correctly.");

  (Array.isArray(ai?.issues) ? ai.issues : []).slice(0, 8).forEach((i: unknown) => {
    const msg = String(i || "").trim();
    if (msg && !checks.some((c) => c.message.toLowerCase() === msg.toLowerCase())) add("warn", msg);
  });

  const errorCount = checks.filter((c) => c.level === "error").length;
  const warnCount = checks.filter((c) => c.level === "warn").length;
  const score = typeof ai?.score === "number"
    ? Math.max(0, Math.min(100, Math.round(ai.score)))
    : Math.max(0, 100 - errorCount * 20 - warnCount * 8);

  return {
    success: true,
    connected: true,
    canEdit,
    aiPowered: !!ai,
    kind: current.isShort ? "short" : "video",
    limits: YT_SEO_LIMITS,
    channel: {
      title: ctx.channelTitle,
      handle: ctx.channelHandle,
      url: ctx.channelUrl,
      subscriberCount: ctx.subscriberCount,
      primaryCategoryId: ctx.primaryCategoryId,
      primaryCategoryTitle: ctx.primaryCategoryId ? catTitle(ctx.primaryCategoryId) : null,
    },
    categories: ctx.categories,
    current: {
      ...current,
      hashtags: currentHashtags,
      categoryTitle: current.categoryId ? catTitle(current.categoryId) : null,
      tagChars: currentTagChars,
    },
    // ---- PUBLISHABLE payload only: these five fields go to YouTube as-is ----
    suggestion: {
      title: suggestedTitle,
      titleAlternatives: (Array.isArray(ai?.titleAlternatives) ? ai.titleAlternatives : [])
        .map((t: unknown) => sanitizeTitle(t))
        .filter(Boolean)
        .slice(0, 3),
      description,
      tags,
      tagChars: tags.join(",").length,
      hashtags,
      categoryId: aiCategoryId,
      categoryTitle: catTitle(aiCategoryId),
      valid: suggestionValid,
    },
    // ---- INTERNAL only: never publish any of this to YouTube ----
    internal: {
      categoryReason: String(ai?.categoryReason || (channelCategoryMismatch
        ? `Matches your channel's main category "${catTitle(ctx.primaryCategoryId!)}".`
        : "Matches the video content.")),
      keywords: (Array.isArray(ai?.keywords) ? ai.keywords : []).map((k: unknown) => String(k)).slice(0, 12),
      summary: String(ai?.summary || "Metadata rebuilt inside YouTube's recommended limits."),
      removedTags: built.removed,
      validationErrors: built.errors,
      categoryCorrected: built.categoryCorrected,
    },
    checks,
    score,
    categoryMismatch,
    channelCategoryMismatch,
    research,

  };
}
