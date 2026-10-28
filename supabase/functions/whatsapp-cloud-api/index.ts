import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  buildTemplateComponents, fillBody, uploadTemplateMedia, loadCloudConfig, graph, normalizePhone, orderedValues, sendMessage, sendTemplate,
  toAudience, withAudience,
} from '../_shared/whatsappCloud.ts';
import { getMetaAppCreds } from '../_shared/metaSocial.ts';
import { fetchLiveTier, readTier } from '../_shared/whatsappTierSync.ts';
import { hookError, verifySmsHook } from './smsHook.ts';
import { needsWhatsAppRegistration } from '../_shared/whatsappSetup.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function getConversation(phone: string, name?: string) {
  const cfg = await loadCloudConfig();
  const audience = toAudience(cfg.audience);
  if (!cfg.phoneNumberId) throw new Error('WhatsApp business number is not connected');
  let query = supabase.from('whatsapp_conversations').select('*').eq('phone_number', phone).is('company_id', null).eq('whatsapp_phone_number_id', cfg.phoneNumberId);
  query = audience ? query.eq('audience', audience) : query.is('audience', null);
  const { data } = await query.maybeSingle();
  if (data) return data;
  const { data: created } = await supabase.from('whatsapp_conversations')
    .insert({ phone_number: phone, contact_name: name || null, is_active: true, audience, company_id: null, whatsapp_phone_number_id: cfg.phoneNumberId }).select().single();
  return created;
}

async function logOutgoing(p: {
  phone: string; name?: string; content: string; type: string; template_name?: string; vars?: unknown;
  wamid?: string; error?: string; conversation_id?: string | null; metadata?: Record<string, unknown>;
  reply_to_message_id?: string | null;
}) {
  const cfg = await loadCloudConfig();
  // Resolve ownership from the active number, never trust a caller-supplied conversation ID.
  const conv = await getConversation(p.phone, p.name);
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conv?.id ?? null,
    direction: 'outbound',
    recipient_phone: p.phone,
    recipient_name: p.name ?? null,
    message_content: p.content,
    message_type: p.type,
    template_name: p.template_name || p.type,
    template_variables: (p.vars ?? null) as any,
    msg91_message_id: p.wamid ?? null,
    audience: cfg.audience ?? null,
    whatsapp_phone_number_id: cfg.phoneNumberId ?? null,
    status: p.error ? 'failed' : 'sent',
    error_message: p.error ?? null,
    sent_at: p.error ? null : new Date().toISOString(),
    metadata: { provider: 'cloud_api', ...(p.metadata || {}) } as any,
    reply_to_message_id: p.reply_to_message_id ?? null,
  });
  if (conv?.id && !p.error) {
    await supabase.from('whatsapp_conversations').update({
      last_message_at: new Date().toISOString(), last_message_preview: p.content.slice(0, 100),
    }).eq('id', conv.id);
  }
}

async function loadTemplate(ref: { id?: string; name?: string }) {
  let q = supabase.from('whatsapp_templates').select('*');
  if (ref.id) q = q.eq('id', ref.id);
  else if (ref.name) q = q.eq('name', ref.name);
  else return null;
  const { data } = await q.maybeSingle();
  return data;
}

function templateNameForAudience(base: string, audience?: string | null) {
  const clean = String(base || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  if (audience !== 'job_seeker' && audience !== 'employer' && audience !== 'customer_service') return clean;
  const suffix = `_${audience}`;
  return clean.endsWith(suffix) ? clean : `${clean}${suffix}`;
}

function metaTemplateVariables(t: any): string[] {
  const body = t?.components?.find((c: any) => c.type === 'BODY')?.text || '';
  const keys = [...new Set((body.match(/\{\{\s*([\w]+)\s*\}\}/g) || []).map((m: string) => m.replace(/[{}\s]/g, '')))];
  return keys.map((k) => `body_${k}`);
}

function isApprovedTemplate(template: any) {
  return String(template?.status || '').toUpperCase() === 'APPROVED' && template?.is_active !== false;
}

function templateValues(template: any, variables: unknown): string[] {
  if (variables && !Array.isArray(variables) && template?.variables?.length) {
    const map = variables as Record<string, unknown>;
    return template.variables.map((key: string) => String(map[key] ?? '-'));
  }
  return orderedValues(variables);
}

const EVENT_TEMPLATE_FALLBACK: Record<string, string> = {
  user_profile_whatsapp_verify: 'jobseeker_2fa_otp',
  company_profile_whatsapp_verify: 'employer_2fa_otp',
  user_signup_otp: 'jobseeker_2fa_otp',
  company_signup_otp: 'employer_2fa_otp',
};

async function handleTrigger(b: any) {
  const phone = normalizePhone(b.phone);
  const eventType = String(b.event_type || '');
  const meta = { name: b.name, user_name: b.name, company_name: b.name, ...(b.metadata || {}) };

  const { data: rule } = await supabase.from('whatsapp_automation_rules')
    .select('*').eq('trigger_event', eventType).not('template_id', 'is', null)
    .order('is_active', { ascending: false }).limit(1).maybeSingle();

  const cfg = await loadCloudConfig();
  let template: any = null;
  if (rule?.template_id && (rule.is_active || b.is_test)) {
    const linked = await loadTemplate({ id: rule.template_id });
    const linkedMatchesAudience = !cfg.audience || String(linked?.name || '').endsWith(`_${cfg.audience}`);
    if (linkedMatchesAudience && isApprovedTemplate(linked)) template = linked;
  }
  if (!template) {
    const fallback = EVENT_TEMPLATE_FALLBACK[eventType];
    if (fallback) {
      const name = templateNameForAudience(fallback, cfg.audience);
      const { data } = await supabase.from('whatsapp_templates').select('*')
        .eq('name', name).eq('status', 'APPROVED').limit(1).maybeSingle();
      if (isApprovedTemplate(data)) template = data;
    }
  }
  if (!template) {
    return { success: false, skipped: true, event_type: eventType, error: `No approved WhatsApp template linked for ${eventType}` };
  }

  const mapping = (rule?.variable_mapping as Record<string, string>) || {};
  let values: string[];
  if ((template.category || '').toLowerCase() === 'authentication') {
    values = [String(meta.otp ?? meta.code ?? '')];
  } else {
    const keys = Object.keys(mapping).sort((a, c) => parseInt(a.replace(/\D/g, '')) - parseInt(c.replace(/\D/g, '')));
    values = keys.map((k) => String(meta[mapping[k]] ?? meta[k] ?? '-'));
    if (!keys.length && template.variables?.length) values = template.variables.map((v: string) => String(meta[v] ?? '-'));
  }

  const logBase = {
    trigger_event: eventType, recipient_phone: phone, recipient_name: b.name ?? null,
    user_type: b.user_type || rule?.target_user_type || 'user', template_name: template.name,
    template_variables: values as any, metadata: meta as any,
    triggered_by: b.triggered_by || (b.is_test ? 'manual_test' : 'system'), trigger_source: b.trigger_source || 'app',
    delivery_channel: 'whatsapp_cloud_api',
  };

  try {
    let res: any;
    try {
      res = await sendTemplate({ to: phone, name: template.name, language: template.language, values, category: template.category });
    } catch (e: any) {
      // The stored template may not exist on this number's WhatsApp account (132001).
      // For login codes, retry with any approved authentication template Meta has live.
      if (!/132001/.test(String(e?.message)) || (template.category || '').toLowerCase() !== 'authentication' || !cfg.wabaId) throw e;
      const page: any = await graph(`/${cfg.wabaId}/message_templates`, { query: { limit: '200', fields: 'name,status,category,language' } });
      const live = (page?.data || []).filter((t: any) => String(t.status).toUpperCase() === 'APPROVED' && String(t.category).toUpperCase() === 'AUTHENTICATION');
      const preferred = live.find((t: any) => t.name === template.name);
      const pickT = preferred || live.find((t: any) => /otp|2fa|signup|login|verify/i.test(t.name)) || live[0];
      console.warn('otp template retry', JSON.stringify({ tried: `${template.name}/${template.language}`, waba: cfg.wabaId, live: live.map((t: any) => `${t.name}/${t.language}`), pick: pickT ? `${pickT.name}/${pickT.language}` : null }));
      if (!pickT) throw e;
      res = await sendTemplate({ to: phone, name: pickT.name, language: pickT.language, values, category: 'authentication' });
      logBase.template_name = pickT.name;
    }
    const wamid = res?.messages?.[0]?.id;
    await supabase.from('whatsapp_trigger_logs').insert({ ...logBase, status: 'sent', sent_at: new Date().toISOString(), msg91_request_id: wamid, msg91_response: res });
    await logOutgoing({ phone, name: b.name, content: fillBody(template.content_preview || '', values), type: 'template', template_name: template.name, vars: values, wamid });
    if (rule?.id) await supabase.from('whatsapp_automation_rules').update({ execution_count: (rule.execution_count || 0) + 1, last_executed_at: new Date().toISOString() }).eq('id', rule.id);
    return { success: true, event_type: eventType, message_id: wamid, template: template.name };
  } catch (e: any) {
    await supabase.from('whatsapp_trigger_logs').insert({ ...logBase, status: 'failed', failed_at: new Date().toISOString(), error_message: e.message, msg91_response: e.details ?? null });
    return { success: false, event_type: eventType, error: e.message };
  }
}

async function handleSendBulk(b: any) {
  const template = await loadTemplate(b.template_id?.length === 36 ? { id: b.template_id } : { name: b.template_id });
  if (!template) return { success: false, error: 'Template not found' };
  if (!isApprovedTemplate(template)) return { success: false, error: 'Template is not approved by Meta yet' };
  const results: any[] = [];
  for (const r of b.recipients || []) {
    const phone = normalizePhone(r.phone);
    const values = templateValues(template, r.variables);
    try {
      const res = await sendTemplate({ to: phone, name: template.name, language: template.language, values, category: template.category });
      const wamid = res?.messages?.[0]?.id;
      await logOutgoing({ phone, name: r.name, content: fillBody(template.content_preview || '', values), type: 'template', template_name: template.name, vars: values, wamid, metadata: { campaign_id: b.campaign_id ?? null, is_test: !!b.is_test } });
      results.push({ phone, success: true, requestId: wamid });
    } catch (e: any) {
      await logOutgoing({ phone, name: r.name, content: template.content_preview || '', type: 'template', template_name: template.name, vars: values, error: e.message, metadata: { campaign_id: b.campaign_id ?? null } });
      results.push({ phone, success: false, error: e.message });
    }
  }
  const success = results.filter((r) => r.success).length;
  if (success) await supabase.from('whatsapp_templates').update({ total_sent: (template.total_sent || 0) + success }).eq('id', template.id);
  return { success: success > 0, results, summary: { total: results.length, success, failed: results.length - success } };
}

async function handleSyncTemplates() {
  const { wabaId } = await loadCloudConfig();
  if (!wabaId) return { success: false, error_type: 'config', error: 'WHATSAPP_BUSINESS_ACCOUNT_ID is not configured' };
  const all: any[] = [];
  let after: string | undefined;
  do {
    const page = await graph(`/${wabaId}/message_templates`, {
      query: { limit: '100', fields: 'id,name,status,category,language,components,rejected_reason', ...(after ? { after } : {}) },
    });
    all.push(...(page.data || []));
    after = page.paging?.next ? page.paging?.cursors?.after : undefined;
  } while (after);

  const now = new Date().toISOString();
  for (const t of all) {
    const body = t.components?.find((c: any) => c.type === 'BODY');
    const header = t.components?.find((c: any) => c.type === 'HEADER');
    const footer = t.components?.find((c: any) => c.type === 'FOOTER');
    const buttons = t.components?.find((c: any) => c.type === 'BUTTONS')?.buttons ?? null;
    const n = new Set((body?.text || '').match(/\{\{\d+\}\}/g) || []).size;
    const row = {
      name: t.name, display_name: t.name, status: t.status, category: String(t.category || '').toLowerCase(),
      language: t.language, content_preview: body?.text ?? null, header_type: header?.format ?? null,
      header_content: header?.text ?? null, footer: footer?.text ?? null, buttons,
      variables: Array.from({ length: n }, (_, i) => `body_${i + 1}`), msg91_template_id: t.id,
      is_active: String(t.status || '').toUpperCase() === 'APPROVED',
      rejection_reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null, last_synced_at: now,
    };
    const { data: existing } = await supabase.from('whatsapp_templates').select('id').eq('name', t.name).maybeSingle();
    if (existing) await supabase.from('whatsapp_templates').update(row).eq('id', existing.id);
    else await supabase.from('whatsapp_templates').insert({ ...row, is_active: true });
  }
  return { success: true, synced_count: all.length, synced_at: now };
}

async function isAdminCaller(token: string): Promise<boolean> {
  if (!token) return false;
  // Internal callers (edge functions, cron, DB webhooks) authenticate with the service role key.
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  const { data, error } = await supabase.auth.getUser(token);
  const uid = data?.user?.id;
  if (error || !uid) return false;
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', uid).in('role', ['owner', 'admin']);
  return !!roles?.length;
}

async function handleSmsHook(req: Request): Promise<Response> {
  const raw = await req.text();
  if (!(await verifySmsHook(req, raw))) return hookError(401, 'Invalid hook signature');
  let p: any;
  try { p = JSON.parse(raw); } catch { return hookError(400, 'Invalid payload'); }
  // Phone change (signed-in / social login) sends the code to the new number, not the old one.
  const phone = String(p?.user?.new_phone || p?.user?.phone_change || p?.user?.phone || '');
  const otp = String(p?.sms?.otp || '');
  if (!phone || !/^\d{4,10}$/.test(otp)) return hookError(400, 'Missing phone or code');
  const meta = p?.user?.user_metadata || {};
  const isEmployer = meta.user_type === 'employer';
  const audience = isEmployer ? 'employer' : 'job_seeker';
  const name = String(meta.full_name || meta.company_name || meta.name || '');
  // Supabase Auth gives the hook only 5s; Meta + template lookups can exceed it, so reply
  // immediately and finish the WhatsApp send in the background.
  const send = withAudience(toAudience(audience), () => handleTrigger({
    phone, name, event_type: isEmployer ? 'company_signup_otp' : 'user_signup_otp',
    user_type: audience, metadata: { otp }, triggered_by: 'system', trigger_source: 'supabase_sms_hook',
  })).then((r: any) => { if (!r?.success) console.error('sms-hook send failed', JSON.stringify(r)); else console.log('sms-hook sent'); })
    .catch((e: unknown) => console.error('sms-hook send error', e));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(send); else await send;
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/sms-hook')) {
    try { return await handleSmsHook(req); } catch { return hookError(500, 'WhatsApp code delivery failed'); }
  }
  // Every action here is privileged (sending, template management, config) — owner/admin only.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await isAdminCaller(token))) {
    return json({ success: false, error: 'Only owner/admin can use WhatsApp Cloud API actions' }, 403);
  }
  const b = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
  const audience = toAudience(b.audience) ?? toAudience(b.user_type) ?? toAudience(b.target_user_type);
  return withAudience(audience, () => handle(b));
});

async function handle(b: any): Promise<Response> {
  try {
    const action = b.action;
    const cfg = await loadCloudConfig();
    if (!cfg.configured && action !== 'status') {
      const label = cfg.audience === 'customer_service' ? 'Customer Service WhatsApp' : cfg.audience === 'employer' ? 'Employers WhatsApp' : cfg.audience === 'job_seeker' ? 'Job seekers WhatsApp' : 'WhatsApp';
      return json({ success: false, error_type: 'config', error: `${label} is not connected yet. Finish the Connect with Facebook flow in WhatsApp Settings first.` });
    }

    switch (action) {
      case 'status':
        return json({ success: true, configured: cfg.configured, phone_number_id: cfg.phoneNumberId ?? null, provider: 'cloud_api' });

      case 'trigger':
        return json(await handleTrigger(b));

      case 'send_bulk':
        return json(await handleSendBulk(b));

      case 'send_template': {
        const to = normalizePhone(b.to);
        if (to.length < 10 || to.length > 15) return json({ success: false, error: 'Profile WhatsApp number is invalid' }, 400);
        let tpl: any = await loadTemplate({ name: b.template_name });
        // Always read Meta's live definition so parameters match its exact format.
        let metaTpl: any = null;
        try {
          const page = await graph(`/${cfg.wabaId}/message_templates`, { query: { limit: '200', name: b.template_name, fields: 'id,name,status,category,language,components,parameter_format' } });
          metaTpl = (page.data || []).find((t: any) => t.name === b.template_name && (!b.template_language || t.language === b.template_language)) || null;
        } catch (_) { /* fall back to local */ }
        if (!isApprovedTemplate(tpl) && metaTpl && String(metaTpl.status).toUpperCase() === 'APPROVED') {
          tpl = { name: metaTpl.name, status: 'APPROVED', category: metaTpl.category, language: metaTpl.language, variables: metaTemplateVariables(metaTpl), content_preview: metaTpl.components?.find((c: any) => c.type === 'BODY')?.text || '' };
        }
        if (!isApprovedTemplate(tpl)) return json({ success: false, error: 'Template is not approved by Meta yet' });
        let values = templateValues(tpl, b.variables);
        let res: any;
        if (metaTpl) {
          const inputMap: Record<string, unknown> = b.variables && !Array.isArray(b.variables) ? b.variables : {};
          const inputArr = orderedValues(b.variables);
          const named = String(metaTpl.parameter_format || '').toUpperCase() === 'NAMED';
          const keysOf = (text: string) => [...new Set((text.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, '')))];
          let idx = 0;
          const pick = (k: string) => String(inputMap[`body_${k}`] ?? inputMap[k] ?? inputArr[idx++] ?? '-') || '-';
          const comps: any[] = [];
          const header = metaTpl.components?.find((c: any) => c.type === 'HEADER');
          const mediaFmt = String(header?.format || '').toUpperCase();
          if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(mediaFmt)) {
            const link = String(b.header_media_url || header?.example?.header_handle?.[0] || '');
            if (!link) return json({ success: false, error: `This template needs a header ${mediaFmt.toLowerCase()}.` });
            const kind = mediaFmt.toLowerCase();
            // Meta cannot fetch its own signed sample URLs, so download and upload to get a media id.
            let mediaRef: any = { link };
            try {
              const dl = await fetch(link);
              if (dl.ok) {
                const blob = await dl.blob();
                const fd = new FormData();
                fd.append('messaging_product', 'whatsapp');
                fd.append('type', blob.type || 'image/jpeg');
                fd.append('file', blob, `header.${kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'pdf'}`);
                const up = await fetch(`https://graph.facebook.com/v26.0/${cfg.phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` }, body: fd });
                const uj = await up.json().catch(() => ({}));
                if (up.ok && uj?.id) mediaRef = { id: uj.id };
                else console.error('header media upload failed', up.status, JSON.stringify(uj));
              }
            } catch (e) { console.error('header media download failed', e); }
            comps.push({ type: 'header', parameters: [{ type: kind, [kind]: mediaRef }] });
          }
          if (header?.format === 'TEXT' && keysOf(header.text || '').length) {
            comps.push({ type: 'header', parameters: keysOf(header.text).map((k) => ({ type: 'text', text: String(inputMap[`header_${k}`] ?? '-'), ...(named ? { parameter_name: k } : {}) })) });
          }
          const bodyKeys = keysOf(metaTpl.components?.find((c: any) => c.type === 'BODY')?.text || '');
          values = bodyKeys.map(pick);
          if (bodyKeys.length) comps.push({ type: 'body', parameters: bodyKeys.map((k, i) => ({ type: 'text', text: values[i], ...(named ? { parameter_name: k } : {}) })) });
          if (String(metaTpl.category).toUpperCase() === 'AUTHENTICATION' && values[0]) {
            comps.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: values[0] }] });
          }
          res = await sendMessage({ to, type: 'template', template: { name: metaTpl.name, language: { code: metaTpl.language }, ...(comps.length ? { components: comps } : {}) } });
        } else {
          res = await sendTemplate({ to, name: b.template_name, language: b.template_language || tpl?.language, values, category: tpl?.category });
        }
        const wamid = res?.messages?.[0]?.id;
        await logOutgoing({ phone: to, content: fillBody(b.template_body || tpl?.content_preview || '', values), type: 'template', template_name: b.template_name, vars: values, wamid, conversation_id: b.conversation_id, metadata: { template_components: b.template_components ?? null } });
        return json({ success: true, accepted: true, message_id: wamid, recipient: to });
      }

      case 'send_reply': {
        const to = normalizePhone(b.phone_number);
        try {
          const context = b.reply_to_wa_message_id ? { message_id: String(b.reply_to_wa_message_id) } : undefined;
          const res = await sendMessage({ to, type: 'text', text: { body: String(b.message) }, ...(context ? { context } : {}) });
          const wamid = res?.messages?.[0]?.id;
          await logOutgoing({
            phone: to,
            content: String(b.message),
            type: 'text',
            wamid,
            conversation_id: b.conversation_id,
            reply_to_message_id: b.reply_to_message_id || null,
          });
          return json({ success: true, message_id: wamid });
        } catch (e: any) {
          const expired = /131047|re-engagement|24 hours/i.test(JSON.stringify(e.details ?? e.message));
          return json({ success: false, error: expired ? '24-hour session expired. Use template message instead.' : e.message });
        }
      }

      case 'send_media': {
        const to = normalizePhone(b.phone_number);
        const type = ['image', 'video', 'audio', 'document'].includes(b.media_type) ? b.media_type : 'document';
        const media: any = { link: b.media_url };
        if (b.caption && type !== 'audio') media.caption = b.caption;
        const res = await sendMessage({ to, type, [type]: media });
        const wamid = res?.messages?.[0]?.id;
        await logOutgoing({ phone: to, content: b.caption || `[${type}]`, type, wamid, conversation_id: b.conversation_id, metadata: { media_url: b.media_url } });
        return json({ success: true, message_id: wamid });
      }

      case 'advanced': {
        if (b.advanced_action === 'send_reaction') {
          await sendMessage({ to: normalizePhone(b.phone_number), type: 'reaction', reaction: { message_id: b.wa_message_id, emoji: b.emoji || '' } });
          return json({ success: true });
        }
        return json({ success: false, error: `Unsupported advanced action: ${b.advanced_action}` }, 400);
      }

      case 'sync_templates':
        return json(await handleSyncTemplates());

      case 'get_templates': {
        const page = await graph(`/${cfg.wabaId}/message_templates`, { query: { limit: '200', fields: 'id,name,status,category,language,components' } });
        let list = (page.data || []).map((t: any) => ({ ...t, variables: metaTemplateVariables(t) }));
        if (b.status) list = list.filter((t: any) => String(t.status).toLowerCase() === String(b.status).toLowerCase());
        return json({ success: true, data: list });
      }

      case 'upload_template_image': {
        const imageUrl = String(b.image_url || '');
        if (!/^https:\/\//i.test(imageUrl)) return json({ success: false, error: 'An HTTPS image URL is required.' }, 400);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) return json({ success: false, error: 'Could not download the image.' }, 400);
        const imageType = imageResponse.headers.get('content-type')?.split(';')[0] || '';
        const image = await imageResponse.arrayBuffer();
        if (!['image/jpeg', 'image/png'].includes(imageType) || image.byteLength > 5 * 1024 * 1024) return json({ success: false, error: 'Choose a JPG or PNG image under 5 MB.' }, 400);
        const appId = (await getMetaAppCreds(supabase)).appId || Deno.env.get('FACEBOOK_APP_ID');
        if (!appId) return json({ success: false, error: 'Meta app ID is needed to submit image headers.' }, 400);
        const session = await graph(`/${appId}/uploads`, { method: 'POST', query: { file_length: String(image.byteLength), file_type: imageType, file_name: 'template-image' } });
        const upload = await fetch(`https://graph.facebook.com/v21.0/${session.id}`, {
          method: 'POST', headers: { Authorization: `OAuth ${cfg.token}`, file_offset: '0', 'Content-Type': imageType }, body: image,
        });
        const result = await upload.json();
        if (!upload.ok || !result.h) return json({ success: false, error: result?.error?.message || 'Meta could not upload the image.' }, upload.status || 400);
        return json({ success: true, handle: result.h });
      }

      case 'upload_template_media': {
        if (!cfg.token) return json({ success: false, error_type: 'config', error: 'WhatsApp access token is missing. Reconnect WhatsApp in Settings.' });
        const appId = (await getMetaAppCreds(supabase)).appId || Deno.env.get('FACEBOOK_APP_ID');
        if (!appId) return json({ success: false, error: 'Meta app ID is needed to upload header files.' }, 400);
        try {
          return json({ success: true, handle: await uploadTemplateMedia(cfg.token, appId, String(b.data_url || '')) });
        } catch (e: any) {
          return json({ success: false, error: e?.message || 'Upload failed' });
        }
      }

      case 'create_template': {
        const components = buildTemplateComponents(b);
        const res = await graph(`/${cfg.wabaId}/message_templates`, {
          method: 'POST',
          body: { name: b.template_name, language: b.language || 'en_US', category: String(b.category || 'UTILITY').toUpperCase(), components },
        });
        return json({ success: true, template_id: res.id, status: res.status, data: res });
      }

      case 'edit_template': {
        if (!b.template_id) return json({ success: false, error: 'Template ID missing. Sync templates first.' });
        const components = buildTemplateComponents(b);
        const res = await graph(`/${b.template_id}`, { method: 'POST', body: { components } });
        return json({ success: true, data: res });
      }

      case 'delete_template': {
        await graph(`/${cfg.wabaId}/message_templates`, { method: 'DELETE', query: { name: b.template_name, ...(b.msg91_template_id ? { hsm_id: b.msg91_template_id } : {}) } });
        await supabase.from('whatsapp_templates').delete().eq('name', b.template_name);
        return json({ success: true });
      }

      case 'get_profile': {
        if (!cfg.token) return json({ success: false, error_type: 'config', error: 'WhatsApp access token is missing. Reconnect WhatsApp in Settings.' });
        const p = await graph(`/${cfg.phoneNumberId}`, { query: { fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status,platform_type,throughput' } });
        const liveTier = await fetchLiveTier(String(cfg.phoneNumberId), cfg.token);
        const currentTier = liveTier?.messaging_tier ?? readTier(p);
        const sectionErrors: Record<string, string> = {};
        const setupStatus = await graph(`/${cfg.phoneNumberId}`, { query: { fields: 'status,is_pin_enabled' } }).catch((error: Error) => {
          sectionErrors.setup_status = error.message;
          return {};
        });
        const bp = await graph(`/${cfg.phoneNumberId}/whatsapp_business_profile`, { query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url,messaging_product' } }).catch((error: Error) => {
          sectionErrors.business_profile = error.message;
          return { data: [] };
        });
        const extraPhone = await graph(`/${cfg.phoneNumberId}`, { query: { fields: 'is_pin_enabled,account_mode,new_name_status,health_status,ban_info' } }).catch((error: Error) => {
          sectionErrors.phone_details = error.message;
          return {};
        });
        const waba = cfg.wabaId
          ? await graph(`/${cfg.wabaId}`, { query: { fields: 'id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,currency' } }).catch((error: Error) => {
            sectionErrors.business_account = error.message;
            return {};
          })
          : {};
        return json({
          success: true,
          profile: {
            phone_number: p.display_phone_number,
            verified_name: p.verified_name,
            quality_rating: p.quality_rating,
            messaging_limit: currentTier,
            display_name_status: p.name_status,
            new_display_name_status: (extraPhone as any)?.new_name_status ?? null,
            code_verification_status: p.code_verification_status,
            is_pin_enabled: (setupStatus as any)?.is_pin_enabled ?? null,
            status: (setupStatus as any)?.status ?? null,
            account_mode: (extraPhone as any)?.account_mode ?? null,
            health_status: (extraPhone as any)?.health_status?.can_send_message ?? (extraPhone as any)?.health_status?.status ?? null,
            ban_reason: (extraPhone as any)?.ban_info?.reason ?? null,
            ban_start_date: (extraPhone as any)?.ban_info?.start_date ?? null,
            platform_type: p.platform_type,
            throughput: p.throughput?.level ?? null,
            phone_number_id: cfg.phoneNumberId,
            waba_id: cfg.wabaId,
            business_name: (waba as any)?.name ?? null,
            account_review_status: (waba as any)?.account_review_status ?? null,
            business_verification_status: (waba as any)?.business_verification_status ?? null,
            timezone_id: (waba as any)?.timezone_id ?? null,
            currency: (waba as any)?.currency ?? null,
            message_template_namespace: (waba as any)?.message_template_namespace ?? null,
            ...(bp.data?.[0] || {}),
          },
          section_errors: sectionErrors,
        });
      }

      case 'update_profile': {
        if (b.about !== undefined && !String(b.about).trim()) {
          return json({ success: false, error: 'About cannot be empty.' }, 400);
        }
        const payload: Record<string, unknown> = { messaging_product: 'whatsapp' };
        for (const key of ['about', 'address', 'description', 'email', 'vertical'] as const) {
          if (b[key] !== undefined) payload[key] = String(b[key] ?? '');
        }
        if (b.websites !== undefined) {
          payload.websites = (Array.isArray(b.websites) ? b.websites : String(b.websites || '').split(','))
            .map((w: string) => String(w).trim()).filter(Boolean).slice(0, 2);
        }
        if (b.profile_picture) {
          const match = String(b.profile_picture).match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
          if (!match) return json({ success: false, error: 'Choose a JPG or PNG picture.' }, 400);
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          if (bytes.byteLength > 5 * 1024 * 1024) return json({ success: false, error: 'Picture must be under 5 MB.' }, 400);
          const appId = (await getMetaAppCreds(supabase)).appId || Deno.env.get('FACEBOOK_APP_ID');
          if (!appId) return json({ success: false, error: 'Meta app ID is needed to upload a profile picture.' }, 400);
          const session = await graph(`/${appId}/uploads`, { method: 'POST', query: { file_length: String(bytes.byteLength), file_type: match[1], file_name: 'profile-picture' } });
          const upload = await fetch(`https://graph.facebook.com/v21.0/${session.id}`, {
            method: 'POST', headers: { Authorization: `OAuth ${cfg.token}`, file_offset: '0', 'Content-Type': match[1] }, body: bytes,
          });
          const result = await upload.json();
          if (!upload.ok || !result.h) return json({ success: false, error: result?.error?.message || 'Meta could not upload the picture.' }, upload.status || 400);
          payload.profile_picture_handle = result.h;
        }
        await graph(`/${cfg.phoneNumberId}/whatsapp_business_profile`, { method: 'POST', body: payload });
        const fresh = await graph(`/${cfg.phoneNumberId}/whatsapp_business_profile`, { query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url' } }).catch(() => ({ data: [] }));
        return json({ success: true, profile: fresh.data?.[0] || {} });
      }

      case 'set_pin': {
        const pin = String(b.pin || '');
        if (!/^\d{6}$/.test(pin)) return json({ success: false, error: 'PIN must contain exactly 6 digits.' }, 400);
        try { await graph(`/${cfg.phoneNumberId}`, { method: 'POST', body: { pin } }); }
        catch (e: any) {
          // Number not yet registered on Cloud API: register it with this PIN instead.
          if (!/does not exist in Cloud API|\/register/i.test(String(e?.message))) throw e;
          await graph(`/${cfg.phoneNumberId}/register`, { method: 'POST', body: { messaging_product: 'whatsapp', pin } });
        }
        return json({ success: true });
      }

      case 'register_number': {
        const pin = String(b.pin || '');
        if (!/^\d{6}$/.test(pin)) return json({ success: false, error: 'PIN must contain exactly 6 digits.' }, 400);
        const phone = await graph(`/${cfg.phoneNumberId}`, { query: { fields: 'status,is_pin_enabled' } });
        if (!needsWhatsAppRegistration(phone)) return json({ success: false, error: 'This number does not require registration. Refresh its setup status.' }, 409);
        const result = await graph(`/${cfg.phoneNumberId}/register`, { method: 'POST', body: { messaging_product: 'whatsapp', pin } });
        return json({ success: result?.success === true });
      }

      case 'get_calling_settings': {
        const settings = await graph(`/${cfg.phoneNumberId}/settings`, { query: { fields: 'calling' } });
        return json({ success: true, calling: settings?.calling ?? settings?.data?.[0]?.calling ?? null });
      }

      case 'update_calling_settings': {
        const source = b.calling && typeof b.calling === 'object' ? b.calling as Record<string, any> : {};
        const calling: Record<string, unknown> = {};
        if (source.status !== undefined) {
          const value = String(source.status).toUpperCase();
          if (!['ENABLED', 'DISABLED'].includes(value)) return json({ success: false, error: 'Invalid calling status.' }, 400);
          calling.status = value;
        }
        if (source.call_icon_visibility !== undefined) {
          const value = String(source.call_icon_visibility).toUpperCase();
          if (!['DEFAULT', 'DISABLE_ALL'].includes(value)) return json({ success: false, error: 'Invalid call icon visibility.' }, 400);
          calling.call_icon_visibility = value;
        }
        if (source.callback_permission_status !== undefined) {
          const value = String(source.callback_permission_status).toUpperCase();
          if (!['ENABLED', 'DISABLED'].includes(value)) return json({ success: false, error: 'Invalid callback permission status.' }, 400);
          calling.callback_permission_status = value;
        }
        if (source.call_icons !== undefined) {
          const countries = Array.isArray(source.call_icons?.restrict_to_user_countries)
            ? source.call_icons.restrict_to_user_countries.map((country: unknown) => String(country).trim().toUpperCase()).filter(Boolean)
            : [];
          if (countries.length > 250 || countries.some((country: string) => !/^[A-Z]{2}$/.test(country))) return json({ success: false, error: 'Call countries must use two-letter country codes.' }, 400);
          calling.call_icons = { restrict_to_user_countries: [...new Set(countries)] };
        }
        if (source.call_hours !== undefined) {
          const hoursStatus = String(source.call_hours?.status || 'DISABLED').toUpperCase();
          if (!['ENABLED', 'DISABLED'].includes(hoursStatus)) return json({ success: false, error: 'Invalid call hours status.' }, 400);
          const validDays = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
          const weekly = Array.isArray(source.call_hours?.weekly_operating_hours) ? source.call_hours.weekly_operating_hours.slice(0, 14) : [];
          const holidays = Array.isArray(source.call_hours?.holiday_schedule) ? source.call_hours.holiday_schedule.slice(0, 50) : [];
          if (weekly.some((item: any) => !validDays.has(String(item?.day_of_week)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.open_time)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.close_time)))) return json({ success: false, error: 'Weekly call hours are invalid.' }, 400);
          if (holidays.some((item: any) => !/^\d{4}-\d{2}-\d{2}$/.test(String(item?.date)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.start_time)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.end_time)))) return json({ success: false, error: 'Holiday call hours are invalid.' }, 400);
          const timezoneId = String(source.call_hours?.timezone_id || '').trim();
          if (hoursStatus === 'ENABLED' && !timezoneId) return json({ success: false, error: 'A timezone is required when call hours are enabled.' }, 400);
          calling.call_hours = {
            status: hoursStatus,
            ...(timezoneId ? { timezone_id: timezoneId } : {}),
            weekly_operating_hours: weekly.map((item: any) => ({ day_of_week: item.day_of_week, open_time: item.open_time, close_time: item.close_time })),
            holiday_schedule: holidays.map((item: any) => ({ date: item.date, start_time: item.start_time, end_time: item.end_time })),
          };
        }
        if (source.audio !== undefined) {
          const codecs = Array.isArray(source.audio?.additional_codecs) ? source.audio.additional_codecs.map((codec: unknown) => String(codec).toUpperCase()) : [];
          if (codecs.some((codec: string) => !['PCMA', 'PCMU'].includes(codec))) return json({ success: false, error: 'Invalid audio codec.' }, 400);
          calling.audio = { additional_codecs: [...new Set(codecs)] };
        }
        if (!Object.keys(calling).length) return json({ success: false, error: 'No calling settings were supplied.' }, 400);
        await graph(`/${cfg.phoneNumberId}/settings`, { method: 'POST', body: { calling } });
        const fresh = await graph(`/${cfg.phoneNumberId}/settings`, { query: { fields: 'calling' } });
        return json({ success: true, calling: fresh?.calling ?? fresh?.data?.[0]?.calling ?? calling });
      }


      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error('whatsapp-cloud-api error', e.message, e.details);
    return json({ success: false, error: e.message, details: e.details ?? null });
  }
}
