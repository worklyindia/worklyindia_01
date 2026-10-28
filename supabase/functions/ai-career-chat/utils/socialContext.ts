// X (Twitter) + LinkedIn context for the AI Career Chat system prompt.
// Gives the AI the connected account's A-Z data so it can answer with facts
// instead of guessing.
import { admin, getSocialSnapshot } from "../../_shared/socialAutoReply.ts";

const SOCIAL_RE =
  /\b(linkedin|linked\s*in|twitter|tweet|tweets|x\s*post|x\s*account|my\s*x|post|posts|posting|impressions|followers|follower|engagement|profile|network|connection|connections|reply|replies|comment|comments|auto\s*reply|autoreply|social|handle|mention|mentions|viral|trending|content\s*idea|caption|hashtag|hashtags)\b/i;

export function isSocialQuery(text: string): boolean {
  return SOCIAL_RE.test(text || "");
}

const num = (n: unknown) => Number(n || 0).toLocaleString("en-IN");
const day = (iso: unknown) => {
  const t = new Date(String(iso || ""));
  return isNaN(t.getTime()) ? "n/a" : t.toISOString().slice(0, 10);
};

function renderSnapshot(platform: string, snap: any): string {
  const a = snap?.account || {};
  const t = snap?.totals || {};
  const posts: any[] = Array.isArray(snap?.posts) ? snap.posts : [];
  const label = platform === "x" ? "X (Twitter)" : "LinkedIn";

  const postLines = posts
    .slice(0, 30)
    .map((p) => {
      const stats =
        platform === "x"
          ? `${num(p.likes)} likes, ${num(p.replies)} replies, ${num(p.reposts)} reposts, ${num(p.impressions)} impressions`
          : `${p.visibility || "public"}, ${p.lifecycleState || "published"}`;
      return `  • ${day(p.createdAt)} — "${String(p.text || "").slice(0, 140).replace(/\n/g, " ")}" (${stats}) ${p.url || ""}`;
    })
    .join("\n");

  const totalsLine = Object.entries(t)
    .map(([k, v]) => `${k}: ${num(v)}`)
    .join(" | ");

  return `

🔗 ${label.toUpperCase()} ACCOUNT (connected, live data — use these real numbers, never invent):
- Name: ${a.name || "n/a"} | Handle: ${a.handle || "n/a"} | ID: ${a.id || "n/a"}
- Followers: ${num(a.followers)} | Following: ${num(a.following)} | Total posts: ${num(a.tweetCount || t.postsAnalyzed)}
- Bio: ${String(a.bio || "").slice(0, 200) || "n/a"} | Location: ${a.location || "n/a"} | Joined: ${day(a.createdAt)}
- Aggregate (last ${posts.length} posts): ${totalsLine || "n/a"}
RECENT POSTS:
${postLines || "  • (no post data available)"}${snap?.note ? `\nNOTE: ${snap.note}` : ""}${snap?.error ? `\nDATA WARNING: ${snap.error}` : ""}`;
}

/**
 * Builds a compact but complete X + LinkedIn context block for the given user.
 * Uses the live API snapshot and falls back to the last stored snapshot
 * (`social_connections.profile_data`) if the API call fails.
 */
export async function buildSocialContext(
  userId: string,
  userMessageText: string,
): Promise<string> {
  if (!userId) return "";
  // Live API hit only when the user is actually asking about social; otherwise
  // we still give the AI the last stored data so it always knows the account.
  const live = isSocialQuery(userMessageText);

  let rows: any[] = [];
  try {
    const { data } = await admin()
      .from("social_connections")
      .select("platform, account_name, account_handle, followers_count, profile_data, last_synced_at")
      .eq("user_id", userId);
    rows = data || [];
  } catch (e) {
    console.error("[social context] load error:", e);
  }

  if (!rows.length) {
    if (!live) return "";
    return `\n\n🔗 SOCIAL ACCOUNTS: The user has NOT connected X (Twitter) or LinkedIn. If they ask about their posts, followers or auto-reply, tell them to open the AI Connect page and connect the account. Never invent social statistics.`;
  }

  let out = "";
  for (const row of rows) {
    const platform = String(row.platform);
    if (platform !== "x" && platform !== "linkedin") continue;
    let snap: any = null;
    if (live) {
      try {
        snap = await getSocialSnapshot(userId, platform as "x" | "linkedin");
      } catch (e) {
        console.error(`[social context] ${platform} snapshot failed`, e);
      }
    }
    if (!snap || snap.connected === false) {
      snap = {
        account: {
          name: row.account_name,
          handle: row.account_handle,
          followers: row.followers_count,
          ...(row.profile_data?.account || {}),
        },
        totals: row.profile_data?.totals || {},
        posts: row.profile_data?.posts || [],
        note: `Live API unavailable — data from last sync (${day(row.last_synced_at)}).`,
      };
    }
    out += renderSnapshot(platform, snap);
  }

  return out;
}
