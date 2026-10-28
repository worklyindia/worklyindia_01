// Forwards WhatsApp events to a customer's own registered webhook endpoints (signed with their whsec_ secret).
import { postWebhook, autoDisableIfFailing } from './webhookHealth.ts';

/**
 * Subscription tokens: exact event, "<prefix>.*", or per-group tokens "<group>.*" / "<group>.*@<account>".
 * Groups: whatsapp (account = phone_number_id) and gmail / outlook / domain (account = mailbox email).
 */
export function hookWants(events: string[], event: string, data: any): boolean {
  const prefix = event.split('.')[0];
  if (events.includes(event) || events.includes(`${prefix}.*`)) return true;
  let group = '', account = '';
  if (prefix === 'whatsapp') { group = 'whatsapp'; account = String(data?.phone_number_id || data?.metadata?.phone_number_id || ''); }
  else if (prefix === 'email') { group = String(data?.provider || ''); account = String(data?.mailbox || '').toLowerCase(); }
  if (!group) return false;
  return events.includes(`${group}.*`) || (!!account && events.includes(`${group}.*@${account}`));
}

export async function forwardToCustomerWebhooks(supabase: any, userId: string | null | undefined, event: string, data: unknown) {
  if (!userId) return;
  try {
    const { data: hooks } = await supabase.from('webhook_endpoints')
      .select('id,url,secret,events').eq('user_id', userId).eq('is_active', true);
    const targets = (hooks || []).filter((h: any) => Array.isArray(h.events) && hookWants(h.events, event, data));
    if (!targets.length) return;
    const payload = { event, created_at: new Date().toISOString(), data };
    await Promise.allSettled(targets.map(async (h: any) => {
      const r = await postWebhook(h.url, h.secret || '', payload, event, 8000);
      await supabase.from('webhook_deliveries').insert({
        webhook_id: h.id, event, payload, status: r.success ? 'delivered' : 'failed',
        response_status: r.status, error_message: r.error ?? null,
      });
      if (!r.success) await autoDisableIfFailing(supabase, h.id);
    }));
  } catch (e) {
    console.error('[customer-webhook] forward failed', e instanceof Error ? e.message : e);
  }
}
