// Legacy AI visitor chat is retired (410). Developer widgets: each developer gets
// one widget ID and a 6-digit PIN; the correct PIN signs that developer's browser
// in to their own Workly Chat page. PINs are hashed and attempts are rate-limited.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function retired() {
  return json({ success: false, error: 'Visitor chat has been removed. Open Workly Chat to access your connected inboxes.' }, 410);
}

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;
export const isValidPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{6}$/.test(pin);
const isValidWidgetId = (id: unknown): id is string => typeof id === 'string' && /^wgt_[a-f0-9]{24}$/.test(id);

async function hashPin(widgetId: string, pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`workly-widget:${widgetId}:${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newWidgetId() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return 'wgt_' + Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const SUBSCRIPTION_REQUIRED = 'An active API subscription is required to use this widget. Please subscribe to continue.';

// A subscription counts as active when its status is active and it has not expired.
// deno-lint-ignore no-explicit-any
export const hasActiveSubscription = (rows: any[] | null | undefined, now = Date.now()) =>
  !!rows?.some((s) => s?.status === 'active' && (!s.expires_at || new Date(s.expires_at).getTime() > now));

// deno-lint-ignore no-explicit-any
async function ownerSubscribed(admin: any, userId: string) {
  const { data } = await admin.from('api_subscriptions').select('status,expires_at').eq('user_id', userId).eq('status', 'active');
  return hasActiveSubscription(data);
}

// deno-lint-ignore no-explicit-any
export async function handlePublicWidget(_req: Request, raw: any, admin: any): Promise<Response> {
  if (raw?.action !== 'unlock' && raw?.action !== 'status') return retired();
  const { widget_id, pin } = raw;
  if (!isValidWidgetId(widget_id)) return json({ success: false, error: 'Invalid widget ID' }, 400);
  if (raw.action === 'status') {
    const { data: sw } = await admin.from('developer_chat_widgets').select('user_id').eq('widget_id', widget_id).maybeSingle();
    if (!sw) return json({ success: false, error: 'Widget not found' }, 404);
    const active = await ownerSubscribed(admin, sw.user_id);
    return json({ success: true, subscription_active: active, error: active ? undefined : SUBSCRIPTION_REQUIRED });
  }
  if (!isValidPin(pin)) return json({ success: false, error: 'PIN must be exactly 6 digits' }, 400);
  const { data: w } = await admin.from('developer_chat_widgets').select('*').eq('widget_id', widget_id).maybeSingle();
  if (!w) return json({ success: false, error: 'Widget not found' }, 404);
  if (!(await ownerSubscribed(admin, w.user_id))) return json({ success: false, subscription_required: true, error: SUBSCRIPTION_REQUIRED }, 402);
  if (!w.pin_hash) return json({ success: false, error: 'PIN has not been set for this widget yet' }, 400);
  const lockLeft = w.locked_until ? new Date(w.locked_until).getTime() - Date.now() : 0;
  if (lockLeft > 0 && lockLeft <= LOCK_SECONDS * 1000) {
    return json({ success: false, error: 'Too many wrong attempts. Please try again after 60 seconds.' }, 429);
  }
  if ((await hashPin(widget_id, pin)) !== w.pin_hash) {
    const attempts = (w.failed_attempts || 0) + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await admin.from('developer_chat_widgets').update({
      failed_attempts: lock ? 0 : attempts,
      locked_until: lock ? new Date(Date.now() + LOCK_SECONDS * 1000).toISOString() : null,
    }).eq('id', w.id);
    return json({ success: false, error: lock ? 'Too many wrong attempts. Please try again after 60 seconds.' : `Incorrect PIN. ${MAX_ATTEMPTS - attempts} attempt(s) left.` }, 401);
  }
  await admin.from('developer_chat_widgets').update({ failed_attempts: 0, locked_until: null }).eq('id', w.id);
  if (!(await ownerSubscribed(admin, w.user_id))) return json({ success: false, subscription_required: true, error: SUBSCRIPTION_REQUIRED }, 402);
  const { data: u } = await admin.auth.admin.getUserById(w.user_id);
  const email = u?.user?.email;
  if (!email) return json({ success: false, error: 'Developer account not available' }, 400);
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !link?.properties?.hashed_token) return json({ success: false, error: 'Could not open Workly Chat' }, 500);
  return json({ success: true, token_hash: link.properties.hashed_token });
}

// deno-lint-ignore no-explicit-any
export async function handleWidgetManage(req: Request, raw: any, admin: any): Promise<Response> {
  if (!['get', 'set_pin'].includes(raw?.action)) return retired();
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const uid = u?.user?.id;
  if (!uid) return json({ success: false, error: 'Please sign in' }, 401);
  let { data: w } = await admin.from('developer_chat_widgets').select('*').eq('user_id', uid).maybeSingle();
  if (!w) {
    const ins = await admin.from('developer_chat_widgets').insert({ user_id: uid, widget_id: newWidgetId() }).select('*').single();
    if (ins.error) return json({ success: false, error: 'Could not create widget' }, 500);
    w = ins.data;
  }
  if (raw.action === 'set_pin') {
    if (!isValidPin(raw.pin)) return json({ success: false, error: 'PIN must be exactly 6 digits' }, 400);
    await admin.from('developer_chat_widgets').update({
      pin_hash: await hashPin(w.widget_id, raw.pin), failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', w.id);
    return json({ success: true, widget_id: w.widget_id, has_pin: true });
  }
  return json({ success: true, widget_id: w.widget_id, has_pin: !!w.pin_hash });
}
