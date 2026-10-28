// AI-powered Telegram Channel Growth Agent
// Modes:
//   plan     -> AI generates the day's 10-post content plan
//   dispatch -> finds due slots, generates caption (+ image), posts to channel

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { CANONICAL_DOMAIN } from '../_shared/domain.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3-flash-preview";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

interface BotSettings {
  channel_chat_id: string | number;
  channel_username: string | null;
  channel_enabled: boolean;
  growth_agent_enabled: boolean;
  growth_daily_target: number;
  growth_timezone: string;
  growth_website_base_url: string;
}

function todayInTz(tz: string): string {
  // YYYY-MM-DD in given timezone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function hourInTz(tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(new Date()), 10);
}

async function callAI(body: Record<string, unknown>): Promise<any> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  return await resp.json();
}

async function getSettings(supa: any): Promise<BotSettings> {
  const { data, error } = await supa
    .from("telegram_bot_settings")
    .select(
      "channel_chat_id, channel_username, channel_enabled, growth_agent_enabled, growth_daily_target, growth_timezone, growth_website_base_url"
    )
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No active telegram_bot_settings row");
  return data as BotSettings;
}

async function fetchContext(supa: any) {
  const { data: jobs } = await supa
    .from("jobs")
    .select(
      "id, title, category, location, salary_min, salary_max, public_slug, short_id, is_featured, trending_score"
    )
    .eq("status", "active")
    .order("trending_score", { ascending: false, nullsFirst: false })
    .limit(15);

  const { data: festivals } = await supa
    .from("festivals")
    .select("name, date, type")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .limit(3);

  return { jobs: jobs ?? [], festivals: festivals ?? [] };
}

// ---------- PLAN MODE ----------
async function runPlan(supa: any, settings: BotSettings, force = false) {
  const today = todayInTz(settings.growth_timezone);
  const target = settings.growth_daily_target;

  // Already planned?
  const { count } = await supa
    .from("telegram_channel_growth_plan")
    .select("id", { count: "exact", head: true })
    .eq("plan_date", today);

  if ((count ?? 0) >= target && !force) {
    return { skipped: true, reason: "already planned", date: today, count };
  }

  if (force && (count ?? 0) > 0) {
    await supa
      .from("telegram_channel_growth_plan")
      .delete()
      .eq("plan_date", today)
      .eq("status", "pending");
  }

  const ctx = await fetchContext(supa);

  const systemPrompt = `You are the Telegram channel growth strategist for "Workly India" (${CANONICAL_DOMAIN}),
a work-from-home jobs platform for Indian audiences.
Goal: maximise channel subscriber growth AND drive clicks back to the website.
Audience: 18-35 year old Indians, Tier 2/3 cities, mix of students, freshers, homemakers, side-hustlers.
Tone: friendly, action-oriented, mobile-first. Use 1-2 emojis max per post.
Every post must include a clear CTA back to the website.`;

  const userPrompt = `Plan exactly ${target} Telegram channel posts for ${today} (timezone ${settings.growth_timezone}).

Rules:
- Distribute slot_hour between 8 and 23 (no two posts in the same hour, sorted ascending).
- Mix content_type across: job_alert, motivational_tip, company_spotlight, wfh_hack, success_story, poll_idea, blog_teaser, festival_wish, skill_of_the_day, cta_subscribe.
- Mix language: 4 hinglish, 3 hi (Hindi in Devanagari), 3 en. (Adjust counts proportionally if target != 10.)
- Exactly 4 posts must have with_image = true (visual variety: job-card style, motivational quote card, infographic, festival graphic).
- Topics must reference real items from the context below where possible.

Context (today's site data):
TOP_JOBS:
${JSON.stringify(ctx.jobs.slice(0, 10), null, 0)}

UPCOMING_FESTIVALS:
${JSON.stringify(ctx.festivals, null, 0)}

Return ONLY via the plan_posts tool.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "plan_posts",
        description: "Return the day's planned posts.",
        parameters: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              minItems: target,
              maxItems: target,
              items: {
                type: "object",
                properties: {
                  slot_hour: { type: "integer", minimum: 8, maximum: 23 },
                  content_type: { type: "string" },
                  language: { type: "string", enum: ["hi", "en", "hinglish"] },
                  with_image: { type: "boolean" },
                  topic: { type: "string", description: "1-2 line brief: what this post is about" },
                  cta_url_path: {
                    type: "string",
                    description: `Path on ${CANONICAL_DOMAIN} (e.g. /jobs/<slug> or /jobs)`,
                  },
                },
                required: ["slot_hour", "content_type", "language", "with_image", "topic", "cta_url_path"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    },
  ];

  const aiResp = await callAI({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "plan_posts" } },
  });

  const tc = aiResp.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("AI did not return tool call");
  const args = JSON.parse(tc.function.arguments);
  const posts: any[] = args.posts ?? [];

  // De-dupe slot_hour, distribute if collisions
  const usedHours = new Set<number>();
  const rows = posts.map((p, i) => {
    let h = Number(p.slot_hour);
    while (usedHours.has(h) && h < 23) h++;
    while (usedHours.has(h) && h > 8) h--;
    usedHours.add(h);
    const path = String(p.cta_url_path || "/").startsWith("/")
      ? p.cta_url_path
      : "/" + p.cta_url_path;
    const ctaUrl = `${settings.growth_website_base_url}${path}?utm_source=telegram&utm_medium=channel&utm_campaign=growth_agent`;
    return {
      plan_date: today,
      slot_hour: h,
      content_type: String(p.content_type).slice(0, 60),
      language: p.language,
      with_image: !!p.with_image,
      topic: String(p.topic).slice(0, 500),
      cta_url: ctaUrl,
      status: "pending",
    };
  });

  const { error } = await supa
    .from("telegram_channel_growth_plan")
    .upsert(rows, { onConflict: "plan_date,slot_hour" });
  if (error) throw error;

  return { ok: true, date: today, planned: rows.length };
}

// ---------- DISPATCH MODE ----------
async function generateCaption(
  topic: string,
  contentType: string,
  language: string,
  ctaUrl: string,
  channelUsername: string | null
): Promise<string> {
  const langInstruction = {
    hi: "Reply in natural Hindi (Devanagari script).",
    en: "Reply in clear, simple English.",
    hinglish: "Reply in Hinglish (Hindi + English mix in Roman script).",
  }[language] || "Reply in English.";

  const sys = `You write Telegram channel posts for "Workly India" — a work-from-home jobs platform for India.
${langInstruction}
Constraints:
- 60-180 words. Mobile-friendly. Short lines.
- 1-2 emojis max. NO emoji spam.
- Include the CTA URL exactly as given (do not shorten).
- End with 2-3 hashtags including #WorklyIndia.
- Do NOT use markdown asterisks for bold. Use plain text.`;

  const usr = `Content type: ${contentType}
Topic: ${topic}
CTA URL (must include verbatim): ${ctaUrl}
${channelUsername ? `Channel: @${channelUsername}` : ""}

Write the post now.`;

  const resp = await callAI({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
  });
  const raw = resp.choices?.[0]?.message?.content?.trim() ?? "";
  // Strip any leftover {{placeholder}} or {placeholder} so unrendered tokens
  // never reach the channel.
  return raw
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, "")
    .replace(/\{\s*[a-z_]+\s*\}/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateImage(topic: string, contentType: string): Promise<string | null> {
  const prompt = `Create a vibrant, mobile-friendly social media graphic for an Indian work-from-home jobs Telegram channel.
Topic: ${topic}
Style: bold colors, modern, flat design, minimal text overlay (max 6 words).
Content type: ${contentType}.
Avoid logos, faces, and any copyrighted material. 1:1 square.`;

  try {
    const resp = await callAI({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    });
    const url = resp.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url || !url.startsWith("data:image")) return null;
    return url;
  } catch (e) {
    console.error("[image-gen] failed:", e);
    return null;
  }
}

async function uploadImage(supa: any, dataUrl: string, slotKey: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1];
    const ext = mime.split("/")[1] || "png";
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `${slotKey}.${ext}`;
    const { error } = await supa.storage
      .from("telegram-posts")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) throw error;
    const { data } = supa.storage.from("telegram-posts").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("[upload] failed:", e);
    return null;
  }
}

async function sendToChannel(
  chatId: string | number,
  caption: string,
  imageUrl: string | null
): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };

  if (imageUrl) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: imageUrl,
        caption: caption.slice(0, 1024),
      }),
    });
    const j = await r.json();
    if (!j.ok) return { ok: false, error: JSON.stringify(j) };
    return { ok: true, message_id: j.result?.message_id };
  }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: caption,
      disable_web_page_preview: false,
    }),
  });
  const j = await r.json();
  if (!j.ok) return { ok: false, error: JSON.stringify(j) };
  return { ok: true, message_id: j.result?.message_id };
}

async function runDispatch(supa: any, settings: BotSettings, opts: { force_next?: boolean } = {}) {
  if (!settings.channel_enabled || !settings.channel_chat_id) {
    return { skipped: true, reason: "channel disabled" };
  }
  if (!settings.growth_agent_enabled && !opts.force_next) {
    return { skipped: true, reason: "growth agent disabled" };
  }

  const today = todayInTz(settings.growth_timezone);
  const currentHour = hourInTz(settings.growth_timezone);

  // Pick due pending slots (current hour or earlier — catch-up)
  let q = supa
    .from("telegram_channel_growth_plan")
    .select("*")
    .eq("plan_date", today)
    .eq("status", "pending")
    .order("slot_hour", { ascending: true });

  if (!opts.force_next) q = q.lte("slot_hour", currentHour);

  const { data: due, error } = await q;
  if (error) throw error;
  if (!due || due.length === 0) {
    return { ok: true, dispatched: 0, currentHour };
  }

  // Process at most 3 per dispatch run to stay within timeout
  const slice = opts.force_next ? due.slice(0, 1) : due.slice(0, 3);
  const results: any[] = [];

  for (const slot of slice) {
    try {
      const caption = await generateCaption(
        slot.topic,
        slot.content_type,
        slot.language,
        slot.cta_url ?? "",
        settings.channel_username
      );

      let imageUrl: string | null = null;
      if (slot.with_image) {
        const dataUrl = await generateImage(slot.topic, slot.content_type);
        if (dataUrl) {
          imageUrl = await uploadImage(supa, dataUrl, `${slot.plan_date}_${slot.slot_hour}_${slot.id.slice(0, 8)}`);
        }
      }

      const sent = await sendToChannel(settings.channel_chat_id, caption, imageUrl);

      if (sent.ok) {
        await supa
          .from("telegram_channel_growth_plan")
          .update({
            caption,
            image_url: imageUrl,
            status: "sent",
            sent_at: new Date().toISOString(),
            telegram_message_id: sent.message_id ?? null,
          })
          .eq("id", slot.id);
        results.push({ id: slot.id, hour: slot.slot_hour, ok: true, message_id: sent.message_id });
      } else {
        const retry = (slot.retry_count ?? 0) + 1;
        await supa
          .from("telegram_channel_growth_plan")
          .update({
            caption,
            image_url: imageUrl,
            status: retry >= 3 ? "failed" : "pending",
            retry_count: retry,
            error_message: sent.error?.slice(0, 500),
          })
          .eq("id", slot.id);
        results.push({ id: slot.id, hour: slot.slot_hour, ok: false, error: sent.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[slot ${slot.id}]`, msg);
      const retry = (slot.retry_count ?? 0) + 1;
      await supa
        .from("telegram_channel_growth_plan")
        .update({
          status: retry >= 3 ? "failed" : "pending",
          retry_count: retry,
          error_message: msg.slice(0, 500),
        })
        .eq("id", slot.id);
      results.push({ id: slot.id, hour: slot.slot_hour, ok: false, error: msg });
    }
  }

  return { ok: true, dispatched: results.length, results, currentHour };
}

// ---------- HTTP handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const mode = body.mode ?? url.searchParams.get("mode") ?? "dispatch";
    const force = !!body.force;

    const settings = await getSettings(supa);

    let result: any;
    if (mode === "plan") {
      result = await runPlan(supa, settings, force);
    } else if (mode === "dispatch") {
      result = await runDispatch(supa, settings, { force_next: !!body.force_next });
    } else if (mode === "status") {
      const today = todayInTz(settings.growth_timezone);
      const { data } = await supa
        .from("telegram_channel_growth_plan")
        .select("*")
        .eq("plan_date", today)
        .order("slot_hour");
      result = { date: today, settings, plan: data };
    } else {
      result = { error: "unknown mode" };
    }

    return new Response(JSON.stringify({ ok: true, mode, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram-growth-agent] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
