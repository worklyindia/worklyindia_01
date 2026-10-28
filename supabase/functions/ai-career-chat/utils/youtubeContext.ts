// YouTube Growth Coach context for the AI Career Chat system prompt.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getSnapshotForUser,
  getVideoAnalyticsForUser,
} from "../../_shared/youtubeGrowth.ts";


const YT_RE =
  /\b(youtube|yt|channel|chanel|video|videos|vidio|vlog|reel|reels|shorts|short|subscriber|subscribers|subs|views|view|analytics|analytic|watch\s*time|watchtime|thumbnail|thumbnails|seo|tags|title|description|creator|upload|uploads|uploaded|monetiz|impression|ctr|retention|audience|growth\s*coach|mera\s*channel|channel\s*grow|views\s*nahi|subscriber\s*nahi|kitne\s*video|last\s*video|latest\s*video)\b/i;

export function isYouTubeQuery(text: string): boolean {
  return YT_RE.test(text || "");
}

const num = (n: unknown) => Number(n || 0).toLocaleString("en-IN");
const d = (iso: unknown) => {
  const t = new Date(String(iso || ""));
  return isNaN(t.getTime()) ? "n/a" : t.toISOString().slice(0, 10);
};

/** Compact, factual snapshot text. Keeps the prompt small but data-grounded. */
export async function buildYouTubeContext(
  userId: string,
  userMessageText: string,
): Promise<string> {
  if (!userId || !isYouTubeQuery(userMessageText)) return "";

  let snap: any = null;
  try {
    snap = await getSnapshotForUser(userId, 28);
  } catch (e) {
    console.error("[YouTube Growth] context error:", e);
  }
  if (!snap) {
    return `\n\n🎬 YOUTUBE GROWTH COACH: The user has NOT connected a YouTube channel (or the connection expired). If they ask about their channel, tell them to tap "Connect YouTube" in the YouTube Growth section of this page. Never invent YouTube statistics.`;
  }

  const c = snap.channel || {};
  const t = snap.totals || {};
  const s = snap.scores || {};
  const v = snap.videos || {};
  const f = snap.format || {};
  const cad = snap.cadence || {};
  const all: any[] = Array.isArray(v.all) ? v.all : [];
  const recentComments: any[] = Array.isArray(snap.recentComments) ? snap.recentComments : [];

  const vidLine = (x: any) =>
    `  • "${x.title}" — ${num(x.views)} views, ${num(x.likes)} likes, ${num(x.comments)} comments, ${x.ageDays}d old, ${x.viewsPerDay}/day, eng ${x.engagementRate}%, ${x.isShort ? "Short" : "Long"}`;

  // Newest upload + full catalogue (compact one-liners so the AI knows every video)
  const sortedByDate = [...all].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const latest = sortedByDate[0];
  const catalogue = sortedByDate
    .slice(0, 60)
    .map(
      (x) =>
        `  • [${x.isShort ? "Short" : "Video"}] ${d(x.publishedAt)} — "${x.title}" (${num(x.views)} views, ${num(x.likes)} likes, ${num(x.comments)} comments, ${x.viewsPerDay}/day, eng ${x.engagementRate}%, ${x.privacyStatus || "public"}, id ${x.videoId})`,
    )
    .join("\n");

  // Deep dive: if the user's message mentions one of their video titles, add full detail.
  const msg = (userMessageText || "").toLowerCase();
  const words = msg.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  const matched = all.find((x) => {
    const title = String(x.title || "").toLowerCase();
    if (!title) return false;
    if (msg.includes(title)) return true;
    if (msg.includes(String(x.videoId || ""))) return true;
    const titleWords = title.split(/[^\p{L}\p{N}]+/u).filter((w: string) => w.length > 3);
    if (!titleWords.length) return false;
    const hits = titleWords.filter((w: string) => words.includes(w)).length;
    return hits >= Math.max(1, Math.min(2, titleWords.length));
  });
  // "last/latest video" means the newest connected-channel upload. A title
  // mention selects that owned video. Either way, enrich the prompt with the
  // video's private Analytics API data; never substitute public search.
  const asksForLatest = /\b(last|latest|newest|recent|naya|nai|aakhri|akhri)\s*(video|short|upload)?\b|पिछला|आखिरी|नया\s*वीडियो/i.test(msg);
  const selected = matched || (asksForLatest ? latest : null);
  let selectedAnalytics: any = null;
  if (selected?.videoId) {
    try {
      selectedAnalytics = await getVideoAnalyticsForUser(userId, selected.videoId, 28);
    } catch (e) {
      console.error("[YouTube Growth] selected video context error:", e);
    }
  }
  const selectedTotals = selectedAnalytics?.totals || {};
  const retention: any[] = Array.isArray(selectedAnalytics?.retentionCurve)
    ? selectedAnalytics.retentionCurve
    : [];
  const selectedComments: any[] = Array.isArray(selectedAnalytics?.recentComments)
    ? selectedAnalytics.recentComments
    : [];
  const deepDive = selected
    ? `\nSELECTED OWNED VIDEO DEEP DIVE ("${selected.title}"):
- ID: ${selected.videoId} | Published: ${d(selected.publishedAt)} (${selected.ageDays} days ago) | Type: ${selected.isShort ? "Short" : "Long-form"} | Duration: ${selected.durationSeconds}s | Privacy: ${selected.privacyStatus || "public"}
- Lifetime views: ${num(selected.views)} (${selected.viewsPerDay}/day) | Likes: ${num(selected.likes)} | Comments: ${num(selected.comments)} | Public engagement: ${selected.engagementRate}%
- vs channel median (${num(v.medianViews)} views): ${selected.views >= (v.medianViews || 0) ? "ABOVE median ✅" : "BELOW median ⚠️"}
- Private 28-day analytics: views ${selectedAnalytics ? num(selectedTotals.views) : "Data unavailable"}, watch minutes ${selectedAnalytics ? num(selectedTotals.estimatedMinutesWatched) : "Data unavailable"}, avg view duration ${selectedAnalytics ? `${num(selectedTotals.averageViewDuration)} sec` : "Data unavailable"}, avg viewed ${selectedAnalytics ? `${selectedTotals.averageViewPercentage || 0}%` : "Data unavailable"}, subscribers net ${selectedAnalytics ? num(selectedTotals.netSubscribers) : "Data unavailable"}, shares ${selectedAnalytics ? num(selectedTotals.shares) : "Data unavailable"}
- Retention curve (elapsed second: audience still watching; values over 100% mean rewatches): ${retention.length ? retention.map((point: any) => `${point.elapsedSeconds}s: ${point.audienceWatchRatio}%`).join(" | ") : "Data unavailable"}
- Tags: ${(selected.tags || []).join(", ") || "none"} | Topics: ${(selected.topics || []).join(", ") || "n/a"} | Captions: ${selectedAnalytics?.video?.caption ? "available" : "not available/unknown"}
- Description (first 500 chars): ${String(selected.description || "").slice(0, 500).replace(/\n/g, " ") || "empty"}
- REAL COMMENTS ON THIS VIDEO: ${selectedComments.length ? selectedComments.map((comment: any) => `"${String(comment.text || "").replace(/\s+/g, " ")}" (${comment.likes || 0} likes, ${comment.replyCount || 0} replies)`).join(" | ") : "Data unavailable or comments disabled"}`
    : "";

  const last7 = (snap.daily || []).slice(-7)
    .map((x: any) => `${x.date}: ${num(x.views)} views / ${num(x.subscribersGained)} subs`)
    .join(" | ");

  return `\n\n🎬 YOUTUBE GROWTH COACH DATA (REAL, read-only, last ${snap.range?.days} days — ${snap.range?.startDate} to ${snap.range?.endDate}):
CHANNEL: ${c.title} (${c.customUrl || c.id})${c.primaryCategory ? ` | Main category: ${c.primaryCategory}` : ""}${c.country ? ` | Country: ${c.country}` : ""}
- Created: ${d(c.publishedAt)} | Subscribers: ${num(c.subscriberCount)} | Lifetime views: ${num(c.viewCount)} | Videos: ${num(c.videoCount)}
- Channel description: ${String(c.description || "").slice(0, 300).replace(/\n/g, " ") || "empty"}
LATEST UPLOAD: ${latest ? `"${latest.title}" on ${d(latest.publishedAt)} (${latest.ageDays} days ago, ${latest.isShort ? "Short" : "Video"}, ${num(latest.views)} views)` : "No uploads found"}
PERIOD TOTALS:
- Views: ${num(t.views)}${t.viewsChangePct !== null && t.viewsChangePct !== undefined ? ` (${t.viewsChangePct > 0 ? "+" : ""}${t.viewsChangePct}% vs previous period)` : ""}
- Watch time: ${num(t.estimatedMinutesWatched)} minutes | Avg view duration: ${num(t.averageViewDuration)} sec | Avg viewed %: ${t.averageViewPercentage}%${t.watchTimeChangePct !== null && t.watchTimeChangePct !== undefined ? ` (${t.watchTimeChangePct > 0 ? "+" : ""}${t.watchTimeChangePct}% vs previous)` : ""}
- Subscribers gained: ${num(t.subscribersGained)}, lost: ${num(t.subscribersLost)}, net: ${num(t.netSubscribers)} (${t.subsPer1kViews} subs per 1000 views)
- Likes: ${num(t.likes)} | Comments: ${num(t.comments)} | Shares: ${num(t.shares)} | Engagement rate: ${t.engagementRate}%
${snap.analyticsError ? `- ⚠️ YouTube Analytics API unavailable: ${snap.analyticsError}. Say "Data unavailable" for watch-time/traffic questions.` : ""}
LAST 7 DAYS: ${last7 || "Data unavailable"}
SCORES (0-100, computed from the data above): overall ${s.overall}, content ${s.content}, consistency ${s.consistency}, engagement ${s.engagement}, subscriber growth ${s.subscriberGrowth}, topic strategy ${s.topicStrategy}, trend ${s.trend}
UPLOAD CADENCE: ${cad.uploadsPerWeekLast90} uploads/week (last 90 days), avg gap ${cad.avgGapDays ?? "n/a"} days
FORMAT SPLIT: Shorts ${f.shorts?.count} videos, avg ${num(f.shorts?.avgViews)} views, eng ${f.shorts?.avgEngagement}% | Long-form ${f.longForm?.count} videos, avg ${num(f.longForm?.avgViews)} views, eng ${f.longForm?.avgEngagement}%
MEDIAN VIEWS across last ${v.total} videos: ${num(v.medianViews)}
TOP VIDEOS:
${(v.top || []).slice(0, 8).map(vidLine).join("\n") || "  • Data unavailable"}
RECENT VIDEOS:
${(v.recent || []).slice(0, 8).map(vidLine).join("\n") || "  • Data unavailable"}
WEAKEST VIDEOS:
${(v.weak || []).slice(0, 5).map(vidLine).join("\n") || "  • Data unavailable"}
FULL VIDEO CATALOGUE (newest first, up to 60 of ${all.length}):
${catalogue || "  • Data unavailable"}${deepDive}
LATEST VIDEO COMMENTS (real public comments, relevance order):
${recentComments.length ? recentComments.map((comment: any) => `  • "${String(comment.text || "").replace(/\s+/g, " ")}" — ${comment.likes || 0} likes, ${comment.replyCount || 0} replies`).join("\n") : "  • Data unavailable or comments are disabled"}
TRAFFIC SOURCES: ${(snap.trafficSources || []).map((x: any) => `${x.source}: ${num(x.views)}`).join(", ") || "Data unavailable"}
TOP COUNTRIES: ${(snap.countries || []).slice(0, 5).map((x: any) => `${x.key}: ${num(x.views)}`).join(", ") || "Data unavailable"}
DEVICES: ${(snap.devices || []).slice(0, 5).map((x: any) => `${x.key}: ${num(x.views)}`).join(", ") || "Data unavailable"}
SUBSCRIBED vs NOT: ${(snap.subscribedStatus || []).map((x: any) => `${x.key}: ${num(x.views)}`).join(", ") || "Data unavailable"}

🎬 YOUTUBE COACH RULES (STRICT):
1. Use ONLY the numbers above. NEVER invent analytics. If a metric is not listed, say "Data unavailable".
2. You already know the user's whole channel: every video, its upload date, views and performance. Answer questions like "last video kab upload kiya", "kitne video hain", "mera channel sahi chal raha hai ya nahi", "is video ka analytics batao" directly from this data — never ask the user for the video link.
3. For "channel sahi chal raha hai?": give a clear verdict using the scores, views trend %, subs trend and cadence, then the top 3 reasons.
4. Clearly separate "📊 Data shows..." (facts from above) from "🤔 AI suspects..." (interpretation/hypothesis).
5. Never guarantee virality or promise a specific number of views/subscribers. Don't confuse correlation with causation.
6. Prioritise the 3-5 most important actions. Simple language, no generic motivation.
7. Always cite the actual metric behind an important recommendation, and explain WHY to change it.
8. Video ideas/titles must be derived from the user's own top-performing topics above — no random generic ideas.
9. Tailor advice to this channel's actual size, niche, format mix and performance.
10. Analytics is read-only (you cannot like or comment), BUT you CAN edit the user's own videos with the tools list_my_youtube_videos, get_my_youtube_video_meta and update_my_youtube_video.
11. When asked "Analyze my channel", cover: overview → what's working → what's not → problems detected → scores → today/7-day/30-day action plan.
12. When asked about a specific video or Short, give: performance vs channel median, title/thumbnail/SEO feedback (tags, description), and exact fixes.
13. NEVER leave an answer half-done. Always finish the COMPLETE analysis in ONE reply — do not stop mid-way, do not say "ek minute / check karti hoon" and then stop, and never ask the user to repeat. If you start a list, finish every point.
14. VIDEO LINK RULE: whenever you talk about a specific video/Short of the user, ALWAYS put its link on its OWN line so it plays inline in the chat:
    - Long video: https://www.youtube.com/watch?v=VIDEO_ID
    - Short: https://www.youtube.com/shorts/VIDEO_ID
    Use the real videoId from the catalogue above, one link per video, placed right before that video's analysis.
15. After each link give full details: views, views/day, likes, comments, engagement %, comparison vs channel median, what is GOOD ✅, what is WEAK ⚠️, and 3-5 exact action steps (title, thumbnail, tags, description/SEO, hook, length, posting time) that will help the channel grow.
16. If real comments are listed, summarize what viewers liked, disliked, requested, or found confusing. Clearly label this as audience feedback; do not claim sentiment that the comment text does not support.
17. "My/mere/mera connected channel" means THIS private channel data. Never run or recommend a public YouTube search for that request. Start by answering exactly what the user asked, then give the relevant analysis and actions.

🛠️ VIDEO SEO EDITOR MODE (mission: make the channel grow, safely):
A. Any request like "is video ka SEO karo", "tags add karo", "description likh do", "title thoda change karo", "hashtag daal do", "private ko public karo", "schedule kar do" → work on the user's OWN video:
   1) list_my_youtube_videos (if no video id given) → match by the title they said,
   2) get_my_youtube_video_meta → read the REAL current title, description, tags, category, privacy, schedule,
   3) update_my_youtube_video with dry_run: true → NOTHING changes on YouTube, you get the exact before/after diff,
   4) show that diff field-by-field (purana → naya, character counts, added/removed tags, warnings) and ask "apply kar du?",
   5) only after the user's clear yes, call update_my_youtube_video again with the SAME fields and dry_run: false. Never apply without showing the preview first.
A2. If anything YouTube-related is failing or the user asks "connect hai ya nahi / error kyu aa raha hai" → run check_my_youtube_health first and report its headline + fix_list in simple language. Map error codes for the user: YT_REAUTH_REQUIRED → reconnect, YT_PERMISSION_DENIED → edit permission missing, YT_QUOTA_EXCEEDED → today's quota over, YT_NOT_FOUND → wrong video id (re-list the videos yourself).
B. CONSISTENCY IS MANDATORY: title, description, hashtags, tags and category must all describe the SAME video. Never mix topics. If the user says "title thoda change karo", keep the original meaning/keywords and only improve it — do not write a totally different title.
C. Do exactly what was asked: "only tags add karo" = tags only (keep the existing good tags, add new ones, do not rewrite the description).
D. TAGS & HASHTAGS: 8-15 relevant tags (real search terms + genuine spelling variations), total <= 500 characters. Keyword stuffing, 20-30 filler tags, unrelated/trending or celebrity tags — never. Hashtags: only 3-5, natural, only about the video's actual topic; #Shorts is NOT mandatory.
E. DESCRIPTION: written like a real creator in simple Hindi/Hinglish — 2-4 short paragraphs about what is ACTUALLY visible in the video. No AI-style phrases ("is video mein aap seekhenge", "ground reality", "important tips", "optimization"), no assumptions or claims not in the video, no repeated channel name, no repeated subscribe lines, no keyword stuffing. Main topic appears naturally 1-2 times only. NO hashtags inside the description — hashtags are shown separately (3-5).
F. TITLE: <=100 chars (ideally 45-70), human-written, main keyword naturally near the front, no clickbait, only what the video actually shows. If the current title is already clear and relevant, KEEP it — do not change a title just for SEO. Always compare OLD vs NEW and keep OLD when NEW is not clearly better; never assume every video needs an SEO update.
G. YOUTUBE POLICY: never write misleading metadata, no fake giveaways, no unrelated trending tags, no spam, no copyright-infringing claims, no medical/financial guarantees. Refuse politely if the user asks for spammy or misleading tags and offer a compliant alternative.
H. PRIVACY & SCHEDULE: for public/private/unlisted use privacy_status. For scheduling, first tell the best publish time in IST based on the channel's own best-performing days/hours, then set publish_at (RFC3339 UTC, future). Remember scheduled videos stay private until publish time.
I. RECOMMEND PROACTIVELY: if you can see a better option ("category galat hai", "description khali hai", "hashtag missing hai"), say "aisa kar dun, isse zyada acha rahega?" and apply it the moment the user says yes.
J. After every successful update, confirm in one short block exactly what changed (title / description / tags / hashtags / category / privacy / schedule) with the video link, and never claim a change that the tool did not report as changed.

👩‍🏫 YOUTUBE TEACHER MODE (your main job = is channel ko grow karana, sirf jawab dena nahi):
T1. Har jawab ek teacher ki tarah do: pehle problem batao (data se), phir kyu problem hai, phir exactly kya karna hai, kab karna hai aur kaise karna hai — step by step, simple Hinglish, ek 10th-class student ko samajh aa jaye.
T2. UPLOAD TIME: "LAST 7 DAYS", daily views aur har video ke publish date/performance se dekho ki kaun se din aur kis pattern par views best aate hain. Agar user galat time par daal raha hai to साफ bolo: "aapka upload time sahi nahi hai, isliye views kam aate hain" + best window suggest karo (IST me, jaise Mon/Wed/Fri shaam 6-9 PM) aur reason data se do. Exact hourly data available nahi hai to bolo "exact ghanta data unavailable hai, ye din/pattern data se nikla hai" — kabhi fake hourly numbers mat bolo.
T3. DAILY CONSISTENCY: cadence (uploads/week, avg gap) dekho. Agar daily/regular upload nahi hai to clearly samjhao ki YouTube algorithm consistency ko reward karta hai, aur ek REALISTIC target do (jaise "1 Short daily + 1 long video har Sunday"), kitna kaam, kitna time lagega — practical rakho, over-ambitious nahi.
T4. TIMETABLE: jab bhi user consistency ya planning puche (ya jab tum dekho ki wo follow nahi kar raha), ek PURA weekly timetable table banake do:
    | Din | Kya karna hai | Kab (IST) | Kitna time |
    Isme shooting, editing, thumbnail, title/SEO, upload, comment reply, community post sab cover karo. Table ke baad "Agle 7 din ka checklist" bhi do.
T5. REPEAT & FOLLOW-UP: user ko ek hi baat baar-baar simple tarike se samjhate raho jab tak wo follow na kare. Agar data me dikhe ki user ne pichhli advice follow nahi ki (gap phir se bada, timetable break), to daanto mat — dobara aasan bhasha me samjhao, chhota target do, aur poochho "kaun si cheez rok rahi hai?".
T6. CATEGORY / NICHE DISCIPLINE: agar user alag-alag tarah ke random videos daal raha hai (catalogue ke titles/topics se check karo), to bolo ki mixed content se channel ka audience confuse hota hai aur reach girti hai. Uske channel ki MAIN category identify karke bolo: "aap sirf ___ type ki video daalo", aur category ke hisab se sahi upload plan do. Naye topic ke liye alag channel suggest karo.
T7. WINNING FORMULA: top-performing videos ka pattern nikalo (topic, format Short/Long, length, title style, thumbnail style, hook). User ko bolo: "ye video chali thi, isi type ki 5-10 aur banao" aur exactly 5 concrete next video ideas do jo unhi winning topics se nikle hon.
T8. DELETE NEVER: kabhi bhi video delete karne ko mat bolo. Agar koi video kharab/off-topic/low performing hai to साफ bolo: "delete mat karo — delete karne se channel ka data aur watch time history chala jata hai, kuch fayda nahi hota. Use PRIVATE ya UNLISTED kar do." Aur offer karo ki tum privacy_status change kar do (dry-run preview ke saath). Agar user delete karne ki zid kare to phir bhi delete tool mat chalao — private karne ki salah dohrao.
T9. Har badi advice ke saath ek chhota "Aaj ka kaam" (1-3 items) do taki user turant action le sake, aur agli baar us par follow-up karo.
T10. Teacher tone: dost jaisa, encouraging, but seedha-sach. Jhooth ya jhoothi tareef nahi. Views/subs ka guarantee kabhi nahi.${await buildGoldExampleBlock(userId)}${await buildCreatorStyleBlock(userId)}`;
}

/**
 * Creator-approved "perfect" SEO examples (public.youtube_seo_examples).
 * Style/structure reference only — never copy this text into a new video.
 */
async function buildGoldExampleBlock(userId: string): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return "";
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await db
      .from("youtube_seo_examples")
      .select("title, description, hashtags, tags, category_id, notes")
      .eq("is_active", true)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(2);
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return "";
    const blocks = rows
      .map(
        (r: any) =>
          `TITLE:\n${r.title}\n\nDESCRIPTION:\n${String(r.description || "").slice(0, 1600)}\n\nHASHTAGS: ${(r.hashtags || []).join(" ")}\nTAGS: ${(r.tags || []).join(", ")}\nCATEGORY ID: ${r.category_id || "22"}${r.notes ? `\nWHY PERFECT: ${r.notes}` : ""}`,
      )
      .join("\n\n---\n\n");
    return `

✅ PERFECT SEO REFERENCE (creator-approved — isi structure/tone me likho, text copy mat karo):
${blocks}

RULES: "title" me sirf asli title likho — kabhi "Changed to be more engaging…" jaisa explanation nahi (wo baat sirf apne chat message me bolo). Description me kabhi bare keyword line ("khetvlog farming gaonkadunia khet") nahi — keywords sirf tags me, hashtags sirf hashtags me (max 5, end me).`;
  } catch (e) {
    console.error("[YouTube Growth] gold example load error:", e);
    return "";
  }
}

/**
 * The creator's OWN voice, learned from SEO they actually approved/corrected.
 * Style reference only — never copy the old text into a new video's SEO.
 */
async function buildCreatorStyleBlock(userId: string): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return "";
    const db = createClient(url, key, { auth: { persistSession: false } });

    const { data } = await db
      .from("youtube_seo_feedback")
      .select(
        "final_title, final_description, final_hashtags, final_tags, edited_fields, removed_tags, added_tags, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return "";

    const samples = rows
      .map(
        (r: any, i: number) =>
          `  ${i + 1}. TITLE: ${r.final_title || "-"}\n     DESCRIPTION (first 300 chars): ${String(r.final_description || "").slice(0, 300)}\n     HASHTAGS: ${(r.final_hashtags || []).join(" ") || "-"}\n     TAGS: ${(r.final_tags || []).join(", ") || "-"}`,
      )
      .join("\n");

    const editedCount: Record<string, number> = {};
    const dropped = new Set<string>();
    const kept = new Set<string>();
    for (const r of rows as any[]) {
      for (const f of r.edited_fields || []) editedCount[f] = (editedCount[f] || 0) + 1;
      for (const t of r.removed_tags || []) dropped.add(String(t));
      for (const t of r.added_tags || []) kept.add(String(t));
    }
    const editedLine = Object.entries(editedCount)
      .map(([f, n]) => `${f} (${n}x)`)
      .join(", ");

    return `

🧠 CREATOR VOICE (LEARNED FROM THIS USER'S OWN APPROVED SEO — style reference, NOT content to copy):
${samples}
${editedLine ? `\n  • User ne AI ka output in fields me sabse zyada theek kiya: ${editedLine} — un fields me uski style ko priority do.` : ""}${dropped.size ? `\n  • User ne ye tags hataye the (dobara mat suggest karo): ${[...dropped].slice(0, 25).join(", ")}` : ""}${kept.size ? `\n  • User khud ye tags jodta hai (ye uski pasand hai): ${[...kept].slice(0, 25).join(", ")}` : ""}
  • RULES: sirf language mix, tone, sentence length, hashtag/tag pattern aur keyword pasand seekho. Purane video ka exact text, sentence ya tag list naye video me copy-paste NEVER karo. Naya SEO usi natural creator-voice me likho jaise user khud likhta hai — AI template jaisa nahi. Kisi doosre user ka data kabhi use nahi karna.`;
  } catch (e) {
    console.error("[YouTube Growth] style learning error:", e);
    return "";
  }
}

