// =============================================================================
// Lifecycle fan-out: Email + Telegram
// -----------------------------------------------------------------------------
// Every app event that sends a push through email-api also
// delivers the owner-configured Email (email_lifecycle_templates) and Telegram
// (telegram_lifecycle_templates) message for the SAME event key.
// Templates that are disabled in the Owner Portal are skipped.
// This helper never throws — a channel failure must not break the push.
// =============================================================================

import { WEBSITE_DOMAIN } from './domain.ts';
import { isBanExemptEvent, isUserBanned } from './banGuard.ts';
import { sendLifecycleWhatsApp } from './lifecycleWhatsApp.ts';
import { escapeHtml, escapeHtmlAttribute, renderEmailTemplateHtml, renderTelegramTemplateHtml, templateHasHtml } from './templateHtml.ts';

export interface LifecycleTemplateRow {
  event_type: string;
  enabled?: boolean | null;
  subject?: string | null;
  title?: string | null;
  body?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  image_url?: string | null;
}

export type FanoutStatus =
  | 'sent'
  | 'skipped'
  | 'failed'
  | 'no_recipient'
  | 'disabled'
  | 'no_template'
  | 'opted_out';

export interface FanoutResult {
  email: FanoutStatus;
  telegram: FanoutStatus;
  whatsapp?: FanoutStatus;
  errors: string[];
  /** Subject line actually used, so callers that log outbound email can report it. */
  subject?: string;
}

const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}/;
const PLACEHOLDER_ALL = /\{\{\s*[\w.]+\s*\}\}/g;
const hasVisibleText = (value: string) => value.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;

/**
 * Drop only the part that still holds an unresolved {{placeholder}} — never the
 * whole saved template. HTML bodies lose just the affected block, plain text
 * loses just that line. If that would wipe everything, the placeholders alone
 * are stripped so the owner's saved message still goes out.
 */
const stripUnresolved = (text: string): string => {
  if (!PLACEHOLDER.test(text)) return text.trim();
  const bare = text.replace(PLACEHOLDER_ALL, '').replace(/[ \t]{2,}/g, ' ').trim();

  if (/<[a-z][^>]*>/i.test(text)) {
    // Segment into blocks so a dropped value also removes its label row and the
    // blank spacers around it — a missing value must never leave an orphan label.
    const blockRe = /<(p|div|li|tr|h[1-6]|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi;
    const isBrOnly = (b: string) => /^<(p|div)\b[^>]*>\s*(?:<br\s*\/?>\s*|&nbsp;)*<\/\1>$/i.test(b);
    const segs: { html: string; block: boolean }[] = [];
    let lastIdx = 0; let bm: RegExpExecArray | null;
    while ((bm = blockRe.exec(text)) !== null) {
      if (bm.index > lastIdx) segs.push({ html: text.slice(lastIdx, bm.index), block: false });
      segs.push({ html: bm[0], block: true });
      lastIdx = bm.index + bm[0].length;
    }
    if (lastIdx < text.length) segs.push({ html: text.slice(lastIdx), block: false });
    const drops = segs.map((s) => s.block && PLACEHOLDER.test(s.html));
    // A dropped value hides the label directly above it (labels hold no placeholder).
    for (let i = 0; i < segs.length; i++) {
      if (!drops[i]) continue;
      const j = i - 1;
      if (j >= 0 && segs[j].block && !drops[j] && !PLACEHOLDER.test(segs[j].html) && !isBrOnly(segs[j].html) && !/border-top/.test(segs[j].html)) drops[j] = true;
    }
    // Blank spacer lines next to removed rows go too.
    for (let i = 0; i < segs.length; i++) {
      if (!segs[i].block || !isBrOnly(segs[i].html)) continue;
      if ((i > 0 && drops[i - 1]) || (i < segs.length - 1 && drops[i + 1])) drops[i] = true;
    }
    const pruned = segs.filter((_s, i) => !drops[i]).map((s) => s.html).join('')
      .replace(PLACEHOLDER_ALL, '')
      .trim();
    return hasVisibleText(pruned) ? pruned : bare;
  }

  const kept = text.split('\n').filter((line) => !PLACEHOLDER.test(line)).join('\n').trim();
  return kept || bare;
};

const fill = (
  text: string | null | undefined,
  values: Record<string, unknown>,
  options: { escapeValues?: boolean; trustedHtmlVariables?: string[] } = {},
): string => {
  if (!text) return '';
  let out = String(text);
  const mobileDigits = String(values.mobile ?? '').replace(/\D/g, '');
  const whatsapp = String(values.whatsapp ?? values.mobile ?? '').trim();
  const whatsappDigits = whatsapp.replace(/\D/g, '');
  const expandedValues = {
    ...values,
    ...(whatsapp ? { whatsapp } : {}),
    ...(mobileDigits ? { mobile_digits: mobileDigits } : {}),
    ...(whatsappDigits ? { whatsapp_digits: whatsappDigits } : {}),
  };
  for (const [key, raw] of Object.entries(expandedValues)) {
    const formatted = raw == null ? '' : formatTemplateValue(key, String(raw));
    const value = options.escapeValues && !options.trustedHtmlVariables?.includes(key)
      ? escapeHtml(formatted)
      : formatted;
    if (!value) continue;
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
  }
  return stripUnresolved(out);
};

const TITLE_CASE_VARIABLES = new Set(['name', 'job_title', 'company', 'status', 'mode']);

const formatTemplateValue = (key: string, value: string): string => {
  const clean = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!TITLE_CASE_VARIABLES.has(key)) return clean;
  return clean.replace(/(^|[\s/(-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
};

const absoluteUrl = (url?: string | null): string => {
  const value = String(url || '/').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${WEBSITE_DOMAIN}${value.startsWith('/') ? value : `/${value}`}`;
};

async function loadTemplate(
  supabase: any,
  table: string,
  eventType: string,
): Promise<LifecycleTemplateRow | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('event_type', eventType)
    .maybeSingle();
  if (error) {
    console.error(`[fanout] ${table} lookup failed:`, error.message);
    return null;
  }
  return (data as LifecycleTemplateRow) ?? null;
}

/**
 * Recipient email. One login can own BOTH a job-seeker profile and a company,
 * so the side of the event decides which address is preferred:
 *   employer event   -> company email  -> profile email -> auth email
 *   job-seeker event -> profile email  -> company email -> auth email
 */
async function resolveEmail(
  supabase: any,
  userId: string,
  override?: string | null,
  templateKey?: string,
  audience?: 'employer' | 'jobseeker',
) {
  if (override && override.includes('@')) return override.trim();

  const profileEmail = async (): Promise<string | null> => {
    const { data } = await supabase.from('profiles').select('email').eq('user_id', userId).maybeSingle();
    return data?.email ? String(data.email) : null;
  };
  const companyEmail = async (): Promise<string | null> => {
    const { data } = await supabase.from('companies').select('email').eq('user_id', userId).maybeSingle();
    return data?.email ? String(data.email) : null;
  };

  const employerSide = audience ? audience === 'employer' : templateKey ? EMPLOYER_EVENTS.has(templateKey) : false;
  const first = employerSide ? await companyEmail() : await profileEmail();
  if (first) return first;
  const second = employerSide ? await profileEmail() : await companyEmail();
  if (second) return second;

  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ? String(data.user.email) : null;
  } catch {
    return null;
  }
}


// Which side of the marketplace each lifecycle event is addressed to.
// Employer events greet with the company name, job-seeker events with the
// person's profile name. Unlisted events auto-detect (profile first).
// Only the 3 Employee payment emails (Success/Failed/Refund) exist; all other payment emails are retired.
const WEBHOOK_PAYMENT_EMAILS = new Set([
  'payment_success', 'payment_failed', 'payment_refund', 'paypal_payment_success', 'paypal_payment_failed', 'paypal_payment_refund', 'refund_initiated',
  'subscription_expiring', 'wallet_credit', 'wallet_points_debited', 'google_bing_publish_activated',
  'job_boost_activated', 'verification_badge_activated', 'ai_plan_activated',
]);
const EMPLOYER_EVENTS = new Set([
  'developer_platform_promo',
  'employer_signup_welcome',
  'employer_account_deleted',
  'employer_email_notifications_on',
  'employer_email_notifications_off',
  'new_application_received',
  'job_posted',
  'job_expiry',
  'boost_expiry',
  'verification_expiry',
  'account_banned_employer',
  'account_unbanned_employer',
  'job_posting_banned',
  'job_posting_unbanned',
]);
const JOBSEEKER_EVENTS = new Set([
  'resume_builder_promo',
  'cover_letter_builder_promo',
  'signup_welcome',
  'job_seeker_account_deleted',
  'account_banned_job_seeker',
  'account_unbanned_job_seeker',
  'job_apply_banned',
  'job_apply_unbanned',
  'email_notifications_on',
  'email_notifications_off',
  'application_submitted',
  'application_status_changed',
  'application_under_review',
  'application_shortlisted',
  'application_interview_scheduled',
  'application_hired',
  'application_rejected',
  'application_withdrawn',

  'application_viewed',
  'interview_status_update',
  'interview_employer_joined',
  'interview_started',
  'new_job_match',
  'profile_complete',
]);

/** Greeting name: employer events → company name, job-seeker events → profile name. */
export async function resolveDisplayName(
  supabase: any,
  userId: string,
  templateKey: string,
  audience?: 'employer' | 'jobseeker',
): Promise<string | null> {
  const profileName = async (): Promise<string | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();
    const v = data?.full_name ? String(data.full_name).trim() : '';
    return v || null;
  };
  const companyName = async (): Promise<string | null> => {
    const { data } = await supabase
      .from('companies')
      .select('company_name')
      .eq('user_id', userId)
      .maybeSingle();
    const v = data?.company_name ? String(data.company_name).trim() : '';
    return v || null;
  };
  try {
    if (audience === 'employer' || (!audience && EMPLOYER_EVENTS.has(templateKey))) {
      return (await companyName()) || (await profileName());
    }
    if (audience === 'jobseeker' || (!audience && JOBSEEKER_EVENTS.has(templateKey))) {
      return (await profileName()) || (await companyName());
    }
    return (await profileName()) || (await companyName());
  } catch (e) {
    console.warn('[fanout] resolveDisplayName failed:', e);
    return null;
  }
}

/**
 * Telegram chat for this login, strictly per side: employer events use the
 * company's linked chat, job-seeker events the person's own chat. The two sides
 * never borrow each other's chat, because each side has its own bot.
 * Only when the side has no chat at all do we fall back to a linked conversation.
 */
async function resolveChatId(
  supabase: any,
  userId: string,
  override?: string | null,
  templateKey?: string,
  audience?: 'employer' | 'jobseeker',
) {
  if (override) return String(override);

  const profileChat = async (): Promise<string | null> => {
    const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('user_id', userId).maybeSingle();
    return data?.telegram_chat_id ? String(data.telegram_chat_id) : null;
  };
  const companyChat = async (): Promise<string | null> => {
    const { data } = await supabase.from('companies').select('telegram_chat_id').eq('user_id', userId).maybeSingle();
    return data?.telegram_chat_id ? String(data.telegram_chat_id) : null;
  };

  const employerSide = audience ? audience === 'employer' : templateKey ? EMPLOYER_EVENTS.has(templateKey) : false;
  const own = employerSide ? await companyChat() : await profileChat();
  if (own) return own;


  const { data: convo } = await supabase
    .from('telegram_conversations')
    .select('chat_id')
    .eq('linked_user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return convo?.chat_id ? String(convo.chat_id) : null;
}


// --------------------------------------------------------------- DEDUPE ----
// The same app event can reach this fan-out more than once (client trigger +
// database trigger + realtime listener), which used to deliver 2-3 identical
// emails / Telegram messages. A short-lived claim in notification_dedupe makes
// sure one event = one message per channel.
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** true = this channel may send; false = an identical message just went out. */
export async function claimSend(
  supabase: any,
  userId: string,
  channel: 'email' | 'telegram' | 'push' | 'whatsapp',
  templateKey: string,
  content: string,
): Promise<boolean> {
  try {
    const key = `${channel}:${userId}:${templateKey}:${await sha256Hex(content)}`;
    const { error } = await supabase
      .from('notification_dedupe')
      .insert({ dedupe_key: key, user_id: userId, channel, template_key: templateKey });
    if (!error) return true;

    // Key already claimed — allow again only once the window has passed.
    const { data: existing } = await supabase
      .from('notification_dedupe')
      .select('created_at')
      .eq('dedupe_key', key)
      .maybeSingle();
    const age = existing?.created_at ? Date.now() - new Date(existing.created_at).getTime() : Infinity;
    if (age < DEDUPE_WINDOW_MS) {
      console.log(`[fanout] duplicate ${channel} skipped (${templateKey})`);
      return false;
    }
    await supabase
      .from('notification_dedupe')
      .update({ created_at: new Date().toISOString() })
      .eq('dedupe_key', key);
    return true;
  } catch (err) {
    console.error('[fanout] dedupe check failed, sending anyway:', err);
    return true;
  }
}

// ------------------------------------------------- PER-USER CHANNEL OPT-IN --
// Job seekers and employers each own their channel switches:
//   email    -> user_settings.email_notifications / employer_settings.email_notifications
//   telegram -> profiles.telegram_notifications_enabled / companies.telegram_notifications_enabled
// A switch that is explicitly off blocks that channel until the user turns it
// back on. Missing rows mean "not configured yet" and stay allowed.

/** true = employer-side event (greets/uses the company account). */
export const isEmployerEvent = (templateKey: string) => EMPLOYER_EVENTS.has(templateKey);

export async function isEmailChannelAllowed(
  supabase: any,
  userId: string,
  templateKey: string,
  audience?: 'employer' | 'jobseeker',
): Promise<boolean> {
  try {
    const employerSide = audience ? audience === 'employer' : isEmployerEvent(templateKey);
    const own = employerSide ? 'employer_settings' : 'user_settings';
    const other = employerSide ? 'user_settings' : 'employer_settings';
    const read = async (table: string) => {
      const { data } = await supabase
        .from(table)
        .select('email_notifications')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    };
    // The side that owns the event decides. When that side has no row yet
    // (e.g. a job seeker who just added a company), fall back to the other
    // side's switch instead of silently assuming "on" or "off".
    const ownRow = await read(own);
    if (ownRow) return ownRow.email_notifications !== false;
    const otherRow = await read(other);
    if (otherRow) return otherRow.email_notifications !== false;
    return true;
  } catch (err) {
    console.warn('[fanout] email preference lookup failed, allowing:', err);
    return true;
  }
}

export async function isTelegramChannelAllowed(
  supabase: any,
  userId: string,
  templateKey: string,
  audience?: 'employer' | 'jobseeker',
): Promise<boolean> {
  try {
    const profileRow = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_notifications_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    };
    const companyRow = async () => {
      const { data } = await supabase
        .from('companies')
        .select('telegram_notifications_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    };

    // Each side owns its own switch. Only when that side has no row yet do we
    // read the other side's switch, so one side can never silence the other.
    const employerSide = audience ? audience === 'employer' : isEmployerEvent(templateKey);
    const own = employerSide ? await companyRow() : await profileRow();
    if (own) return own.telegram_notifications_enabled !== false;
    const other = employerSide ? await profileRow() : await companyRow();
    if (other) return other.telegram_notifications_enabled !== false;
    return true;
  } catch (err) {
    console.warn('[fanout] telegram preference lookup failed, allowing:', err);
    return true;
  }
}


/**
 * Fill the placeholders saved templates use but callers rarely pass:
 * date/time/year/site from the clock, and name/email/mobile/company from the
 * recipient's profile or company row. Caller-supplied values always win.
 */
export async function enrichTemplateValues(
  supabase: any,
  args: {
    userId: string;
    templateKey?: string;
    employerSide?: boolean;
    values?: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = { ...(args.values ?? {}) };
  const employerSide = args.employerSide ?? (args.templateKey ? isEmployerEvent(args.templateKey) : false);

  const now = new Date();
  const IST = 'Asia/Kolkata';
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(now).toUpperCase();
  if (!values.date) values.date = date;
  if (!values.time) values.time = time;
  if (!values.datetime) values.datetime = `${date} ${time}`;
  if (!values.year) values.year = new Intl.DateTimeFormat('en-GB', { timeZone: IST, year: 'numeric' }).format(now);
  if (!values.site) values.site = WEBSITE_DOMAIN;

  if (!args.userId) return values;

  const passedName = typeof values.name === 'string' ? values.name.trim() : '';
  if (!passedName) {
    const resolvedName = await resolveDisplayName(
      supabase,
      args.userId,
      args.templateKey ?? '',
      employerSide ? 'employer' : 'jobseeker',
    );
    if (resolvedName) values.name = resolvedName;
    else delete values.name;
  }

  const has = (k: string) => typeof values[k] === 'string' ? String(values[k]).trim().length > 0 : values[k] != null;
  if (!has('email') || !has('mobile') || !has('whatsapp') || !has('company')) {
    try {
      const [{ data: prof }, { data: comp }] = await Promise.all([
        supabase.from('profiles').select('email, phone, whatsapp_number').eq('user_id', args.userId).maybeSingle(),
        supabase.from('companies').select('email, phone, whatsapp_number, company_name').eq('user_id', args.userId).maybeSingle(),
      ]);
      const pick = (...vals: unknown[]) => {
        for (const v of vals) {
          const s = typeof v === 'string' ? v.trim() : '';
          if (s) return s;
        }
        return '';
      };
      const email = pick(employerSide ? comp?.email : prof?.email, employerSide ? prof?.email : comp?.email);
      const mobile = pick(employerSide ? comp?.phone : prof?.phone, employerSide ? prof?.phone : comp?.phone);
      const whatsapp = pick(
        employerSide ? comp?.whatsapp_number : prof?.whatsapp_number,
        employerSide ? prof?.whatsapp_number : comp?.whatsapp_number,
        mobile,
      );
      const company = pick(comp?.company_name);
      if (!has('email') && email) values.email = email;
      if (!has('mobile') && mobile) values.mobile = mobile;
      if (!has('whatsapp') && whatsapp) values.whatsapp = whatsapp;
      if (!has('company') && company) values.company = company;
    } catch (e) {
      console.warn('[fanout] recipient placeholder lookup failed:', e);
    }
  }

  return values;
}

export async function fanoutLifecycleChannels(
  supabase: any,
  args: {
    userId: string;
    templateKey: string;
    variables?: Record<string, unknown>;
    email?: string | null;
    chatId?: string | null;
    fallbackTitle?: string;
    fallbackMessage?: string;
    /** Limit delivery to these channels (default: both). */
    channels?: Array<'email' | 'telegram' | 'whatsapp'>;
    /**
     * Which side of the product the event belongs to. Callers that already know
     * (the queue's catalog, for example) pass it so the mailbox set and the
     * ban-check side match; otherwise it is guessed from the event key.
     */
    audience?: 'employer' | 'jobseeker';
    /** Subscribe / unsubscribe confirmations must ignore the user's switches. */
    bypassPreferences?: boolean;
    /** Server-rendered markup allowed to remain HTML inside saved templates. */
    trustedHtmlVariables?: string[];
  },
): Promise<FanoutResult> {
  const result: FanoutResult = { email: 'skipped', telegram: 'skipped', whatsapp: 'skipped', errors: [] };
  const { userId, templateKey } = args;
  if (!userId || !templateKey) return result;

  const employerSide = args.audience ? args.audience === 'employer' : isEmployerEvent(templateKey);

  // Banned users receive no Email/Telegram until unbanned. The ban/unban
  // lifecycle messages themselves are exempt so the user is still informed.
  if (
    !args.bypassPreferences &&
    !isBanExemptEvent(templateKey) &&
    (await isUserBanned(supabase, userId, {
      side: employerSide ? 'employer' : 'job_seeker',
      checkAuth: true,
    }))
  ) {
    console.log(`[fanout] ${templateKey} blocked — user ${userId} is banned`);
    result.email = 'opted_out';
    result.telegram = 'opted_out';
    result.whatsapp = 'opted_out';
    return result;
  }

  const values = await enrichTemplateValues(supabase, {
    userId,
    templateKey,
    employerSide,
    values: { ...(args.variables ?? {}) },
  });


  // Payment Success/Failed/Refund emails are sent only by razorpay-webhook (paymentStatusEmail.ts).
  const wantEmail = (!args.channels || args.channels.includes('email')) && !WEBHOOK_PAYMENT_EMAILS.has(templateKey);
  const wantTelegram = !args.channels || args.channels.includes('telegram');


  const [emailTpl, tgTpl] = await Promise.all([
    wantEmail ? loadTemplate(supabase, 'email_lifecycle_templates', templateKey) : null,
    wantTelegram ? loadTemplate(supabase, 'telegram_lifecycle_templates', templateKey) : null,
  ]);

  // ---------------------------------------------------------------- EMAIL ---
  if (!wantEmail) {
    result.email = 'skipped';
  } else if (!emailTpl) {
    result.email = 'no_template';
  } else if (emailTpl.enabled === false) {
    result.email = 'disabled';
  } else if (!args.bypassPreferences && !(await isEmailChannelAllowed(
    supabase,
    userId,
    templateKey,
    employerSide ? 'employer' : 'jobseeker',
  ))) {
    result.email = 'opted_out';
  } else {
    try {
      const to = await resolveEmail(
        supabase,
        userId,
        args.email,
        templateKey,
        employerSide ? 'employer' : 'jobseeker',
      );
      if (!to) {
        result.email = 'no_recipient';
      } else {
        const subject =
          fill(emailTpl.subject ?? emailTpl.title, values) || args.fallbackTitle || 'Workly India';
        result.subject = subject;
        const bodyTemplate = emailTpl.body || '';
        const bodyText = fill(bodyTemplate, values, {
          escapeValues: templateHasHtml(bodyTemplate),
          trustedHtmlVariables: args.trustedHtmlVariables,
        }) || args.fallbackMessage || '';
        const image = emailTpl.image_url
          ? `<p style="margin:0 0 20px;text-align:center;"><img src="${escapeHtmlAttribute(emailTpl.image_url)}" alt="" style="display:block;width:auto;max-width:100%;height:auto;margin:0 auto;border:0;" /></p>`
          : '';
        // Owner ke email template ke body me hi button hota hai — yahan dusra
        // button add nahi karte, warna mail me do buttons dikhte hain.
        const html = `${image}${renderEmailTemplateHtml(bodyText)}`;

        const sideTemplateKey = `${employerSide ? 'employer' : 'jobseeker'}:${templateKey}`;
        const mayEmail = await claimSend(supabase, userId, 'email', sideTemplateKey, `${to}|${subject}|${bodyText}`);
        const toName = await resolveDisplayName(
          supabase,
          userId,
          templateKey,
          employerSide ? 'employer' : 'jobseeker',
        );
        const { data, error } = mayEmail
          ? await supabase.functions.invoke('email-api/send-email', {
              body: {
                to,
                toName: toName || undefined,
                subject,
                htmlContent: html,
                // Owner template is the complete message body. The shared
                // shell adds branding/footer only, never another title/name.
                templateMode: 'complete',
                // Job-seeker events use the job-seeker mailbox set, employer
                // events the employer one (owner portal → Email Templates).
                audience: employerSide ? 'employer' : 'jobseeker',
              },
            })
          : { data: null, error: null };
        if (!mayEmail) {
          result.email = 'skipped';
        } else if (error || data?.success === false) {
          result.email = 'failed';
          const detail = error?.message || data?.error || 'unknown error';
          result.errors.push(`email: ${detail}`);
          console.error(`[fanout] email failed (${templateKey}):`, detail);
        } else {
          result.email = 'sent';
        }
      }
    } catch (err) {
      result.email = 'failed';
      const detail = err instanceof Error ? err.message : String(err);
      result.errors.push(`email: ${detail}`);
      console.error(`[fanout] email error (${templateKey}):`, detail);
    }
  }

  // ------------------------------------------------------------- TELEGRAM ---
  if (!wantTelegram) {
    result.telegram = 'skipped';
  } else if (!tgTpl) {
    result.telegram = 'no_template';
  } else if (tgTpl.enabled === false) {
    result.telegram = 'disabled';
  } else if (!args.bypassPreferences && !(await isTelegramChannelAllowed(
    supabase,
    userId,
    templateKey,
    employerSide ? 'employer' : 'jobseeker',
  ))) {
    result.telegram = 'opted_out';
  } else {
    try {
      const chatId = await resolveChatId(
        supabase,
        userId,
        args.chatId,
        templateKey,
        employerSide ? 'employer' : 'jobseeker',
      );
      if (!chatId) {
        result.telegram = 'no_recipient';
      } else {
        const title = fill(tgTpl.title ?? tgTpl.subject, values) || args.fallbackTitle || 'Workly India';
        const bodyTemplate = tgTpl.body || '';
        const bodyText = fill(bodyTemplate, values, {
          escapeValues: templateHasHtml(bodyTemplate),
          trustedHtmlVariables: args.trustedHtmlVariables,
        }) || args.fallbackMessage || '';
        const telegramBody = renderTelegramTemplateHtml(bodyText);
        const telegramText = [`<b>${escapeHtml(title)}</b>`, telegramBody].filter(Boolean).join('\n\n');
        const label = (tgTpl.button_text || '').trim();
        const sideTemplateKey = `${employerSide ? 'employer' : 'jobseeker'}:${templateKey}`;
        const mayTelegram = await claimSend(supabase, userId, 'telegram', sideTemplateKey, `${chatId}|${title}|${bodyText}`);
        const { data, error } = mayTelegram
          ? await supabase.functions.invoke('email-api/telegram', {
              body: {
                action: 'send',
                // Job-seeker messages job seekers bot se, employer messages
                // employers bot se — chat id se guess nahi hota.
                audience: employerSide ? 'employer' : 'job_seeker',
                chat_id: chatId,
                text: telegramText,
                parse_mode: 'HTML',
                photo_url: tgTpl.image_url || undefined,
                button_text: label || undefined,
                button_url: label ? absoluteUrl(tgTpl.button_url) : undefined,
              },
            })
          : { data: null, error: null };
        if (!mayTelegram) {
          result.telegram = 'skipped';
        } else if (error || data?.success === false) {
          result.telegram = 'failed';
          const detail = error?.message || data?.error || 'unknown error';
          result.errors.push(`telegram: ${detail}`);
          console.error(`[fanout] telegram failed (${templateKey}):`, detail);
        } else {
          result.telegram = 'sent';
        }
      }
    } catch (err) {
      result.telegram = 'failed';
      const detail = err instanceof Error ? err.message : String(err);
      result.errors.push(`telegram: ${detail}`);
      console.error(`[fanout] telegram error (${templateKey}):`, detail);
    }
  }

  // ------------------------------------------------------------- WHATSAPP ---
  if ((!args.channels || args.channels.includes('whatsapp')) && !WEBHOOK_PAYMENT_EMAILS.has(templateKey)) {
    const sideKey = `${employerSide ? 'employer' : 'jobseeker'}:${templateKey}`;
    const may = await claimSend(supabase, userId, 'whatsapp', sideKey, JSON.stringify(values));
    if (may) {
      const wa = await sendLifecycleWhatsApp(supabase, { userId, templateKey, employerSide, values });
      result.whatsapp = wa.status;
      if (wa.error) result.errors.push(`whatsapp: ${wa.error}`);
    }
  }

  return result;
}

// ------------------------------------------------ DUAL-PROFILE FAN-OUT ------
// One login can own BOTH a job-seeker profile and a company. Events that belong
// to neither side (payments, wallet, referrals, plan expiry, greetings that are
// not side-specific) used to be delivered to one side only, so the other profile
// never received anything. For those events we deliver to both sides, each with
// its own switches, mailbox and Telegram bot — and only when that side actually
// has a different address / chat, so nothing arrives twice.

/** Event that belongs to neither the job-seeker nor the employer side. */
export const isNeutralEvent = (templateKey: string) =>
  !EMPLOYER_EVENTS.has(templateKey) && !JOBSEEKER_EVENTS.has(templateKey);

const betterStatus = (a: FanoutStatus, b: FanoutStatus): FanoutStatus => {
  const rank: Record<FanoutStatus, number> = {
    sent: 6, failed: 5, no_recipient: 4, opted_out: 3, disabled: 2, no_template: 1, skipped: 0,
  };
  return rank[b] > rank[a] ? b : a;
};

export async function fanoutLifecycleBothSides(
  supabase: any,
  args: Parameters<typeof fanoutLifecycleChannels>[1],
): Promise<FanoutResult> {
  const { userId, templateKey } = args;
  if (!userId || !templateKey) return { email: 'skipped', telegram: 'skipped', errors: [] };

  // An explicit audience or a side-specific event keeps the single-side behaviour.
  if (args.audience || !isNeutralEvent(templateKey)) {
    return fanoutLifecycleChannels(supabase, args);
  }

  const [{ data: prof }, { data: comp }] = await Promise.all([
    supabase.from('profiles').select('email, telegram_chat_id').eq('user_id', userId).maybeSingle(),
    supabase.from('companies').select('email, telegram_chat_id').eq('user_id', userId).maybeSingle(),
  ]);

  if (!prof || !comp) {
    return fanoutLifecycleChannels(supabase, {
      ...args,
      audience: !prof && comp ? 'employer' : 'jobseeker',
    });
  }

  const jobSeeker = await fanoutLifecycleChannels(supabase, { ...args, audience: 'jobseeker' });

  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const wanted = args.channels ?? ['email', 'telegram'];
  const employerChannels: Array<'email' | 'telegram'> = [];
  if (wanted.includes('email') && norm(comp.email) && norm(comp.email) !== norm(prof.email)) {
    employerChannels.push('email');
  }
  if (
    wanted.includes('telegram') &&
    norm(comp.telegram_chat_id) &&
    norm(comp.telegram_chat_id) !== norm(prof.telegram_chat_id)
  ) {
    employerChannels.push('telegram');
  }
  if (employerChannels.length === 0) return jobSeeker;

  const employer = await fanoutLifecycleChannels(supabase, {
    ...args,
    audience: 'employer',
    channels: employerChannels,
  });

  return {
    email: betterStatus(jobSeeker.email, employer.email),
    telegram: betterStatus(jobSeeker.telegram, employer.telegram),
    errors: [...jobSeeker.errors, ...employer.errors],
    subject: jobSeeker.subject ?? employer.subject,
  };
}
