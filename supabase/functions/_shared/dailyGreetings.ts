// =============================================================================
// Daily time-of-day greetings — Push + Telegram + Email, AI written, full English
// -----------------------------------------------------------------------------
// Four slots, Indian time (IST):
//   morning   05:00 - 11:59  🌅 Good Morning   (cron 8:00 AM IST)
//   afternoon 12:00 - 16:59  ☀️ Good Afternoon (cron 1:30 PM IST)
//   evening   17:00 - 20:59  🌆 Good Evening   (cron 6:00 PM IST)
//   night     21:00 - 04:59  🌙 Good Night     (cron 9:30 PM IST)
//
// Goes to BOTH job seekers and employers who logged in within the last 30 days.
// Job seekers are addressed by their name, employers by their company name.
//   push     -> one very short line
//   telegram -> a few short lines
//   email    -> full, nicely written message
// Wording comes from the same multi-provider / multi-model AI chain the AI chat
// uses; if every provider fails, the owner's stored templates are sent as-is.
// =============================================================================

import { BRAND_CONFIG } from "./brandConfig.ts";

const BATCH_SIZE = 25;
const BASE_URL = BRAND_CONFIG.canonicalUrl;

type Audience = "job_seeker" | "employer";
export type DaySlot = "morning" | "afternoon" | "evening" | "night";

const SLOT_META: Record<DaySlot, { label: string; emoji: string; window: string }> = {
  morning: { label: "Good Morning", emoji: "🌅", window: "5:00 AM - 11:59 AM IST" },
  afternoon: { label: "Good Afternoon", emoji: "☀️", window: "12:00 PM - 4:59 PM IST" },
  evening: { label: "Good Evening", emoji: "🌆", window: "5:00 PM - 8:59 PM IST" },
  night: { label: "Good Night", emoji: "🌙", window: "9:00 PM onwards IST" },
};

interface TemplateRow {
  enabled?: boolean | null;
  title?: string | null;
  subject?: string | null;
  body?: string | null;
  button_text?: string | null;
  button_url?: string | null;
}

interface Templates {
  push: TemplateRow | null;
  telegram: TemplateRow | null;
  email: TemplateRow | null;
  buttonText: string;
  buttonUrl: string;
}

interface Composed {
  title: string;
  body: string;
  telegramText: string;
  emailSubject: string;
  emailHtml: string;
  source: "ai" | "template";
}

interface Recipient {
  user_id: string;
  name: string;
  email: string | null;
  telegram_chat_id: string | null;
  telegram_ok: boolean;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// keepUnknown: leave {{...}} placeholders we don't know yet (filled per recipient).
const fill = (text: string, values: Record<string, string>, keepUnknown = false) => {
  let out = String(text || "");
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
  }
  if (!keepUnknown) out = out.replace(/\{\{[^{}]*\}\}/g, "");
  return out.replace(/[ \t]{2,}/g, " ").trim();
};

const absoluteUrl = (url?: string | null) => {
  const value = String(url || "/").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

function parseJsonish(text: string): any | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function istNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
  };
}

export function slotForHour(hour: number): DaySlot {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const eventKey = (slot: DaySlot, audience: Audience) => `daily_${slot}_${audience}`;

async function loadTemplates(supabase: any, slot: DaySlot, audience: Audience): Promise<Templates> {
  const key = eventKey(slot, audience);
  const get = async (table: string) => {
    const { data } = await supabase.from(table).select("*").eq("event_type", key).maybeSingle();
    return (data as TemplateRow) ?? null;
  };
  const [push, telegram, email] = await Promise.all([
    get("push_lifecycle_templates"),
    get("telegram_lifecycle_templates"),
    get("email_lifecycle_templates"),
  ]);
  const fallbackUrl = audience === "employer" ? "/employer/dashboard" : "/jobs";
  return {
    push,
    telegram,
    email,
    buttonText: String(telegram?.button_text || push?.button_text || (audience === "employer" ? "Open Dashboard" : "Explore Jobs")).trim(),
    buttonUrl: absoluteUrl(telegram?.button_url || push?.button_url || fallbackUrl),
  };
}

async function composeGreeting(
  tpl: Templates,
  slot: DaySlot,
  audience: Audience,
): Promise<Composed> {
  const meta = SLOT_META[slot];
  // Owner-written templates are sent exactly as saved — no AI rewriting, so the
  // template values the owner sees in the portal are what goes out.
  const finalize = (value: string) => fill(value, {}, true);

  const fallbackTitle = String(tpl.push?.title || `${meta.emoji} ${meta.label}, {{name}}!`).trim();
  const fallbackBody = String(
    tpl.push?.body ||
      (audience === "employer"
        ? "Great time to post a job and meet new candidates."
        : "New jobs are waiting for you — take a quick look today."),
  ).trim();
  const fallbackTelegram = String(tpl.telegram?.body || `${fallbackTitle}\n${fallbackBody}`).trim();
  const fallbackSubject = String(tpl.email?.subject || `${meta.label}, {{name}}!`).trim();
  const fallbackEmail = String(tpl.email?.body || fallbackTelegram).trim();

  const emailBody = finalize(fallbackEmail);
  // Owner templates are authored as HTML in the email editor. Only plain-text
  // bodies get escaped and wrapped in paragraphs — otherwise the saved markup
  // would arrive visible as raw tags in the inbox.
  const looksLikeHtml = /<(p|div|br|span|a|strong|b|em|i|u|ul|ol|li|h[1-6]|table|img)\b[^>]*>/i.test(emailBody);
  const emailHtml = looksLikeHtml
    ? emailBody
    : emailBody
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 16px;line-height:1.7;">${escapeHtml(p.trim()).replace(/\n/g, "<br />")}</p>`)
        .join("");

  return {
    title: finalize(fallbackTitle),
    body: finalize(fallbackBody),
    telegramText: finalize(fallbackTelegram),
    emailSubject: finalize(fallbackSubject),
    emailHtml,
    source: "template",
  };

}

async function safeInvoke(supabase: any, fn: string, body: unknown) {
  try {
    const { error } = await supabase.functions.invoke(fn, { body });
    if (error) console.warn(`[daily] ${fn} failed:`, error.message);
    return !error;
  } catch (e) {
    console.warn(`[daily] ${fn} threw:`, e);
    return false;
  }
}

async function optedOutEmails(supabase: any, audience: Audience): Promise<Set<string>> {
  const table = audience === "employer" ? "employer_settings" : "user_settings";
  const out = new Set<string>();
  try {
    const { data } = await supabase.from(table).select("user_id").eq("email_notifications", false);
    for (const row of data ?? []) out.add(String(row.user_id));
  } catch (e) {
    console.warn("[daily] email preference lookup failed:", e);
  }
  return out;
}

// Recipients: logged in within the last 30 days.
async function loadRecipients(supabase: any, audience: Audience): Promise<Recipient[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const active = new Map<string, any>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, telegram_chat_id, telegram_notifications_enabled, is_profile_complete")
      .not("user_id", "is", null)
      .gte("last_login_at", since)
      .range(from, from + page - 1);
    if (error) {
      console.warn("[daily] active-user lookup failed:", error.message);
      break;
    }
    for (const r of data ?? []) active.set(String(r.user_id), r);
    if (!data || data.length < page) break;
    from += page;
  }

  const toRecipient = (id: string, row: any, name: string, override?: any): Recipient => {
    // A company switch/chat only applies when the company has linked its own
    // Telegram. Otherwise the message lands in the person's chat, so their own
    // switch decides — one login must not silence the other side.
    const useCompanyTelegram = Boolean(override?.telegram_chat_id);
    return {
      user_id: id,
      name,
      email: (override?.email || row?.email) ? String(override?.email || row.email) : null,
      telegram_chat_id: (override?.telegram_chat_id || row?.telegram_chat_id)
        ? String(override?.telegram_chat_id || row.telegram_chat_id)
        : null,
      telegram_ok: useCompanyTelegram
        ? override.telegram_notifications_enabled !== false
        : row?.telegram_notifications_enabled !== false,
    };
  };

  if (audience === "employer") {
    const { data } = await supabase
      .from("companies")
      .select("user_id, company_name, email, telegram_chat_id, telegram_notifications_enabled")
      .not("user_id", "is", null);
    const out: Recipient[] = [];
    for (const c of data ?? []) {
      const id = String(c.user_id);
      const row = active.get(id);
      if (!row) continue;
      out.push(toRecipient(id, row, String(c.company_name || row.full_name || "there").trim(), c));
    }
    return out;
  }

  // Job seekers = active profiles. One login can hold BOTH sides: such a user
  // stays on the job-seeker list too, as long as their job-seeker profile is
  // actually set up — so they get the job-seeker greeting AND the employer one.
  const { data: companies } = await supabase.from("companies").select("user_id").not("user_id", "is", null);
  const employerIds = new Set((companies ?? []).map((r: any) => String(r.user_id)));
  const out: Recipient[] = [];
  for (const [id, row] of active.entries()) {
    if (employerIds.has(id) && row?.is_profile_complete !== true) continue;
    out.push(toRecipient(id, row, String(row.full_name || "there").trim()));
  }
  return out;
}

async function loadTestRecipients(
  supabase: any,
  audience: Audience,
  testUserId?: string,
  testEmail?: string,
): Promise<Recipient[]> {
  let query = supabase
    .from("profiles")
    .select("user_id, full_name, email, telegram_chat_id, telegram_notifications_enabled")
    .not("user_id", "is", null)
    .limit(5);
  if (testUserId) query = query.eq("user_id", testUserId);
  if (testEmail) query = query.ilike("email", testEmail);
  const { data } = await query;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // For the employer test we want the company's own name / email / Telegram,
  // so a person holding BOTH profiles receives two clearly different messages.
  let companies = new Map<string, any>();
  if (audience === "employer") {
    const { data: comp } = await supabase
      .from("companies")
      .select("user_id, company_name, email, telegram_chat_id, telegram_notifications_enabled")
      .in("user_id", rows.map((r: any) => String(r.user_id)));
    for (const c of comp ?? []) companies.set(String(c.user_id), c);
  }

  return rows.map((r: any) => {
    const c = companies.get(String(r.user_id));
    const useCompanyTelegram = Boolean(c?.telegram_chat_id);
    return {
      user_id: String(r.user_id),
      name: String(c?.company_name || r.full_name || "there").trim(),
      email: (c?.email || r.email) ? String(c?.email || r.email) : null,
      telegram_chat_id: (c?.telegram_chat_id || r.telegram_chat_id)
        ? String(c?.telegram_chat_id || r.telegram_chat_id)
        : null,
      telegram_ok: useCompanyTelegram
        ? c.telegram_notifications_enabled !== false
        : r.telegram_notifications_enabled !== false,
    };
  });
}

async function deliver(
  supabase: any,
  recipient: Recipient,
  content: Composed,
  tpl: Templates,
  slot: DaySlot,
  audience: Audience,
  emailBlocked: boolean,
): Promise<string[]> {
  const vars = { name: recipient.name };
  const channels: string[] = [];

  if (
    await safeInvoke(supabase, "email-api", {
      action: "send_push",
      user_id: recipient.user_id,
      title: fill(content.title, vars),
      message: fill(content.body, vars),
      action_url: tpl.buttonUrl,
      type: `daily_${slot}`,
      // Owner-written greeting templates go out exactly as saved — no AI rewrite.
      skip_rephrase: true,
    })
  ) {
    channels.push("push");
  }

  if (recipient.telegram_chat_id && recipient.telegram_ok) {
    if (
      await safeInvoke(supabase, "email-api/telegram", {
        action: "send",
        // Side ka apna bot: job seeker -> job seekers bot, employer -> employers bot.
        audience: audience === "employer" ? "employer" : "job_seeker",
        chat_id: recipient.telegram_chat_id,
        text: escapeHtml(fill(content.telegramText, vars)),
        parse_mode: "HTML",
        button_text: tpl.buttonText || undefined,
        button_url: tpl.buttonText ? tpl.buttonUrl : undefined,
      })
    ) {
      channels.push("telegram");
    }
  }

  if (recipient.email && !emailBlocked) {
    // Email ke body me template ka button already hai — yahan dusra button add nahi karte.
    const payload = {
      to: recipient.email,
      toName: recipient.name,
      subject: fill(content.emailSubject, vars),
      htmlContent: fill(content.emailHtml, vars),
      templateMode: "complete",
      audience: audience === "employer" ? "employer" : "jobseeker",
    };
    let ok = await safeInvoke(supabase, "email-api/send-email", payload);
    if (!ok) {
      // A dual-profile user gets two greetings to the same address moments apart;
      // the mail provider can throttle the second one, so retry it once.
      await new Promise((r) => setTimeout(r, 4000));
      ok = await safeInvoke(supabase, "email-api/send-email", payload);
    }
    if (ok) channels.push("email");
  }

  return channels;
}

export async function runDailyGreetings(supabase: any, body: any = {}) {
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const now = istNow();
    const slot: DaySlot = (["morning", "afternoon", "evening", "night"] as DaySlot[]).includes(body?.slot)
      ? body.slot
      : slotForHour(now.hour);
    const previewOnly = body?.preview === true;
    const testUserId: string | undefined = body?.test_user_id;
    const testEmail: string | undefined = body?.test_email;
    const isTest = Boolean(testUserId || testEmail);
    const audiences: Audience[] = body?.audience === "employer"
      ? ["employer"]
      : body?.audience === "job_seeker"
      ? ["job_seeker"]
      : ["job_seeker", "employer"];

    // Job seeker and employer are logged separately, so someone holding BOTH
    // profiles gets BOTH greetings instead of the second one being skipped.
    const logTypeFor = (a: Audience) => `daily_${slot}_${a}:${now.date}`;
    const result: Record<string, unknown> = { success: true, slot, date: now.date, hour: now.hour };

    for (const audience of audiences) {
      const tpl = await loadTemplates(supabase, slot, audience);
      if (tpl.push?.enabled === false) {
        result[audience] = { skipped: "template disabled" };
        continue;
      }

      const content = await composeGreeting(tpl, slot, audience);

      if (previewOnly) {
        result[audience] = { preview: true, content };
        continue;
      }

      const logType = logTypeFor(audience);
      let recipients = isTest
        ? await loadTestRecipients(supabase, audience, testUserId, testEmail)
        : await loadRecipients(supabase, audience);

      // Skip anyone who already got this slot's greeting today (this side only).
      if (!isTest && recipients.length > 0) {
        const { data: already } = await supabase
          .from("marketing_notification_logs")
          .select("user_id")
          .eq("notification_type", logType);
        const sentTo = new Set((already ?? []).map((r: any) => String(r.user_id)));
        recipients = recipients.filter((r) => !sentTo.has(r.user_id));
      }

      const blockedEmails = isTest ? new Set<string>() : await optedOutEmails(supabase, audience);
      const counts = { push: 0, telegram: 0, email: 0 };
      let sent = 0;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (r) => {
            const channels = await deliver(
              supabase,
              r,
              content,
              tpl,
              slot,
              audience,
              blockedEmails.has(r.user_id),
            );
            if (channels.length > 0) {
              try {
                await supabase.from("marketing_notification_logs").insert({
                  user_id: r.user_id,
                  user_type: audience,
                  notification_type: logType,
                  channels_sent: channels,
                  content_key: content.source,
                });
              } catch (_e) { /* logging is best effort */ }
            }
            return channels;
          }),
        );
        for (const res of results) {
          if (res.status !== "fulfilled" || res.value.length === 0) continue;
          sent++;
          for (const ch of res.value) counts[ch as keyof typeof counts]++;
        }
      }

      result[audience] = {
        recipients: recipients.length,
        users_reached: sent,
        ...counts,
        source: content.source,
        content,
      };
      console.log(`[${requestId}] ${slot}/${audience}: recipients=${recipients.length} users=${sent} push=${counts.push} tg=${counts.telegram} mail=${counts.email}`);
    }

    return result;
  } catch (error: any) {
    console.error(`[${requestId}] ❌`, error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}
