// Meta WhatsApp Cloud API webhook receiver (verification + inbound messages + delivery statuses + template updates)
// Meta points at THIS function; it verifies the challenge and processes every event directly.
import { putMedia } from '../_shared/r2Media.ts';
import { normalizeTier } from '../_shared/whatsappTierSync.ts';
import { forwardToCustomerWebhooks } from '../_shared/customerWebhooks.ts';
import { subAccountForPhoneId, subAccountToken } from '../_shared/whatsappSubAccounts.ts';

// Forward events for numbers connected by a developer's own users (sub-accounts) to that developer.
async function forwardSubAccount(phoneNumberId: string | undefined, event: string, data: Record<string, unknown>) {
  const sub = await subAccountForPhoneId(supabase, phoneNumberId);
  if (sub) await forwardToCustomerWebhooks(supabase, sub.developer_user_id, event, { ...data, sub_account_id: sub.sub_account_id, external_id: sub.external_id });
}
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { generateEmployerReply } from './aiAutoReply.ts';
import { getBusinessContext } from '../_shared/businessProfile.ts';
import { handleMetaSocialWebhook, getMetaAppCreds } from '../_shared/metaSocial.ts';
import { reserveAiChatMessage } from '../_shared/aiChatLimit.ts';
import { loadSupportAccountSettings } from '../_shared/supportReplySettings.ts';
import { validMetaSignature } from '../_shared/metaWebhookSecurity.ts';

type Audience = 'job_seeker' | 'employer' | 'customer_service';

const supabase = createClient(
  (Deno.env.get('SUPABASE_URL') || ''),
  (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''),
);

async function log(event_type: string, payload: unknown, wamid?: string | null) {
  await supabase.from('whatsapp_webhook_logs').insert({
    event_type,
    payload: payload as any,
    msg91_message_id: wamid ?? null,
    status_code: 200,
    processed_at: new Date().toISOString(),
  });
}

async function verifySignature(rawBody: string, signature: string | null, body: { object?: unknown; entry?: Array<{ id?: string }> }) {
  // Instagram Login signs with its own app, not the Facebook/WhatsApp app.
  // Legacy Facebook-Login Instagram accounts use the Facebook app secret.
  if (body.object === 'instagram') {
    const ids = (body.entry || []).map((entry) => String(entry.id || '')).filter(Boolean);
    if (!ids.length) return false;
    const { data: accounts, error } = await supabase.from('social_meta_accounts').select('id').eq('platform', 'instagram').in('ig_user_id', ids);
    if (error || !accounts?.length) return false;
    const { data: tokens, error: tokenError } = await supabase.from('social_meta_tokens').select('page_access_token').in('account_id', accounts.map((account) => account.id));
    if (tokenError || !tokens?.length) return false;
    const instagramLogin = tokens.every((row) => row.page_access_token?.startsWith('IG'));
    const facebookLogin = tokens.every((row) => row.page_access_token && !row.page_access_token.startsWith('IG'));
    if (!instagramLogin && !facebookLogin) return false;
    if (instagramLogin) {
    const { data: stored } = await supabase.from('owner_secrets').select('value').eq('name', 'INSTAGRAM_APP_SECRET').maybeSingle();
    const igSecret = stored?.value?.trim() || Deno.env.get('INSTAGRAM_APP_SECRET') || '';
    return validMetaSignature(rawBody, signature, igSecret);
    }
  }
  const { secret } = await getMetaAppCreds(supabase);
  return validMetaSignature(rawBody, signature, secret);
}

async function audienceForPhoneId(phoneNumberId?: string): Promise<Audience | null> {
  if (!phoneNumberId) return null;
  const { data } = await supabase.from('whatsapp_audience_accounts')
    .select('audience').eq('phone_number_id', phoneNumberId).eq('status', 'connected');
  // Notification aliases do not change inbound chat ownership.
  return data?.some((row) => row.audience === 'customer_service') ? 'customer_service' : null;
}

async function employerForPhoneId(phoneNumberId?: string): Promise<{ company_id: string; user_id: string; ai_auto_reply?: boolean; ai_tone?: string; ai_language?: string; ai_business_info?: string; ai_custom_instructions?: string; ai_signature?: string; ai_reply_length?: string } | null> {
  if (!phoneNumberId) return null;
  const { data } = await supabase.from('employer_whatsapp_accounts')
    .select('company_id, user_id, ai_auto_reply, ai_tone, ai_language, ai_business_info, ai_custom_instructions, ai_signature, ai_reply_length').eq('phone_number_id', phoneNumberId).eq('status', 'connected').maybeSingle();
  return data ?? null;
}

async function accessTokenForPhoneId(phoneNumberId?: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  const subToken = await subAccountToken(supabase, phoneNumberId);
  if (subToken) return subToken;
  const employer = await employerForPhoneId(phoneNumberId);
  if (employer) {
    const { data } = await supabase.from('employer_whatsapp_tokens').select('access_token').eq('company_id', employer.company_id).eq('phone_number_id', phoneNumberId).maybeSingle();
    return data?.access_token || null;
  }
  const { data } = await supabase.from('whatsapp_audience_accounts')
    .select('whatsapp_audience_tokens(access_token)')
    .eq('phone_number_id', phoneNumberId).eq('status', 'connected');
  for (const row of data || []) {
    const tokens = (row as any)?.whatsapp_audience_tokens;
    const token = Array.isArray(tokens) ? tokens[0]?.access_token : tokens?.access_token;
    if (token) return token;
  }
  return null;
}

async function saveInboundMedia(msg: any, phone: string, audience: Audience | null, phoneNumberId: string, owner: string) {
  const media = msg[msg.type];
  const mediaId = String(media?.id || '');
  if (!mediaId) return {};
  const token = await accessTokenForPhoneId(phoneNumberId);
  if (!token) throw new Error('Incoming media token is unavailable');

  const infoResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await infoResponse.json();
  if (!infoResponse.ok || !info?.url) throw new Error(info?.error?.message || 'Incoming media URL lookup failed');

  const mediaResponse = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!mediaResponse.ok) throw new Error(`Incoming media download failed (${mediaResponse.status})`);
  const blob = await mediaResponse.blob();
  const mimeType = media?.mime_type || blob.type || info.mime_type || 'application/octet-stream';
  const suppliedName = String(media?.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const extension = suppliedName.includes('.') ? suppliedName.split('.').pop() : mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const fileName = suppliedName || `${mediaId}.${extension}`;
  // Original bytes go to the Cloudflare WhatsApp chat bucket (no WebP).
  const safeId = mediaId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 60) || crypto.randomUUID();
  const ext = String(extension || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const saved = await putMedia('chat-whatsapp', `media/chat-whatsapp/${owner}/${Date.now()}-${safeId}.${ext.length < 2 ? 'bin' : ext}`, blob, mimeType);
  await supabase.rpc('storage_stats_apply', { p_provider: 'r2', p_bucket: saved.bucket, p_items: [{ path: saved.key, count: 1, size: blob.size, at: new Date().toISOString() }] })
    .then(({ error }: any) => error && console.error('[storage-stats]', error.message));
  return {
    media_url: saved.url,
    media_id: mediaId,
    media_type: msg.type === 'sticker' ? 'image' : msg.type,
    file_name: fileName,
    mime_type: mimeType,
    sha256: media?.sha256 || null,
  };
}

async function getConversation(phone: string, audience: Audience | null, phoneNumberId?: string, name?: string | null, companyId: string | null = null) {
  let query = supabase
    .from('whatsapp_conversations')
    .select('id, unread_count, contact_name')
    .eq('phone_number', phone);
  query = audience ? query.eq('audience', audience) : query.is('audience', null);
  query = companyId ? query.eq('company_id', companyId) : query.is('company_id', null);
  if (!phoneNumberId) throw new Error('Incoming business phone number is missing');
  query = query.eq('whatsapp_phone_number_id', phoneNumberId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`Conversation lookup failed: ${error.message}`);
  if (data) return data;
  const { data: created, error: createError } = await supabase
    .from('whatsapp_conversations')
    .insert({
      phone_number: phone, contact_name: name || null, is_active: true,
      audience, whatsapp_phone_number_id: phoneNumberId || null, company_id: companyId,
    })
    .select('id, unread_count')
    .single();
  if (createError) throw new Error(`Conversation creation failed: ${createError.message}`);
  return created;
}

function extractText(msg: any): { content: string; type: string } {
  const type = msg.type || 'text';
  switch (type) {
    case 'text': return { content: msg.text?.body || '', type: 'text' };
    case 'button': return { content: msg.button?.text || '', type: 'button' };
    case 'interactive':
      return {
        content: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '',
        type: 'interactive',
      };
    case 'image': case 'video': case 'audio': case 'document': case 'sticker':
      return { content: msg[type]?.caption || `[${type}]`, type };
    case 'location': return { content: '[location]', type: 'location' };
    case 'reaction': return { content: msg.reaction?.emoji || '', type: 'reaction' };
    default: return { content: `[${type}]`, type };
  }
}

async function handleInbound(value: any) {
  const contacts: any[] = value.contacts || [];
  const phoneNumberId = String(value.metadata?.phone_number_id || '');
  const employer = await employerForPhoneId(phoneNumberId);
  const companyId = employer?.company_id ?? null;
  const audience = employer ? null : await audienceForPhoneId(phoneNumberId);
  // Only the Customer Service number (owner) or an employer's own number saves chats/messages.
  if (!employer && audience !== 'customer_service') return;
  let mediaOwner = employer?.user_id;
  if (!mediaOwner) {
    const { data: owners, error } = await supabase.from('admin_users').select('user_id').eq('role', 'owner').limit(2);
    if (error || owners?.length !== 1) throw new Error('Could not identify the support media owner');
    mediaOwner = owners[0].user_id;
  }
  if (!mediaOwner) throw new Error('Incoming media owner unavailable');
  for (const msg of value.messages || []) {
    const phone = String(msg.from || '').replace(/\D/g, '');
    const name = contacts.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;

    if (msg.type === 'reaction') {
      const targetWamid = String(msg.reaction?.message_id || '');
      const emoji = String(msg.reaction?.emoji || '');
      const { data: target } = await supabase.from('whatsapp_messages').select('id')
        .eq('msg91_message_id', targetWamid).maybeSingle();
      if (target?.id) {
        await supabase.from('whatsapp_message_reactions').delete()
          .eq('message_id', target.id).eq('user_phone', phone);
        if (emoji) {
          await supabase.from('whatsapp_message_reactions').insert({
            message_id: target.id, emoji, user_phone: phone, user_name: name,
          });
        }
      }
      await log(emoji ? 'reaction_received' : 'reaction_removed', msg, msg.id);
      if (employer) await forwardToCustomerWebhooks(supabase, employer.user_id, 'whatsapp.message.received', { phone_number_id: phoneNumberId, from: phone, name, type: 'reaction', text: emoji, message_id: msg.id ?? null, timestamp: msg.timestamp ?? null, reaction: { message_id: targetWamid, emoji }, raw: msg });
      await forwardSubAccount(phoneNumberId, 'whatsapp.message.received', { phone_number_id: phoneNumberId, from: phone, name, type: 'reaction', text: emoji, message_id: msg.id ?? null, timestamp: msg.timestamp ?? null, reaction: { message_id: targetWamid, emoji }, raw: msg });
      continue;
    }

    const { data: existing } = await supabase.from('whatsapp_messages').select('id')
      .eq('msg91_message_id', msg.id).maybeSingle();
    if (existing) continue;
    const conv = await getConversation(phone, audience, phoneNumberId, name, companyId);
    const { content, type } = extractText(msg);
    const mediaMetadata = ['image', 'video', 'audio', 'document', 'sticker'].includes(type)
      ? await saveInboundMedia(msg, phone, audience ?? (companyId ? `company-${companyId}` as any : null), phoneNumberId, mediaOwner)
      : {};
    const contextWamid = String(msg.context?.id || '');
    const { data: repliedTo } = contextWamid
      ? await supabase.from('whatsapp_messages').select('id').eq('msg91_message_id', contextWamid).maybeSingle()
      : { data: null };

    const { error: messageError } = await supabase.from('whatsapp_messages').insert({
      conversation_id: conv?.id ?? null,
      direction: 'inbound',
      recipient_phone: phone,
      recipient_name: name,
      message_content: content,
      message_type: type,
      template_name: type,
      status: 'received',
      msg91_message_id: msg.id ?? null,
      audience,
      company_id: companyId,
      whatsapp_phone_number_id: phoneNumberId || null,
      sent_at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
      reply_to_message_id: repliedTo?.id ?? null,
      metadata: { provider: 'cloud_api', raw: msg, ...mediaMetadata } as any,
    });
    if (messageError) throw new Error(`Incoming message save failed: ${messageError.message}`);

    if (conv?.id) {
      const { error: conversationError } = await supabase.from('whatsapp_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 100),
        unread_count: (conv.unread_count || 0) + 1,
        is_active: true,
        // 24h customer service window
        session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        contact_name: name || undefined,
      }).eq('id', conv.id);
      if (conversationError) throw new Error(`Conversation update failed: ${conversationError.message}`);
    }

    await log('message_received', msg, msg.id);
    if (employer) await forwardToCustomerWebhooks(supabase, employer.user_id, 'whatsapp.message.received', { phone_number_id: phoneNumberId, from: phone, name, type, text: content, message_id: msg.id ?? null, timestamp: msg.timestamp ?? null, media_url: (mediaMetadata as any)?.media_url ?? null, context: msg.context?.id ? { id: msg.context.id, from: msg.context.from ?? null } : null, raw: msg });
    await forwardSubAccount(phoneNumberId, 'whatsapp.message.received', { phone_number_id: phoneNumberId, from: phone, name, type, text: content, message_id: msg.id ?? null, timestamp: msg.timestamp ?? null, media_url: (mediaMetadata as any)?.media_url ?? null, context: msg.context?.id ? { id: msg.context.id, from: msg.context.from ?? null } : null, raw: msg });
    let aiReplyText: string | undefined;
    let profileAiOn = false;
    if (employer && !employer.ai_auto_reply && !audience && type === 'text') {
      const { data: prof } = await supabase.from('ai_platform_business_profiles').select('enabled')
        .eq('user_id', employer.user_id).eq('platform', 'whatsapp').in('account_id', [phoneNumberId ?? '', '']).eq('enabled', true).limit(1);
      profileAiOn = !!prof?.length;
    }
    if (employer && (employer.ai_auto_reply || profileAiOn) && type === 'text' && conv?.id) {
      try { aiReplyText = (await aiAutoReply(employer, conv.id, phone, phoneNumberId)) || undefined; }
      catch (e) { console.error('[wa-ai] auto reply failed', e instanceof Error ? e.message : e); }
    }
    if (audience === 'customer_service' && type === 'text' && conv?.id) {
      try {
        const { data: owners } = await supabase.from('admin_users').select('user_id').eq('role', 'owner');
        const { data: saved } = await supabase.from('support_account_reply_settings').select('user_id').eq('channel', 'whatsapp').eq('account_id', phoneNumberId);
        const enabledOwners = [];
        for (const owner of owners || []) {
          if (!saved?.some((row) => row.user_id === owner.user_id)) continue;
          const settings = await loadSupportAccountSettings(supabase, owner.user_id, 'whatsapp', phoneNumberId);
          if (settings.enabled) enabledOwners.push({ owner, settings });
        }
        if (enabledOwners.length === 1) {
          const { owner, settings } = enabledOwners[0];
          aiReplyText = (await aiAutoReply({ company_id: null, user_id: owner.user_id, ai_tone: settings.tone, ai_language: settings.language, ai_business_info: settings.business_info, ai_custom_instructions: settings.custom_instructions, ai_signature: settings.signature }, conv.id, phone, phoneNumberId, 'customer_service')) || undefined;
        } else if (enabledOwners.length > 1) await log('ai_support_ambiguous_owner', { phoneNumberId });
      } catch (e) { console.error('[wa-ai] support reply failed', e instanceof Error ? e.message : e); }
    }
    await notifyOwners({ phone, name: name || (conv as any)?.contact_name || null, type, content, audience, aiReply: aiReplyText, image: (mediaMetadata as any)?.media_url, employerUserId: employer?.user_id, conversationId: employer?.user_id ? conv.id : undefined, phoneNumberId });
  }
}

/** Connected WhatsApp Business profile + sender details, so the AI knows who it is and who it talks to. */
async function whatsappAccountContext(phoneNumberId: string, token: string, conversationId: string, senderPhone: string): Promise<string> {
  const get = async (path: string) => {
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const [num, prof, conv] = await Promise.all([
    get(`${phoneNumberId}?fields=verified_name,display_phone_number`),
    get(`${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,vertical,websites`),
    supabase.from('whatsapp_conversations').select('contact_name').eq('id', conversationId).maybeSingle(),
  ]);
  const p = prof?.data?.[0] || {};
  const lines = [
    num?.verified_name ? `- Business name: ${num.verified_name}` : '',
    num?.display_phone_number ? `- WhatsApp number: ${num.display_phone_number}` : '',
    p.vertical ? `- Category: ${p.vertical}` : '',
    p.about ? `- About: ${String(p.about).slice(0, 300)}` : '',
    p.description ? `- Description: ${String(p.description).slice(0, 800)}` : '',
    p.address ? `- Address: ${p.address}` : '',
    p.email ? `- Email: ${p.email}` : '',
    Array.isArray(p.websites) && p.websites.length ? `- Websites: ${p.websites.join(', ')}` : '',
  ].filter(Boolean);
  const contact = (conv as any)?.data?.contact_name;
  const senderLines = [
    contact ? `- Name: ${contact}` : '',
    senderPhone ? `- WhatsApp number: +${senderPhone}` : '',
  ].filter(Boolean);
  const sections = [
    lines.length ? `Connected WhatsApp Business profile (this is YOU; use it to answer accurately):\n${lines.join('\n')}` : '',
    senderLines.length
      ? `The person you are chatting with (personalise the reply and address them by name):\n${senderLines.join('\n')}`
      : '',
  ].filter(Boolean);
  return sections.join('\n');
}

async function aiAutoReply(employer: Omit<NonNullable<Awaited<ReturnType<typeof employerForPhoneId>>>, 'company_id'> & { company_id: string | null }, conversationId: string, phone: string, phoneNumberId: string, audience: 'customer_service' | null = null): Promise<string | null> {
  const companyId = employer.company_id;
  const quota = await reserveAiChatMessage(supabase, employer.user_id, 'whatsapp');
  if (!quota.allowed) {
    await log('ai_auto_reply_limit_reached', { conversationId, reason: quota.reason });
    return null;
  }
  const [{ data: company }, { data: rows }, token] = await Promise.all([
    companyId ? supabase.from('companies').select('name').eq('id', companyId).maybeSingle() : Promise.resolve({ data: { name: 'Workly India Customer Service' } }),
    supabase.from('whatsapp_messages').select('direction, message_content')
      .eq('conversation_id', conversationId).order('sent_at', { ascending: false }).limit(12),
    accessTokenForPhoneId(phoneNumberId),
  ]);
  if (!token) return null;
  const history = (rows || []).reverse().map((r: any) => ({ direction: r.direction, content: r.message_content || '' }));
  const accountContext = await whatsappAccountContext(phoneNumberId, token, conversationId, phone);
  const reply = await generateEmployerReply({ companyName: (company as any)?.name || 'our company', history, settings: employer, businessContext: await getBusinessContext(employer.user_id, audience ? 'customer_service' : 'whatsapp', audience ? null : phoneNumberId), accountContext });
  if (!reply) return null;
  if (audience && !(await loadSupportAccountSettings(supabase, employer.user_id, 'whatsapp', phoneNumberId)).enabled) return null;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: reply } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Send failed (${res.status})`);
  const now = new Date().toISOString();
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId, direction: 'outbound', recipient_phone: phone, message_content: reply,
    message_type: 'text', template_name: 'text', status: 'sent', msg91_message_id: data?.messages?.[0]?.id ?? null,
    company_id: companyId, audience, whatsapp_phone_number_id: phoneNumberId, sent_at: now,
    metadata: { provider: 'cloud_api', ai_auto_reply: true } as any,
  });
  await supabase.from('whatsapp_conversations').update({ last_message_at: now, last_message_preview: reply.slice(0, 100) }).eq('id', conversationId);
  return reply;
}

const PUSH_PREVIEW: Record<string, string> = {
  image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice message', document: '📄 Document', sticker: '🏷️ Sticker',
  location: '📍 Location', contacts: '👤 Contact',
};

/** WhatsApp-style push to owners/admins through the single notification hub. Never throws. */
async function notifyOwners(m: { phone: string; name: string | null; type: string; content: string; audience: Audience | null; aiReply?: string; image?: string; employerUserId?: string; conversationId?: string; phoneNumberId?: string }) {
  try {
    let userIds: string[] = [];
    if (m.employerUserId) userIds = [m.employerUserId];
    else {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['owner', 'admin'] as any);
      userIds = [...new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean))];
    }
    if (!userIds.length) return;
    const caption = m.content && !/^\[.*\]$/.test(m.content) ? m.content : '';
    const label = PUSH_PREVIEW[m.type];
    const body = label ? (caption ? `${label.split(' ')[0]} ${caption}` : label) : (caption || 'New message');
    const displayPhone = m.phone.startsWith('+') ? m.phone : `+${m.phone}`;
    const title = m.name || displayPhone;
    const url = m.employerUserId
      ? `/employer/workly-chat/chat/${encodeURIComponent(m.phone)}?channel=whatsapp`
      : `/owner-portal/whatsapp/chat/${encodeURIComponent(m.phone)}${m.audience ? `?audience=${m.audience}` : ''}`;
    const key = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const { data: iconRow } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'whatsapp_notification_icon').maybeSingle();
    const waIcon = (iconRow as any)?.setting_value || '/whatsapp-notification-icon.png?v=2';
    // Fetch the connected WhatsApp Business profile photo for the "You" avatar.
    // This is intentionally separate from the incoming sender's profile photo.
    let ownAvatarUrl = '';
    if (m.phoneNumberId) {
      const accountToken = await accessTokenForPhoneId(m.phoneNumberId);
      if (accountToken) {
        try {
          const profileResponse = await fetch(`https://graph.facebook.com/v21.0/${m.phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`, {
            headers: { Authorization: `Bearer ${accountToken}` },
          });
          const profileData = profileResponse.ok ? await profileResponse.json() : null;
          const candidate = profileData?.data?.[0]?.profile_picture_url;
          if (typeof candidate === 'string' && candidate.startsWith('https://')) ownAvatarUrl = candidate;
        } catch (error) {
          console.warn('[wa-push] connected account avatar unavailable', error instanceof Error ? error.message : String(error));
        }
      }
    }
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-api`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_push_raw', userIds, title, body: body.slice(0, 900), url,
        icon: waIcon,
        image: m.type === 'image' || m.type === 'sticker' ? m.image : undefined,
        actions: [
          { action: 'reply', title: 'Reply', url },
          { action: 'mark-read', title: 'Mark as read', url },
        ],
        tag: `whatsapp-${m.audience ?? 'x'}-${m.phone}`,
        data: { type: 'whatsapp_message', source: 'whatsapp', platform: 'whatsapp', sender_avatar_url: '', own_avatar_url: ownAvatarUrl, account_avatar_url: ownAvatarUrl, url, ...(m.aiReply ? { ai_reply: m.aiReply } : {}), phone: m.phone, audience: m.audience ?? '', employer_notification: m.employerUserId ? 'true' : 'false', conversation_id: m.conversationId ?? '', phone_number_id: m.phoneNumberId ?? '' },
      }),
    });
    if (!res.ok) console.error('[wa-push] hub failed', res.status, await res.text());
  } catch (e) {
    console.error('[wa-push] error', e);
  }
}

async function handleStatuses(value: any) {
  const phoneNumberId = String(value.metadata?.phone_number_id || '');
  const audience = await audienceForPhoneId(phoneNumberId);
  const statusEmployer = await employerForPhoneId(phoneNumberId);
  for (const st of value.statuses || []) {
    const status = st.status; // sent | delivered | read | failed
    const patch: Record<string, unknown> = { status };
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    if (status === 'read') patch.read_at = new Date().toISOString();
    if (status === 'failed') patch.error_message = st.errors?.[0]?.title || st.errors?.[0]?.message || 'Delivery failed';

    if (audience) patch.audience = audience;
    if (phoneNumberId) patch.whatsapp_phone_number_id = phoneNumberId;
    if (st.id) await supabase.from('whatsapp_messages').update(patch).eq('msg91_message_id', st.id);
    await log(`message_${status}`, st, st.id);
    if (statusEmployer) await forwardToCustomerWebhooks(supabase, statusEmployer.user_id, 'whatsapp.message.status', { phone_number_id: phoneNumberId, message_id: st.id ?? null, status, recipient: st.recipient_id ?? null, timestamp: st.timestamp ?? null, errors: st.errors ?? null });
    await forwardSubAccount(phoneNumberId, 'whatsapp.message.status', { phone_number_id: phoneNumberId, message_id: st.id ?? null, status, recipient: st.recipient_id ?? null, timestamp: st.timestamp ?? null, errors: st.errors ?? null });
  }
}

async function handleTemplateStatus(value: any) {
  const name = value.message_template_name || value.name;
  if (!name) return;
  const status = String(value.event || value.status || '').toUpperCase();
  const patch: Record<string, unknown> = {
    status,
    last_synced_at: new Date().toISOString(),
    rejection_reason: value.reason && value.reason !== 'NONE' ? value.reason : null,
  };
  let query = supabase.from('whatsapp_templates').update(patch).eq('name', name);
  if (value.message_template_language) query = query.eq('language', value.message_template_language);
  await query;
  await log('message_template_status_update', value, value.message_template_id ?? null);
}

// Meta re-categorised a template (e.g. UTILITY -> MARKETING): mirror it so the website shows Meta's category.
async function handleTemplateCategory(value: any) {
  const name = value.message_template_name || value.name;
  const category = String(value.new_category || value.correct_category || '').toUpperCase();
  if (!name || !category) return;
  let query = supabase.from('whatsapp_templates')
    .update({ category: category.toLowerCase(), last_synced_at: new Date().toISOString() }).eq('name', name);
  if (value.message_template_language) query = query.eq('language', value.message_template_language);
  await query;
  await log('template_category_update', value, value.message_template_id ?? null);
}

// Live quality/tier tracking: Meta pushes phone_number_quality_update and account_update
// events; we store them so the send path can throttle exactly like Meta does, and alert
// the owner when a number's quality drops (a shared-quality risk for the whole app).
async function handleQualityUpdate(field: string, value: any) {
  const phoneNumberId = String(value.display_phone_number_id || value.phone_number_id || value.metadata?.phone_number_id || '');
  if (!phoneNumberId) return;
  const quality = String(value.current_limit ? value.quality_rating || '' : value.event || value.quality_rating || '').toUpperCase() || null;
  // current_limit is being removed by Meta; max_daily_conversations_per_business replaces it.
  const tier = normalizeTier(value.max_daily_conversations_per_business) ?? normalizeTier(value.current_limit);
  const patch: Record<string, unknown> = {};
  if (quality && ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].includes(quality)) patch.quality_rating = quality;
  if (tier) patch.messaging_tier = tier;
  if (!Object.keys(patch).length) return;

  const { data: empRow } = await supabase.from('employer_whatsapp_accounts')
    .update(patch).eq('phone_number_id', phoneNumberId).select('user_id, display_phone, quality_rating').maybeSingle();
  const { data: subRow } = await supabase.from('developer_sub_account_numbers')
    .update(patch).eq('phone_number_id', phoneNumberId).select('sub_account_id, display_phone, quality_rating').maybeSingle();
  await log(`quality_update_${field}`, { phone_number_id: phoneNumberId, ...patch });

  // Alert only on a downgrade to YELLOW/RED — the moment throttling actually kicks in.
  const newQuality = String(patch.quality_rating || '');
  if ((newQuality === 'YELLOW' || newQuality === 'RED') && (empRow || subRow)) {
    const phone = (empRow as any)?.display_phone || (subRow as any)?.display_phone || phoneNumberId;
    await notifyOwners({
      phone: String(phone).replace(/\D/g, ''), name: null, type: 'text',
      content: `⚠️ WhatsApp quality rating for +${String(phone).replace(/\D/g, '')} dropped to ${newQuality}. Sending limits are automatically reduced until Meta restores it.`,
      audience: null,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    const envTok = (Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '').trim();
    const { data: row } = await supabase.from('app_settings').select('setting_value')
      .eq('setting_key', 'fb_whatsapp_verify_token').maybeSingle();
    const dbTok = row?.setting_value ? String(row.setting_value).replace(/^"|"$/g, '').trim() : null;
    if (mode === 'subscribe' && token && (token === envTok || token === dbTok)) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    if (!(await verifySignature(rawBody, req.headers.get('x-hub-signature-256'), body))) {
      const reason = 'Missing or invalid signature for this Meta app';
      console.error('meta-whatsapp-webhook rejected:', reason);
      await log('signature_rejected', { reason }).catch(() => {});
      return new Response('Invalid signature', { status: 403, headers: corsHeaders });
    }
    if (await handleMetaSocialWebhook(supabase, body)) {
      return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
    }
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        if (value.messages?.length) await handleInbound(value);
        if (value.statuses?.length) await handleStatuses(value);
        if (change.field === 'message_template_status_update') await handleTemplateStatus(value);
        if (change.field === 'template_category_update') await handleTemplateCategory(value);
        if (change.field === 'phone_number_quality_update' || change.field === 'account_update') await handleQualityUpdate(change.field, value);
        if (!value.messages?.length && !value.statuses?.length) {
          await log(change.field || 'unknown', value);
          // Forward every other Meta WhatsApp webhook field to the number owner's endpoints.
          const fieldEmployer = await employerForPhoneId(String(value.metadata?.phone_number_id || ''));
          if (fieldEmployer && change.field) await forwardToCustomerWebhooks(supabase, fieldEmployer.user_id, `whatsapp.${change.field}`, { waba_id: entry.id ?? null, ...value });
          if (change.field) await forwardSubAccount(String(value.metadata?.phone_number_id || ''), `whatsapp.${change.field}`, { waba_id: entry.id ?? null, ...value });
        }
      }
    }
  } catch (e) {
    console.error('meta-whatsapp-webhook error', e);
    await log('error', { message: e instanceof Error ? e.message : String(e) });
  }

  // Always 200 so Meta does not retry endlessly
  return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
});
