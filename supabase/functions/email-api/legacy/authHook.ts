// Supabase Auth "Send Email" hook — the reason signup, password-reset and
// email-change mails leave from the owner's mailbox and in their own words.
//
// Supabase calls POST /functions/v1/email-api/auth-hook instead of sending an
// auth email itself. The request body carries a one-time token, so the caller
// has to be verified before anything goes out: the shared Standard Webhooks
// HMAC scheme (webhooks.hmacsha256, v1=…), checked against
// SEND_EMAIL_HOOK_SECRET, plus a timestamp window.
//
// Copy and design are read from the same place as every other notification —
// the Owner Portal's Email Templates — so this never writes its own wording.
import {
  parseAuthHookPayload,
  planAuthEmails,
  renderAuthEmail,
  type AuthHookPayload,
} from "../../_shared/authEmailTemplates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const encoder = new TextEncoder();

/** Constant-time compare so a bad signature can't be found by timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Standard Webhooks secret: Supabase stores it as `v1,whsec_<base64>` and the
 * HMAC key is the base64-decoded bytes after the prefix. A bare value is also
 * accepted (treated as raw key material) so an older plain secret still works.
 */
function decodeHookSecret(secret: string): Uint8Array<ArrayBuffer> {
  const match = secret.match(/^v1,whsec_(.+)$/);
  if (!match) return encoder.encode(secret) as Uint8Array<ArrayBuffer>;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Standard Webhooks HMAC-SHA256 over `${id}.${timestamp}.${body}`.
 * The signature header is a space-separated list like `v1,<base64> v1a,…`;
 * any `v1,` entry that matches accepts the request.
 */
async function signatureIsValid(
  body: string,
  secret: string,
  id: string,
  timestamp: string,
  provided: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', decodeHookSecret(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}.${timestamp}.${body}`));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const candidates = provided.split(' ').filter((entry) => entry.startsWith('v1,')).map((entry) => entry.slice(3));
  const expectedBytes = encoder.encode(expectedB64);
  return candidates.some((candidate) => timingSafeEqual(expectedBytes, encoder.encode(candidate)));
}

/**
 * The owner's saved copy for this event, or null when nothing usable is stored.
 * A disabled row is ignored rather than dropping the mail: signups and password
 * resets must never stop silently.
 */
async function loadSavedTemplate(templateKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return null;

  const res = await fetch(`${supabaseUrl}/rest/v1/email_lifecycle_templates?event_type=eq.${encodeURIComponent(templateKey)}&select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row || row.enabled === false) return null;
  if (!String(row.body || '').trim() && !String(row.subject || '').trim()) return null;
  return row;
}

/** Employer or job seeker — decides which connected mailbox the mail leaves from. */
function audienceFor(payload: AuthHookPayload): 'employer' | 'jobseeker' {
  const meta = (payload.user && payload.user.user_metadata) || {};
  return meta.user_type === 'employer' ? 'employer' : 'jobseeker';
}

function nameFor(payload: AuthHookPayload): string {
  const meta = (payload.user && payload.user.user_metadata) || {};
  const candidate = [meta.full_name, meta.name, meta.display_name, meta.company_name]
    .find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof candidate === 'string' ? candidate.trim() : '';
}

/**
 * Hand one planned email to the unified sender (complete mode: it adds the
 * footer and routes through the owner's connected mailbox).
 */
async function deliver(
  plan: ReturnType<typeof planAuthEmails>[number],
  payload: AuthHookPayload,
): Promise<{ sent: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return { sent: false, error: 'backend_env_missing' };

  const saved = await loadSavedTemplate(plan.templateKey);
  const rendered = renderAuthEmail({ plan, name: nameFor(payload), saved });

  const res = await fetch(`${supabaseUrl}/functions/v1/email-api/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    // Field names the unified sender reads: htmlContent is the rendered body,
    // and templateMode "complete" tells the branded shell the owner's template
    // already carries its own greeting and heading (so it only adds the footer).
    body: JSON.stringify({
      to: plan.to,
      toName: nameFor(payload) || undefined,
      subject: rendered.subject,
      htmlContent: rendered.html,
      templateMode: 'complete',
      audience: audienceFor(payload),
    }),
  });

  const text = await res.text();
  if (!res.ok) return { sent: false, error: `send_failed_${res.status}` };
  let parsed: { success?: boolean } = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (parsed.success === false) return { sent: false, error: 'send_rejected' };
  return { sent: true };
}

/** Public project URL — Supabase sends site_url, but never rely on it being present. */
function supabasePublicUrl(): string {
  return (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
}

export const handler = async (req: Request): Promise<Response> => {
  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '';
  if (!secret) {
    // Without a secret we cannot tell Supabase from anyone else, so nothing is sent.
    return json(503, { error: 'hook_not_configured' });
  }

  const body = await req.text();
  const id = req.headers.get('webhook-id') || '';
  const timestamp = req.headers.get('webhook-timestamp') || '';
  const signature = req.headers.get('webhook-signature') || '';

  if (!id || !timestamp || !signature) {
    return json(401, { error: 'missing_webhook_headers' });
  }

  // Reject replays: the token in the body is single use, so a stale request
  // could not work anyway — but it must not reach the mailer either.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 5 * 60) {
    return json(401, { error: 'stale_request' });
  }

  if (!(await signatureIsValid(body, secret, id, timestamp, signature))) {
    return json(401, { error: 'invalid_signature' });
  }

  const payload = parseAuthHookPayload(body);
  if (!payload) return json(400, { error: 'invalid_payload' });

  const plans = planAuthEmails(payload, supabasePublicUrl());
  if (plans.length === 0) return json(422, { error: 'nothing_to_send' });

  // Supabase Auth waits at most 5 seconds for this hook. Sending through the
  // owner's mailbox (Gmail/Outlook/SMTP) can take longer, so the mail is sent
  // in the background and the hook answers as soon as the request is verified.
  const work = Promise.all(plans.map((plan) => deliver(plan, payload).catch((error) => ({
    sent: false,
    error: error instanceof Error ? error.message : String(error),
  })))).then((results) => {
    const failed = results.filter((result) => !result.sent);
    if (failed.length > 0) {
      console.error('[auth-hook] delivery failed', payload.email_data?.email_action_type, failed.map((f) => f.error));
    } else {
      console.log('[auth-hook] delivered', payload.email_data?.email_action_type, results.length);
    }
  });

  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === 'function') {
    waitUntil.call((globalThis as any).EdgeRuntime, work);
  } else {
    await work;
  }

  return json(200, {
    success: true,
    queued: plans.length,
    templates: plans.map((plan) => plan.templateKey),
  });
};
