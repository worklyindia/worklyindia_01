/**
 * Auth email templates — the messages Supabase's "Send email" auth hook delivers.
 *
 * By default Supabase sends its own verification, password-reset and sign-in
 * emails from a small shared mail server with a very low hourly cap, which is
 * what users hit as "Too many attempts. Try later". When the hook is turned on
 * in Supabase (Authentication → Hooks → Send email), GoTrue stops sending the
 * mail itself and instead calls the auth-email-hook Edge Function with the
 * token and link, so the message can be built from the owner's own templates
 * (Owner Portal → Email Templates) and delivered through the owner's mailbox.
 *
 * Action links remain internal compatibility data only. Delivered messages
 * show a single-line OTP, personalized instructions and the shared expiry.
 */

import { escapeHtml, escapeHtmlAttribute, renderEmailTemplateHtml, templateHasHtml } from './templateHtml.ts';

// --------------------------------------------------------------- PAYLOAD ---

/** `email_data` as Supabase sends it (see mailer.EmailData). */
export interface AuthHookEmailData {
  /** One-time code, when the flow has one. */
  token?: string;
  /** Hashed token for the address this action belongs to. */
  token_hash?: string;
  /** Page the app should land on after the link is clicked. */
  redirect_to?: string;
  /** signup | invite | magiclink | recovery | email_change | ... */
  email_action_type?: string;
  /** Supabase's own external address, e.g. https://<ref>.supabase.co/auth/v1 */
  site_url?: string;
  token_new?: string;
  /** Hashed token for the address the account is currently confirmed with. */
  token_hash_new?: string;
  old_email?: string;
  new_email?: string;
  provider?: string;
  factor_type?: string;
}

export interface AuthHookUser {
  /** Present on every real hook call; optional so a partial payload still parses. */
  id?: string;
  email?: string | null;
  phone?: string | null;
  /** Address the account is being changed to (models.User `new_email`). */
  new_email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

export interface AuthHookPayload {
  user?: AuthHookUser;
  email_data?: AuthHookEmailData;
  metadata?: unknown;
}

// ------------------------------------------------------------- TEMPLATES ---

/** Template keys the owner can edit in Owner Portal → Email Templates. */
export type AuthTemplateKey =
  | 'email_verification'
  | 'password_reset'
  | 'magic_link'
  | 'email_change_new'
  | 'email_change_current';

export const AUTH_TEMPLATE_KEYS: AuthTemplateKey[] = [
  'email_verification',
  'password_reset',
  'magic_link',
  'email_change_new',
  'email_change_current',
];

// Light-mode baseline text lets Gmail apply its native dark-mode conversion.
// Never paint a panel behind the content: the mail client owns that surface.
const HEADING = '#111827';
const TEXT = '#374151';
const BRAND = '#2563eb';

// Keep custom email OTP storage aligned with Supabase Auth's hosted OTP setting.
export const AUTH_OTP_EXPIRY_SECONDS = 300;
export const authOtpExpiresAt = (issuedAt: number): number => issuedAt + AUTH_OTP_EXPIRY_SECONDS * 1000;

const para = (value: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;text-align:center;color:${TEXT};">${value}</p>`;

const heading = (value: string) =>
  `<h1 style="margin:0 0 24px;font-size:24px;line-height:1.35;font-weight:700;letter-spacing:0;text-align:center;color:${HEADING};">${value}</h1>`;

const note = (value: string) =>
  `<p style="margin:0;font-size:15px;line-height:1.75;text-align:center;color:${TEXT};">${value}</p>`;

const otpCode = () =>
  `<div style="margin:24px 0;padding:16px 0;border-top:1px solid ${HEADING};border-bottom:1px solid ${HEADING};text-align:center;"><span style="display:inline-block;font-family:Menlo,Consolas,'Courier New',monospace;font-size:36px;font-weight:700;line-height:1.4;letter-spacing:0;white-space:nowrap;word-break:normal;overflow-wrap:normal;color:${BRAND};">{{otp}}</span></div>`;

const signoff =
  `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;text-align:center;color:${TEXT};">Workly India security team</p>`;

const otpEmail = (title: string, introduction: string, instruction: string, safety: string) =>
  `<div style="margin:0 auto;max-width:520px;padding:28px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">` +
  heading(title) + para('Hi {{name}},') + para(introduction) + otpCode() +
  para(instruction) + para(`This code expires in <strong>${AUTH_OTP_EXPIRY_SECONDS / 60} minutes</strong> after it is requested and can be used <strong>only once</strong>. If it has expired, request a new code from the same screen and use the latest email.`) +
  note(safety) + para('Keep this code private. Workly India will never ask you to share your code by phone, email or chat.') + signoff + `</div>`;

/**
 * Built-in copy used when the owner has not saved a template for an action (or
 * switched it off). Auth emails are load-bearing — a missing template must
 * never stop a signup or a password reset, so these stay in the code.
 */
export const AUTH_EMAIL_DEFAULTS: Record<AuthTemplateKey, { subject: string; html: string }> = {
  email_verification: {
    subject: '{{otp}} is your Workly India verification code',
    html: otpEmail('Your verification code', 'Welcome to Workly India. Please verify your email address to continue securely with your account.', 'Enter the code above on the email verification screen to confirm that this email address belongs to you.', 'If you did not create an account or request this verification, you can safely ignore this email.'),
  },
  password_reset: {
    subject: '{{otp}} is your Workly India password reset code',
    html: otpEmail('Password reset code', 'We received a request to reset the password for your Workly India account. Use the verification code below to continue.', 'Enter this code on the password reset screen. After verification, choose a new, strong password for your account.', 'If you did not request a password reset, ignore this email. Your password stays unchanged unless you complete the reset.'),
  },
  magic_link: {
    subject: '{{otp}} is your Workly India sign-in code',
    html: otpEmail('Your sign-in code', 'Use the code below to confirm your identity and securely continue signing in to your Workly India account.', 'Enter this code on the sign-in or security verification screen where you requested it.', 'If you did not request this code, do not use or share it. Review your account security if you notice unfamiliar activity.'),
  },
  email_change_new: {
    subject: '{{otp}} confirms your new Workly India email',
    html: otpEmail('New email code', 'You requested to use this email address for your Workly India account. Please confirm your new address with the code below.', 'Enter this code in the new-email field on the email-change verification screen. You may also need to confirm the code sent to your current email.', 'If you did not request this email change, ignore this email and do not share this code.'),
  },
  email_change_current: {
    subject: '{{otp}} confirms your Workly India email change',
    html: otpEmail('Current email code', 'We received a request to change your Workly India account email to {{new_email}}. Confirm this request using the code below.', 'Enter this code in the current-email field on the email-change screen. Use the separate code sent to your new address to verify that address too.', 'If you did not request this change, do not use or share this code. Reset your password and review your account security immediately.'),
  },
};

/** Which owner template each Supabase auth action is delivered with. */
const TEMPLATE_BY_ACTION: Record<string, AuthTemplateKey> = {
  signup: 'email_verification',
  invite: 'email_verification',
  email: 'email_verification',
  recovery: 'password_reset',
  magiclink: 'magic_link',
  reauthentication: 'magic_link',
  email_change_new: 'email_change_new',
  email_change_current: 'email_change_current',
};

export const templateKeyForAction = (action: string | undefined): AuthTemplateKey =>
  TEMPLATE_BY_ACTION[String(action ?? '').trim().toLowerCase()] ?? 'email_verification';

/** The `type` the /verify endpoint expects for an action. */
const linkTypeForAction = (action: string): string =>
  action === 'email_change_new' || action === 'email_change_current' ? 'email_change' : action;

// ----------------------------------------------------------------- LINK ---

/**
 * Rebuild the verification link exactly as GoTrue does. `site_url` already
 * points at Supabase's auth endpoint; when it is missing or has no /auth/v1
 * suffix we fall back to the project URL so the link still resolves.
 */
export const buildActionLink = (input: {
  siteUrl?: string;
  supabaseUrl: string;
  tokenHash: string;
  action: string;
  redirectTo?: string;
}): string => {
  const raw = String(input.siteUrl ?? '').replace(/\/+$/, '');
  const base = /\/auth\/v1$/i.test(raw)
    ? raw
    : /^https?:\/\//i.test(raw)
      ? `${raw}/auth/v1`
      : `${String(input.supabaseUrl ?? '').replace(/\/+$/, '')}/auth/v1`;

  const params = new URLSearchParams({ token: input.tokenHash, type: linkTypeForAction(input.action) });
  const redirect = String(input.redirectTo ?? '').trim();
  if (redirect) params.set('redirect_to', redirect);
  return `${base}/verify?${params.toString()}`;
};

// ----------------------------------------------------------------- FILL ---

/** Replace {{variable}} placeholders; empty values leave nothing behind. */
export const fill = (
  template: string,
  values: Record<string, string | undefined>,
  options?: { escapeValues?: boolean },
): string =>
  String(template ?? '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = values[String(key).toLowerCase()];
    const value = raw === undefined || raw === null ? '' : String(raw);
    if (!value) return '';
    return options?.escapeValues ? escapeHtml(value) : value;
  });

/**
 * Read the hook request body. Anything that is not a JSON object carrying an
 * `email_data` block is refused — a malformed call must never reach the mailer.
 */
export const parseAuthHookPayload = (raw: string): AuthHookPayload | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const body = parsed as Record<string, unknown>;
  const emailData = body.email_data;
  if (!emailData || typeof emailData !== 'object' || Array.isArray(emailData)) return null;

  const user = body.user;
  if (user !== undefined && user !== null && (typeof user !== 'object' || Array.isArray(user))) return null;

  return {
    email_data: emailData as AuthHookEmailData,
    user: (user ?? undefined) as AuthHookUser | undefined,
    metadata: body.metadata,
  };
};

// --------------------------------------------------------------- PLANS ---

/** One email the hook has to deliver. */
export interface AuthEmailPlan {
  to: string;
  templateKey: AuthTemplateKey;
  link: string;
  otp: string;
  /** The one-time token this email carries; used as the send's idempotency key. */
  tokenHash: string;
  newEmail: string;
  oldEmail: string;
}

const clean = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/**
 * Work out which emails a hook call stands for.
 *
 * A secure email change is one hook call but two emails: the address being
 * moved to gets `token_hash`, the address the account uses today gets
 * `token_hash_new` (Supabase names these the other way round on purpose — see
 * the note in internal/api/mail.go).
 */
export const planAuthEmails = (
  payload: AuthHookPayload,
  supabaseUrl: string,
  resolvedNewEmail?: string,
): AuthEmailPlan[] => {
  const data: AuthHookEmailData = payload.email_data ?? {};
  const user: AuthHookUser = payload.user ?? {};
  const action = clean(data.email_action_type).toLowerCase();

  const currentEmail = (action === 'email_change' ? clean(data.old_email) : '') || clean(user.email);
  const newEmail = clean(resolvedNewEmail) || clean(data.new_email) || clean(user.new_email);
  const otp = clean(data.token);

  const link = (hash: string, type: string) =>
    buildActionLink({
      siteUrl: data.site_url,
      supabaseUrl,
      tokenHash: hash,
      action: type,
      redirectTo: data.redirect_to,
    });

  const plans: AuthEmailPlan[] = [];

  if (action === 'email_change') {
    const target = newEmail || currentEmail;
    if (target && clean(data.token_hash)) {
      plans.push({
        to: target,
        templateKey: 'email_change_new',
        link: link(clean(data.token_hash), 'email_change'),
        // GoTrue secure-change payload crosses OTP and hash names:
        // token_new belongs to the new address, token_hash belongs to it too.
        otp: clean(data.token_new) || otp,
        tokenHash: clean(data.token_hash),
        newEmail: target,
        oldEmail: currentEmail,
      });
    }
    if (newEmail && currentEmail && clean(data.token_hash_new)) {
      plans.push({
        to: currentEmail,
        templateKey: 'email_change_current',
        link: link(clean(data.token_hash_new), 'email_change'),
        otp,
        tokenHash: clean(data.token_hash_new),
        newEmail,
        oldEmail: currentEmail,
      });
    }
    return plans;
  }

  const to = currentEmail;
  const hash = clean(data.token_hash);
  if (!to || (!hash && !otp)) return plans;

  plans.push({
    to,
    templateKey: templateKeyForAction(action),
    link: hash ? link(hash, action) : '',
    otp,
    tokenHash: hash,
    newEmail,
    oldEmail: clean(data.old_email),
  });
  return plans;
};

/**
 * Render one planned email with the owner's saved template (falling back to the
 * built-in copy) and hand it to the shared sender.
 */
export const renderAuthEmail = (input: {
  plan: AuthEmailPlan;
  name: string;
  saved?: { subject?: string | null; body?: string | null; image_url?: string | null; enabled?: boolean } | null;
}): { subject: string; html: string } => {
  const fallback = AUTH_EMAIL_DEFAULTS[input.plan.templateKey];
  // A template the owner switched off falls back to the built-in copy instead
  // of dropping the mail: a signup or password reset must never stop silently.
  const saved = input.saved && input.saved.enabled === false ? null : input.saved;

  const values: Record<string, string> = {
    name: clean(input.name) || 'there',
    email: input.plan.to,
    otp: input.plan.otp,
    confirm_link: input.plan.link,
    new_email: input.plan.newEmail,
    old_email: input.plan.oldEmail,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    time: new Date().toLocaleTimeString('en-IN', { hour12: true, timeZone: 'Asia/Kolkata' }),
  };

  const subjectTemplate = clean(saved?.subject) || fallback.subject;
  // Auth actions are code-only by design. Owner copy may change the subject,
  // but an old saved link/button template must never put a clickable action
  // back into a security email.
  const bodyTemplate = fallback.html;
  const escapeValues = templateHasHtml(bodyTemplate);

  const subject = fill(subjectTemplate, values, { escapeValues: false }) || 'Workly India';
  const body = fill(bodyTemplate, values, { escapeValues }) || fallback.html;

  const image = clean(saved?.image_url)
    ? `<p style="margin:0 0 20px;text-align:center;"><img src="${escapeHtmlAttribute(clean(saved?.image_url))}" alt="" style="display:block;width:auto;max-width:100%;height:auto;margin:0 auto;border:0;" /></p>`
    : '';

  return { subject, html: `${image}${renderEmailTemplateHtml(body)}` };
};
