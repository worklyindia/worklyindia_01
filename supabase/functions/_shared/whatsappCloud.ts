// Shared helpers for Meta WhatsApp Cloud API (replaces MSG91)
import { AsyncLocalStorage } from 'node:async_hooks';

export const GRAPH_VERSION = 'v26.0';
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type Audience = 'job_seeker' | 'employer' | 'customer_service';
export interface CloudConfig { token?: string; phoneNumberId?: string; wabaId?: string; configured: boolean; audience?: Audience | null }

const audienceStore = new AsyncLocalStorage<Audience | null>();

/** Map any incoming value (audience / user_type) to an audience. */
export function toAudience(v: unknown): Audience | null {
  const s = String(v ?? '').toLowerCase();
  if (['customer_service', 'support', 'customer_support'].includes(s)) return 'customer_service';
  if (['employer', 'employers', 'company', 'recruiter'].includes(s)) return 'employer';
  if (['job_seeker', 'jobseeker', 'job_seekers', 'candidate', 'user', 'seeker'].includes(s)) return 'job_seeker';
  return null;
}

/** Run fn with the chosen WhatsApp number (audience) for all helpers inside. */
export function withAudience<T>(audience: Audience | null, fn: () => Promise<T>): Promise<T> {
  return audienceStore.run(audience, fn);
}

export function currentAudience(): Audience | null {
  return audienceStore.getStore() ?? null;
}

const cache = new Map<string, { cfg: CloudConfig; at: number }>();

async function rest(path: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return res.ok ? await res.json() : null;
}

/** Audience account (Embedded Signup) first. Legacy single-account config is only used when no audience was requested. */
export async function loadCloudConfig(force = false, audienceArg?: Audience | null): Promise<CloudConfig> {
  const audience = audienceArg !== undefined ? audienceArg : currentAudience();
  const cacheKey = audience ?? 'default';
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (!force && hit && now - hit.at < 60_000) return hit.cfg;

  let token: string | undefined, phoneNumberId: string | undefined, wabaId: string | undefined;
  try {
    const order: Audience[] = audience ? [audience] : ['job_seeker', 'employer'];
    const rows = await rest(`whatsapp_audience_accounts?select=audience,waba_id,phone_number_id,status,whatsapp_audience_tokens(access_token)&status=eq.connected`) as any[] | null;
    for (const a of order) {
      const r = rows?.find((x) => x.audience === a);
      const t = Array.isArray(r?.whatsapp_audience_tokens) ? r.whatsapp_audience_tokens[0]?.access_token : r?.whatsapp_audience_tokens?.access_token;
      if (r && t && r.phone_number_id && r.waba_id) { token = t; phoneNumberId = r.phone_number_id; wabaId = r.waba_id; break; }
    }
  } catch (e) { console.error('audience account lookup failed', e); }

  if (!token && !audience) {
    token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || undefined;
    phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || undefined;
    wabaId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') || undefined;
  }
  if ((!token || !phoneNumberId || !wabaId) && !audience) {
    try {
      const rows = await rest('app_settings?select=setting_key,setting_value&setting_key=in.(fb_whatsapp_access_token,fb_whatsapp_phone_number_id,fb_whatsapp_waba_id)') as { setting_key: string; setting_value: string | null }[] | null;
      const map = Object.fromEntries((rows ?? []).map((r) => [r.setting_key, r.setting_value || '']));
      token = token || map.fb_whatsapp_access_token || undefined;
      phoneNumberId = phoneNumberId || map.fb_whatsapp_phone_number_id || undefined;
      wabaId = wabaId || map.fb_whatsapp_waba_id || undefined;
    } catch (e) {
      console.error('loadCloudConfig settings lookup failed', e);
    }
  }

  const cfg = { token, phoneNumberId, wabaId, audience, configured: !!(token && phoneNumberId && wabaId) };
  cache.set(cacheKey, { cfg, at: now });
  return cfg;
}

export async function graph(path: string, init: { method?: string; body?: unknown; query?: Record<string, string> } = {}, tokenOverride?: string) {
  const { token: configuredToken } = await loadCloudConfig();
  const token = tokenOverride || configuredToken;
  if (!token) throw new Error('WhatsApp Cloud API access token is not configured');
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error?.error_user_msg || data?.error?.message || `Meta API error ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; details?: unknown };
    err.status = res.status; err.details = data;
    throw err;
  }
  return data;
}

export function normalizePhone(p: string) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

/** Convert {body_1: 'a', body_2: 'b'} or {'1':'a'} or array into ordered values */
export function orderedValues(vars: unknown): string[] {
  if (!vars) return [];
  if (Array.isArray(vars)) return vars.map((v) => String(v ?? ''));
  const entries = Object.entries(vars as Record<string, unknown>)
    .map(([k, v]) => ({ n: parseInt((k.match(/(\d+)/) || [])[1] ?? 'NaN', 10), k, v }));
  const numbered = entries.filter((e) => !isNaN(e.n)).sort((a, b) => a.n - b.n);
  const list = numbered.length ? numbered : entries;
  return list.map((e) => String(e.v ?? ''));
}

export function fillBody(text: string, values: string[]) {
  return (text || '').replace(/\{\{(\d+)\}\}/g, (_, n) => values[Number(n) - 1] ?? `{{${n}}}`);
}

export async function sendMessage(payload: Record<string, unknown>) {
  const { phoneNumberId } = await loadCloudConfig();
  if (!phoneNumberId) throw new Error('WhatsApp Cloud API phone number ID is not configured');
  return graph(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload },
  });
}

export async function sendTemplate(opts: {
  to: string; name: string; language?: string; values?: string[]; category?: string | null; headerValues?: string[];
}) {
  const components: any[] = [];
  const values = opts.values ?? [];
  if (opts.headerValues?.length) {
    components.push({ type: 'header', parameters: opts.headerValues.map((t) => ({ type: 'text', text: t })) });
  }
  if (values.length) {
    components.push({ type: 'body', parameters: values.map((t) => ({ type: 'text', text: t || '-' })) });
  }
  if ((opts.category || '').toUpperCase() === 'AUTHENTICATION' && values[0]) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: values[0] }] });
  }
  return sendMessage({
    to: normalizePhone(opts.to),
    type: 'template',
    template: { name: opts.name, language: { code: opts.language || 'en_US' }, ...(components.length ? { components } : {}) },
  });
}

/** Build Meta template components from app template fields */
export function buildTemplateComponents(t: {
  category?: string; content?: string; header_type?: string | null; header_content?: string | null;
  header_handle?: string | null; footer?: string | null; buttons?: any[]; examples?: string[];
  add_security_recommendation?: boolean; code_expiration_minutes?: number | null; otp_button_text?: string | null;
  otp_type?: string | null; autofill_text?: string | null; zero_tap_terms_accepted?: boolean;
  supported_apps?: Array<{ package_name: string; signature_hash: string }>;
}) {
  const components: any[] = [];
  if ((t.category || '').toUpperCase() === 'AUTHENTICATION') {
    const minutes = Math.min(90, Math.max(1, Number(t.code_expiration_minutes) || 10));
    const otpType = ['ZERO_TAP', 'ONE_TAP'].includes((t.otp_type || '').toUpperCase()) ? t.otp_type!.toUpperCase() : 'COPY_CODE';
    const button: any = { type: 'OTP', otp_type: otpType, text: (t.otp_button_text || 'Copy Code').slice(0, 25) };
    if (otpType !== 'COPY_CODE') {
      const apps = (t.supported_apps || []).filter((a) => a.package_name && a.signature_hash).slice(0, 5);
      if (!apps.length) throw new Error('Autofill needs at least one Android app (package name + 11-character signature hash).');
      if (otpType === 'ZERO_TAP' && !t.zero_tap_terms_accepted) throw new Error('Accept the zero-tap terms to submit this template.');
      button.supported_apps = apps;
      if (t.autofill_text) button.autofill_text = t.autofill_text.slice(0, 25);
      if (otpType === 'ZERO_TAP') button.zero_tap_terms_accepted = true;
    }
    return [
      { type: 'BODY', add_security_recommendation: t.add_security_recommendation !== false },
      ...(t.code_expiration_minutes === null ? [] : [{ type: 'FOOTER', code_expiration_minutes: minutes }]),
      { type: 'BUTTONS', buttons: [button] },
    ];
  }
  const ht = (t.header_type || '').toUpperCase();
  if (ht === 'TEXT' && t.header_content) {
    components.push({ type: 'HEADER', format: 'TEXT', text: t.header_content });
  }
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(ht) && t.header_handle) {
    components.push({ type: 'HEADER', format: ht, example: { header_handle: [t.header_handle] } });
  }
  const body: any = { type: 'BODY', text: t.content || '' };
  const count = new Set((t.content || '').match(/\{\{\d+\}\}/g) || []).size;
  if (count) {
    const ex = Array.from({ length: count }, (_, i) => t.examples?.[i] || `Sample${i + 1}`);
    body.example = { body_text: [ex] };
  }
  components.push(body);
  if (t.footer) components.push({ type: 'FOOTER', text: t.footer });
  if (t.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: t.buttons.map((b: any) =>
        b.type === 'URL' ? { type: 'URL', text: b.text, url: b.url }
          : b.type === 'PHONE_NUMBER' ? { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number }
          : { type: 'QUICK_REPLY', text: b.text }),
    });
  }
  return components;
}

const MEDIA_LIMITS: Record<string, number> = {
  'image/jpeg': 5, 'image/png': 5, 'video/mp4': 16, 'application/pdf': 15,
};

/** Uploads a header sample to Meta (Resumable Upload API) and returns the header handle. */
export async function uploadTemplateMedia(token: string, appId: string, dataUrl: string) {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Choose a JPG/PNG image, MP4 video or PDF file.');
  const type = match[1].toLowerCase();
  const limit = MEDIA_LIMITS[type];
  if (!limit) throw new Error('Only JPG, PNG, MP4 or PDF files are allowed.');
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  if (bytes.byteLength > limit * 1024 * 1024) throw new Error(`File must be under ${limit} MB.`);
  const sessionUrl = new URL(`https://graph.facebook.com/v21.0/${appId}/uploads`);
  sessionUrl.searchParams.set('file_length', String(bytes.byteLength));
  sessionUrl.searchParams.set('file_type', type);
  sessionUrl.searchParams.set('file_name', type === 'application/pdf' ? 'template.pdf' : 'template-media');
  const sRes = await fetch(sessionUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const session = await sRes.json().catch(() => ({}));
  if (!sRes.ok || !session.id) throw new Error(session?.error?.message || 'Meta could not start the upload.');
  const up = await fetch(`https://graph.facebook.com/v21.0/${session.id}`, {
    method: 'POST', headers: { Authorization: `OAuth ${token}`, file_offset: '0', 'Content-Type': type }, body: bytes,
  });
  const result = await up.json().catch(() => ({}));
  if (!up.ok || !result.h) throw new Error(result?.error?.message || 'Meta could not upload the file.');
  return result.h as string;
}
