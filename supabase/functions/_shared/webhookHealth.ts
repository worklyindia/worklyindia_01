// Shared webhook delivery helpers: signed POST with strict success rules, delivery logging,
// and auto-disable after 24 hours of continuous failures.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function signWebhook(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type DeliveryResult = { success: boolean; status: number | null; error?: string };

export async function postWebhook(url: string, secret: string, payload: unknown, event = 'test.webhook', timeoutMs = 15000): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST', redirect: 'manual', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': event, 'X-Webhook-Signature': await signWebhook(secret, body), 'User-Agent': 'WFH-India-Webhook/1.0' },
      body,
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const text = (await res.text().catch(() => '')).slice(0, 300);
    let error: string | undefined;
    if (res.status >= 300 && res.status < 400) error = `Endpoint redirected (HTTP ${res.status}). Use the final webhook receiver URL.`;
    else if (!res.ok) error = `Endpoint returned HTTP ${res.status}${text ? ` — ${text.slice(0, 150)}` : ''}`;
    else if (ct.includes('text/html') || /^\s*<(!doctype|html)/i.test(text)) error = 'Endpoint returned a web page (HTML), not a webhook receiver. Use a server URL that accepts POST JSON and responds 2xx.';
    return { success: !error, status: res.status, error };
  } catch (e: any) {
    return { success: false, status: null, error: e?.name === 'AbortError' ? `Endpoint timed out after ${timeoutMs / 1000} seconds` : `Could not reach endpoint: ${e?.message || e}` };
  } finally { clearTimeout(timer); }
}

/** Turns a webhook off when every delivery for the last 24 hours has failed. */
export async function autoDisableIfFailing(supabase: any, webhookId: string) {
  try {
    const { data: lastOk } = await supabase.from('webhook_deliveries').select('created_at')
      .eq('webhook_id', webhookId).eq('status', 'delivered').order('created_at', { ascending: false }).limit(1).maybeSingle();
    let q = supabase.from('webhook_deliveries').select('created_at').eq('webhook_id', webhookId).eq('status', 'failed');
    if (lastOk?.created_at) q = q.gt('created_at', lastOk.created_at);
    const { data: firstFail } = await q.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (firstFail && Date.now() - new Date(firstFail.created_at).getTime() >= DAY_MS) {
      await supabase.from('webhook_endpoints').update({ is_active: false }).eq('id', webhookId);
      console.log(`[webhook] auto-disabled ${webhookId} after 24h of failures`);
    }
  } catch (e) { console.error('[webhook] auto-disable check failed', e); }
}
