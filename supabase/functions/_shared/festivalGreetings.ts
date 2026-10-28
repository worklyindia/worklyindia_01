// =============================================================================
// Festival & Holiday greetings — Push + Telegram + Email, AI written
// -----------------------------------------------------------------------------
// Runs every morning (IST) from pg_cron. If today's date is a festival or
// holiday in the shared Indian calendar, every job seeker and every employer
// gets a wish on all three channels:
//   push     -> very short (1 line)
//   telegram -> medium (a few warm lines)
//   email    -> full, nicely written message
//
// AI is NOT used: the owner's saved templates from Owner Portal ->
// Push / Telegram / Email Templates are sent exactly as written.
// =============================================================================

import { FESTIVALS, todayIST } from "./festivalCalendar.ts";
import { BRAND_CONFIG } from "./brandConfig.ts";

const IST = "Asia/Kolkata";
const BATCH_SIZE = 40;
const BASE_URL = BRAND_CONFIG.canonicalUrl;

type Audience = "job_seeker" | "employer";

interface TemplateRow {
  enabled?: boolean | null;
  title?: string | null;
  subject?: string | null;
  body?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  image_url?: string | null;
}

interface Composed {
  pushTitle: string;
  pushBody: string;
  telegramText: string;
  emailSubject: string;
  emailHtml: string;
  source: "ai" | "template";
  buttonText: string;
  buttonUrl: string;
}

const json = (body: unknown) => body as Record<string, unknown>;

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const eventKey = (audience: Audience) =>
  audience === "employer" ? "festival_greeting_employer" : "festival_greeting_job_seeker";

// keepUnknown=true leaves placeholders like {{name}} intact so they can be
// filled per recipient later.
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

function istDateLabel(iso: string) {
  return new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-GB", { timeZone: IST, day: "2-digit", month: "long", year: "numeric" });
}

async function loadTemplate(supabase: any, table: string, key: string): Promise<TemplateRow | null> {
  const { data } = await supabase.from(table).select("*").eq("event_type", key).maybeSingle();
  return (data as TemplateRow) ?? null;
}


// --------------------------------------------------------------- COMPOSE ----
// AI is intentionally NOT used here: the owner's saved templates are sent as-is
// (with {{festival}}, {{festival_date}} and per-recipient {{name}} filled in).
async function composeGreeting(
  supabase: any,
  audience: Audience,
  festival: string,
  festivalDate: string,
): Promise<Composed> {
  const key = eventKey(audience);
  const [pushTpl, tgTpl, mailTpl] = await Promise.all([
    loadTemplate(supabase, "push_lifecycle_templates", key),
    loadTemplate(supabase, "telegram_lifecycle_templates", key),
    loadTemplate(supabase, "email_lifecycle_templates", key),
  ]);

  const dateLabel = istDateLabel(festivalDate);
  const buttonText = (tgTpl?.button_text || pushTpl?.button_text || (audience === "employer" ? "Open Dashboard" : "Explore Jobs")).trim();
  const buttonUrl = absoluteUrl(tgTpl?.button_url || pushTpl?.button_url || (audience === "employer" ? "/employer/dashboard" : "/jobs"));

  const vars = { festival, festival_date: dateLabel, date: dateLabel };

  const pushTitle = fill(pushTpl?.title || `🎉 Happy ${festival}!`, vars, true);
  const pushBody = fill(pushTpl?.body || tgTpl?.body || `Hi {{name}}, warm wishes on ${festival} from ${BRAND_CONFIG.name}!`, vars, true);
  const telegramText = fill(tgTpl?.body || pushBody, vars, true);
  const emailSubject = fill(mailTpl?.subject || pushTitle, vars, true);
  const emailBody = fill(mailTpl?.body || telegramText, vars, true);

  // Saved template already HTML ho to bilkul waisa hi bhejo (escape nahi).
  const looksHtml = /<\/?(p|h[1-6]|div|table|br|strong|a|span|img|ul|li)\b[^>]*>/i.test(emailBody);
  const emailHtml = looksHtml ? emailBody : emailBody
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.7;">${escapeHtml(p.trim()).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return {
    pushTitle,
    pushBody,
    telegramText,
    emailSubject,
    emailHtml,
    source: "template",
    buttonText,
    buttonUrl,
  };
}

// ---------------------------------------------------------------- SENDING ---
async function safeInvoke(supabase: any, fn: string, body: unknown) {
  try {
    const { error } = await supabase.functions.invoke(fn, { body });
    if (error) console.warn(`[festival] ${fn} failed:`, error.message);
    return !error;
  } catch (e) {
    console.warn(`[festival] ${fn} threw:`, e);
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
    console.warn("[festival] email preference lookup failed:", e);
  }
  return out;
}

interface Recipient {
  user_id: string;
  name: string;
  email: string | null;
  telegram_chat_id: string | null;
  telegram_ok: boolean;
}

async function loadRecipients(supabase: any, audience: Audience): Promise<Recipient[]> {
  if (audience === "employer") {
    const { data } = await supabase
      .from("companies")
      .select("user_id, company_name, email, telegram_chat_id, telegram_notifications_enabled")
      .not("user_id", "is", null);
    // One login can own both sides. When the company has no Telegram of its
    // own, the person's chat and their own switch are used instead.
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, email, telegram_chat_id, telegram_notifications_enabled")
      .not("user_id", "is", null);
    const profileById = new Map<string, any>(
      (profileRows ?? []).map((p: any) => [String(p.user_id), p]),
    );
    return (data ?? []).map((r: any) => {
      const p = profileById.get(String(r.user_id));
      const useCompanyTelegram = Boolean(r.telegram_chat_id);
      return {
        user_id: String(r.user_id),
        name: String(r.company_name || "there").trim(),
        email: (r.email || p?.email) ? String(r.email || p.email) : null,
        telegram_chat_id: (r.telegram_chat_id || p?.telegram_chat_id)
          ? String(r.telegram_chat_id || p.telegram_chat_id)
          : null,
        telegram_ok: useCompanyTelegram
          ? r.telegram_notifications_enabled !== false
          : p?.telegram_notifications_enabled !== false,
      };
    });
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, telegram_chat_id, telegram_notifications_enabled")
    .not("user_id", "is", null);
  return (data ?? []).map((r: any) => ({
    user_id: String(r.user_id),
    name: String(r.full_name || "there").trim(),
    email: r.email ? String(r.email) : null,
    telegram_chat_id: r.telegram_chat_id ? String(r.telegram_chat_id) : null,
    telegram_ok: r.telegram_notifications_enabled !== false,
  }));
}

// Users who logged in within the last 30 days (both job seekers and employers
// have a row in profiles keyed by user_id).
async function recentlyActiveUserIds(supabase: any): Promise<Set<string>> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const out = new Set<string>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .gte("last_login_at", since)
      .not("user_id", "is", null)
      .range(from, from + page - 1);
    if (error) {
      console.warn("[festival] active-user lookup failed:", error.message);
      break;
    }
    for (const r of data ?? []) out.add(String(r.user_id));
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}


async function deliver(
  supabase: any,
  recipient: Recipient,
  content: Composed,
  audience: Audience,
  logType: string,
  emailBlocked: boolean,
) {
  const vars = { name: recipient.name };
  const channels: string[] = [];

  // Push
  if (
    await safeInvoke(supabase, "email-api", {
      action: "send_push",
      user_id: recipient.user_id,
      title: fill(content.pushTitle, vars),
      message: fill(content.pushBody, vars),
      action_url: content.buttonUrl,
      type: "festival_greeting",
    })
  ) {
    channels.push("push");
  }

  // Telegram
  if (recipient.telegram_chat_id && recipient.telegram_ok) {
    const text = escapeHtml(fill(content.telegramText, vars));
    if (
      await safeInvoke(supabase, "email-api/telegram", {
        action: "send",
        // Side ka apna bot.
        audience: audience === "employer" ? "employer" : "job_seeker",
        chat_id: recipient.telegram_chat_id,
        text,
        parse_mode: "HTML",
        button_text: content.buttonText || undefined,
        button_url: content.buttonText ? content.buttonUrl : undefined,
      })
    ) {
      channels.push("telegram");
    }
  }

  // Email
  if (recipient.email && !emailBlocked) {
    // Template body me button already hai — extra button nahi jodte.
    if (
      await safeInvoke(supabase, "email-api/send-email", {
        to: recipient.email,
        toName: recipient.name,
        subject: fill(content.emailSubject, vars),
        htmlContent: fill(content.emailHtml, vars),

        templateMode: "complete",
        audience: audience === "employer" ? "employer" : "jobseeker",
      })
    ) {
      channels.push("email");
    }
  }

  if (channels.length > 0) {
    try {
      await supabase.from("marketing_notification_logs").insert({
        user_id: recipient.user_id,
        user_type: audience,
        notification_type: logType,
        channels_sent: channels,
        content_key: content.source,
      });
    } catch (e) {
      console.warn("[festival] log insert failed:", e);
    }
  }
  return channels;
}

// ------------------------------------------------------------------ SERVE ---
export async function runFestivalGreetings(supabase: any, body: any = {}) {
  const requestId = crypto.randomUUID().slice(0, 8);
  try {

    const today = todayIST();
    const forcedName: string | undefined = body?.festival;
    const forcedDate: string | undefined = body?.date;
    const previewOnly = body?.preview === true;
    const testUserId: string | undefined = body?.test_user_id;
    const testEmail: string | undefined = body?.test_email;

    // Same list the app's Festivals page shows (saved Google Calendar JSON).
    let calendar: { date: string; name: string }[] = FESTIVALS;
    try {
      const { data } = await supabase
        .from("google_calendar_api")
        .select("data")
        .eq("name", "Google Calendar API JSON")
        .maybeSingle();
      const list = (data?.data as any)?.festivals;
      if (Array.isArray(list) && list.length) calendar = list;
    } catch (e) {
      console.warn("[festival] calendar load failed, using built-in list:", e);
    }

    const matches = forcedName
      ? [{ date: forcedDate || today, name: forcedName }]
      : calendar.filter((f) => f.date === (forcedDate || today));

    if (matches.length === 0) {
      console.log(`[${requestId}] no festival on ${today}`);
      return json({ success: true, date: today, festival: null, message: "No festival or holiday today" });
    }

    const festivalName = matches.map((f) => f.name).join(" & ");
    const festivalDate = matches[0].date;
    console.log(`[${requestId}] 🎉 ${festivalName} (${festivalDate})`);

    const audiences: Audience[] = body?.audience ? [body.audience] : ["job_seeker", "employer"];
    const summary: Record<string, unknown> = {};

    for (const audience of audiences) {
      const content = await composeGreeting(supabase, audience, festivalName, festivalDate);

      if (previewOnly) {
        summary[audience] = content;
        continue;
      }

      const logType = `festival:${festivalDate}:${audience}`;
      const blockedEmails = await optedOutEmails(supabase, audience);

      let recipients = await loadRecipients(supabase, audience);
      if (testUserId) recipients = recipients.filter((r) => r.user_id === testUserId);
      if (testEmail) recipients = recipients.filter((r) => (r.email || "").toLowerCase() === testEmail.toLowerCase());

      // Only users who logged in during the last 30 days.
      if (!testUserId && !testEmail) {
        const active = await recentlyActiveUserIds(supabase);
        recipients = recipients.filter((r) => active.has(r.user_id));
      }


      // Skip anyone who already got this festival today.
      if (!testUserId && !testEmail) {
        const { data: already } = await supabase
          .from("marketing_notification_logs")
          .select("user_id")
          .eq("notification_type", logType);
        const sentTo = new Set((already ?? []).map((r: any) => String(r.user_id)));
        recipients = recipients.filter((r) => !sentTo.has(r.user_id));
      }

      let sent = 0;
      const counts = { push: 0, telegram: 0, email: 0 };
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((r) =>
            deliver(supabase, r, content, audience, logType, blockedEmails.has(r.user_id))
          ),
        );
        for (const res of results) {
          if (res.status !== "fulfilled" || res.value.length === 0) continue;
          sent++;
          for (const ch of res.value) counts[ch as keyof typeof counts]++;
        }
      }

      console.log(`[${requestId}] ${audience}: users=${sent} push=${counts.push} tg=${counts.telegram} mail=${counts.email} source=${content.source}`);
      summary[audience] = { recipients: recipients.length, users_reached: sent, ...counts, source: content.source };
    }

    return { success: true, festival: festivalName, date: festivalDate, preview: previewOnly, summary };
  } catch (error: any) {
    console.error(`[${requestId}] ❌`, error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}
