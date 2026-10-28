// Atomically consumes one call from the user's monthly API quota (see public.consume_api_call).
export type QuotaResult = { allowed: boolean; used: number; limit: number; remaining: number };

export const API_LIMIT_MESSAGE = 'API call limit reached. Free calls are added every month for active subscribers; unused calls carry forward.';

// When the balance runs low, ask create-api-subscription to auto-debit a top-up
// (fire-and-forget; the server re-checks threshold, mandate and cooldown).
function maybeAutoTopUp(db: any, userId: string, remaining: number) {
  if (remaining >= 10000) return;
  try {
    const p = db.functions.invoke('create-api-subscription', {
      body: { action: 'topup_check', user_id: userId },
      headers: { 'x-topup-secret': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' },
    });
    p?.catch?.((e: unknown) => console.error('auto top-up check failed', e));
  } catch (e) {
    console.error('auto top-up check failed', e);
  }
}

const SECRET_KEY = /pass|secret|token|api[_-]?key|authorization|pin|otp/i;
function redact(v: unknown, depth = 0): unknown {
  if (depth > 4) return '[…]';
  if (typeof v === 'string') return v.length > 300 ? `${v.slice(0, 300)}… (${v.length} chars)` : v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 50)
      .map(([k, x]) => [k, SECRET_KEY.test(k) ? '[hidden]' : redact(x, depth + 1)]));
  }
  return v;
}

// Derives "<service>:<action>" from any request, so new services get a real log name automatically.
async function describeRequest(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const fnIdx = parts.indexOf('v1');
  const service = (fnIdx >= 0 ? parts[fnIdx + 1] : parts[0]) || 'api';
  const sub = parts.slice(fnIdx >= 0 ? fnIdx + 2 : 1);
  let body: any = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try { const t = await req.clone().text(); body = t ? JSON.parse(t) : null; } catch { body = null; }
  }
  const query = Object.fromEntries(url.searchParams);
  const action = (typeof body?.action === 'string' && body.action) || query.action || sub.join('/') || 'request';
  return {
    endpoint: `${service}:${action}`.slice(0, 200),
    method: req.method,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || null,
    ua: req.headers.get('user-agent'),
    params: { action, service, path: url.pathname, query: redact(query), body: redact(body) },
  };
}

export async function consumeApiCall(db: any, userId: string, req?: Request): Promise<QuotaResult> {
  const { data, error } = await db.rpc('consume_api_call', { _user_id: userId });
  if (error || !data) {
    console.error('consume_api_call failed', error);
    return { allowed: false, used: 0, limit: 0, remaining: 0 };
  }
  const result = data as QuotaResult;
  if (result.allowed) {
    maybeAutoTopUp(db, userId, result.remaining);
    if (req) {
      try {
        const d = await describeRequest(req);
        const { data: row } = await db.from('api_request_logs').select('id')
          .eq('endpoint', 'api-call').eq('request_params->>user_id', userId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (row?.id) {
          chargedLogs.set(req, { db, id: row.id });
          await db.from('api_request_logs').update({
            endpoint: d.endpoint, method: d.method, ip_address: d.ip, user_agent: d.ua,
            request_params: { auto_charged: true, user_id: userId, ...d.params },
          }).eq('id', row.id);
        }
      } catch (e) { console.error('api log naming failed', e); }
    }
  }
  return result;
}

const chargedLogs = new WeakMap<Request, { db: any; id: string }>();

// Wrap any API handler: after it responds, the charged log row gets the real response size.
export async function trackApiResponse(req: Request, handler: () => Promise<Response>): Promise<Response> {
  const res = await handler();
  const entry = chargedLogs.get(req);
  if (entry) {
    try {
      const size = (await res.clone().arrayBuffer()).byteLength;
      await entry.db.from('api_request_logs').update({ response_size_bytes: size }).eq('id', entry.id);
    } catch (e) { console.error('api response size log failed', e); }
  }
  return res;
}
