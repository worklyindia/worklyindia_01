// Lifecycle fan-out: WhatsApp (4th channel next to Push, Email, Telegram).
// Job seeker events go out from the Job seekers WhatsApp number, employer events from the
// Employers number, using the approved Meta template named `<event>_<audience>`.
// Owner switches it per template (whatsapp_templates.notify_enabled). Never throws.
import { normalizePhone, sendTemplate, withAudience, type Audience } from './whatsappCloud.ts';

export type WhatsAppFanoutStatus = 'sent' | 'skipped' | 'failed' | 'no_recipient' | 'disabled' | 'no_template';

export const whatsappTemplateName = (key: string, audience: Audience) => {
  const base = key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  const suffix = `_${audience}`;
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
};

export async function sendLifecycleWhatsApp(
  supabase: any,
  args: { userId: string; templateKey: string; employerSide: boolean; values: Record<string, unknown> },
): Promise<{ status: WhatsAppFanoutStatus; error?: string }> {
  try {
    const audience: Audience = args.employerSide ? 'employer' : 'job_seeker';
    const name = whatsappTemplateName(args.templateKey, audience);
    const { data: tpl } = await supabase.from('whatsapp_templates')
      .select('name,language,category,variables,status,is_active,notify_enabled').eq('name', name).maybeSingle();
    if (!tpl || String(tpl.status || '').toUpperCase() !== 'APPROVED') return { status: 'no_template' };
    if (tpl.notify_enabled === false || tpl.is_active === false) return { status: 'disabled' };
    if (String(tpl.category || '').toUpperCase() === 'AUTHENTICATION') return { status: 'skipped' };

    const table = args.employerSide ? 'companies' : 'profiles';
    const { data: who } = await supabase.from(table).select('whatsapp_number, phone').eq('user_id', args.userId).limit(1).maybeSingle();
    const raw = String(who?.whatsapp_number || who?.phone || '').trim();
    if (raw.replace(/\D/g, '').length < 10) return { status: 'no_recipient' };
    const to = normalizePhone(raw);

    const keys: string[] = Array.isArray(tpl.variables) ? tpl.variables : [];
    const values = keys.map((k) => {
      const v = args.values[k] ?? args.values[k.replace(/^body_/, '')];
      const s = String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      return s || '-';
    });
    await withAudience(audience, () => sendTemplate({ to, name: tpl.name, language: tpl.language || 'en_US', values, category: tpl.category }));
    return { status: 'sent' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[fanout] whatsapp failed (${args.templateKey}):`, msg);
    return { status: 'failed', error: msg };
  }
}
