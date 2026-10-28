// Meta Tech Provider Embedded Signup: connect a WhatsApp number per audience.
// Deployment marker: manual-connect-v3
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { buildTemplateComponents, uploadTemplateMedia } from '../_shared/whatsappCloud.ts';
import { handlePublicWhatsAppApi } from '../_shared/whatsappPublicApi.ts';
import { handleSubConnect, handleSubAccountAction } from '../_shared/whatsappSubAccounts.ts';
import { trackApiResponse } from '../_shared/apiQuota.ts';
import { consumeWhatsappSend, whatsappLimitError, tierLimitFromMeta, whatsappLimitsOverview } from '../_shared/whatsappRateLimit.ts';
import { handlePublicSocialApi } from '../_shared/socialPublicApi.ts';
import { handlePublicWidget, handleWidgetManage } from '../_shared/chatWidget.ts';
import { handleMetaSocial, getMetaAppCreds } from '../_shared/metaSocial.ts';
import { subChannelsOverview } from '../_shared/subAccountChannels.ts';
import { peekCachedTier, rememberLiveTier, refreshAllTiers, fetchLiveTier, readTier } from '../_shared/whatsappTierSync.ts';
import { needsWhatsAppRegistration } from '../_shared/whatsappSetup.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Function-Version': 'manual-connect-v3',
    },
  });

/** Maps raw database errors from account saves to a clean, user-facing message. */
const accountSaveError = (err: { message?: string } | null) => {
  const msg = err?.message || 'Could not save the WhatsApp account';
  if (msg.includes('already connected') || msg.includes('duplicate key')) {
    return 'This WhatsApp number is already connected elsewhere.';
  }
  return msg;
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('connect'),
    audience: z.enum(['job_seeker', 'employer', 'customer_service']),
    code: z.string().min(10).max(2000),
    waba_id: z.string().regex(/^\d+$/),
    phone_number_id: z.string().regex(/^\d+$/),
  }),

  z.object({
    action: z.literal('disconnect'),
    audience: z.enum(['job_seeker', 'employer', 'customer_service']),
  }),

  z.object({
    action: z.literal('refresh'),
    audience: z.enum(['job_seeker', 'employer', 'customer_service']),
  }),

  z.object({
    action: z.literal('manual_connect'),
    audience: z.enum(['job_seeker', 'employer', 'customer_service']),
    waba_id: z.string().regex(/^\d+$/),
    phone_number_id: z.string().regex(/^\d+$/),
    access_token: z.string().min(20).max(5000),
  }),
]);

async function g(
  path: string,
  token: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
) {
  const url = new URL(`${GRAPH}${path}`);

  for (const [k, v] of Object.entries(init.query ?? {})) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body:
      init.body === undefined
        ? undefined
        : JSON.stringify(init.body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw Object.assign(
      new Error(
        data?.error?.error_user_msg ||
          data?.error?.message ||
          `Meta error ${res.status}`,
      ),
      {
        details: data,
        status: res.status,
      },
    );
  }

  return data;
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');

  if (!token) return null;

  const { data } = await admin.auth.getUser(token);
  const uid = data.user?.id;

  if (!uid) return null;

  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', uid)
    .in('role', ['owner', 'admin']);

  return roles?.length ? uid : null;
}

/**
 * Get a phone number directly.
 *
 * IMPORTANT:
 * We intentionally DO NOT request:
 *
 *   whatsapp_business_account
 *
 * from the phone-number object.
 *
 * That field caused:
 *
 * (#100) Tried accessing nonexisting field (whatsapp_business_account)
 *
 * Instead, WABA ownership is verified through:
 *
 *   /{WABA_ID}/phone_numbers
 */
async function getPhone(
  phoneNumberId: string,
  token: string,
) {
  return await g(`/${phoneNumberId}`, token, {
    query: {
      fields:
        'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier',
    },
  });
}

/**
 * Verify that the selected phone number belongs to the selected WABA.
 *
 * We use the WABA phone_numbers edge instead of requesting
 * whatsapp_business_account from the phone object.
 */
async function verifyPhoneBelongsToWaba(
  wabaId: string,
  phoneNumberId: string,
  token: string,
) {
  const phone = await getPhone(phoneNumberId, token);

  if (String(phone?.id) !== String(phoneNumberId)) {
    throw new Error(
      'Meta returned a different phone number ID than expected.',
    );
  }

  let found = false;
  let after: string | undefined;

  // Usually the first page is enough, but pagination is handled
  // so larger WABAs are also supported.
  for (let page = 0; page < 10 && !found; page++) {
    const query: Record<string, string> = {
      fields:
        'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier',
      limit: '100',
    };

    if (after) {
      query.after = after;
    }

    const edge = await g(
      `/${wabaId}/phone_numbers`,
      token,
      { query },
    );

    const rows = Array.isArray(edge?.data)
      ? edge.data
      : [];

    found = rows.some(
      (row: any) =>
        String(row?.id) === String(phoneNumberId),
    );

    if (found) break;

    after = edge?.paging?.cursors?.after;

    if (!after) break;
  }

  if (!found) {
    throw new Error(
      'Phone number does not belong to the selected WhatsApp Business Account.',
    );
  }

  return phone;
}

// ================================================================
// EMPLOYER SCOPE: each company connects & chats on its own number
// ================================================================
const EmployerBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('connect'), code: z.string().min(10).max(2000), waba_id: z.string().regex(/^\d+$/), phone_number_id: z.string().regex(/^\d+$/) }),
  z.object({ action: z.literal('manual_connect'), waba_id: z.string().regex(/^\d+$/), phone_number_id: z.string().regex(/^\d+$/), access_token: z.string().min(20).max(5000) }),
  z.object({ action: z.literal('disconnect') }),
  z.object({
    action: z.literal('update_ai_settings'),
    settings: z.object({
      ai_auto_reply: z.boolean(),
      ai_tone: z.enum(['friendly', 'professional', 'concise', 'supportive']),
      ai_language: z.enum(['auto', 'English', 'Hindi', 'Hinglish']),
      ai_reply_length: z.enum(['short', 'medium', 'long']),
      ai_business_info: z.string().max(3000),
      ai_custom_instructions: z.string().max(1500),
      ai_signature: z.string().max(200),
    }),
  }),
  z.object({ action: z.literal('send'), conversation_id: z.string().uuid(), message: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('send_reply'), phone_number: z.string().regex(/^\+?\d{6,16}$/), message: z.string().trim().min(1).max(4000), conversation_id: z.string().uuid().optional().nullable(), reply_to_message_id: z.string().uuid().optional().nullable(), reply_to_wa_message_id: z.string().max(200).optional().nullable() }),
  z.object({ action: z.literal('send_media'), phone_number: z.string().regex(/^\+?\d{6,16}$/), media_url: z.string().url().max(2000), media_type: z.enum(['image', 'video', 'audio', 'document']), conversation_id: z.string().uuid().optional().nullable(), caption: z.string().max(1024).optional().nullable() }),
  z.object({ action: z.literal('advanced'), advanced_action: z.literal('send_reaction'), phone_number: z.string().regex(/^\+?\d{6,16}$/), wa_message_id: z.string().min(1).max(200), emoji: z.string().max(16) }),
  z.object({ action: z.literal('get_profile') }),
  z.object({
    action: z.literal('update_profile'),
    about: z.string().trim().min(1).max(139),
    description: z.string().max(512).optional(),
    address: z.string().max(256).optional(),
    email: z.union([z.string().email().max(128), z.literal('')]).optional(),
    websites: z.array(z.string().url().max(256)).max(2).optional(),
    vertical: z.string().max(50).optional(),
    profile_picture: z.string().max(8_000_000).optional(),
  }),
  z.object({ action: z.literal('set_pin'), pin: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal('register_number'), pin: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal('get_calling_settings') }),
  z.object({ action: z.literal('update_calling_settings'), calling: z.record(z.unknown()) }),
  z.object({ action: z.literal('list_all_templates') }),
  z.object({ action: z.literal('upload_template_media'), data_url: z.string().max(25_000_000) }),
  z.object({
    action: z.enum(['create_template', 'edit_template']),
    template_id: z.string().regex(/^\d+$/).optional().nullable(),
    template_name: z.string().regex(/^[a-z0-9_]{1,512}$/),
    language: z.string().min(2).max(20).default('en_US'),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('UTILITY'),
    content: z.string().trim().max(1024).optional().default(''),
    header_type: z.enum(['none', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().nullable(),
    header_handle: z.string().max(2000).optional().nullable(),
    add_security_recommendation: z.boolean().optional(),
    code_expiration_minutes: z.number().int().min(1).max(90).optional().nullable(),
    otp_button_text: z.string().max(25).optional().nullable(),
    otp_type: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']).optional().nullable(),
    autofill_text: z.string().max(25).optional().nullable(),
    zero_tap_terms_accepted: z.boolean().optional(),
    supported_apps: z.array(z.object({ package_name: z.string().regex(/^[A-Za-z0-9_.]{1,224}$/), signature_hash: z.string().length(11) })).max(5).optional(),
    header_content: z.string().max(60).optional().nullable(),
    footer: z.string().max(60).optional().nullable(),
    examples: z.array(z.string().max(200)).max(20).optional(),
    buttons: z.array(z.object({ type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']), text: z.string().min(1).max(25), url: z.string().url().max(2000).optional(), phone_number: z.string().max(20).optional() })).max(10).optional(),
  }),
  z.object({ action: z.literal('delete_template'), template_name: z.string().regex(/^[a-z0-9_]{1,512}$/) }),
  z.object({ action: z.literal('get_templates') }),
  z.object({
    action: z.literal('send_template'),
    phone_number: z.string().regex(/^\+?\d{6,16}$/),
    template_name: z.string().min(1).max(200),
    template_language: z.string().min(2).max(20),
    conversation_id: z.string().uuid().optional().nullable(),
    body_params: z.array(z.string().max(1024)).max(20).optional(),
    template_body: z.string().max(4000).optional().nullable(),
  }),
]);

async function handleEmployer(req: Request, raw: unknown) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const uid = u.user?.id;
  if (!uid) return json({ success: false, error: 'Please sign in' }, 401);
  const { data: company } = await admin.from('companies').select('id').eq('user_id', uid).limit(1).maybeSingle();
  if (!company?.id) return json({ success: false, error: 'No company profile found' }, 403);
  const companyId = company.id as string;

  const rawAny = (raw || {}) as Record<string, unknown>;
  const wantPid = typeof rawAny.phone_number_id === 'string' && /^\d{5,30}$/.test(rawAny.phone_number_id) ? rawAny.phone_number_id : null;
  const listNumbers = async () => {
    const { data } = await admin.from('employer_whatsapp_accounts')
      .select('id,waba_id,phone_number_id,status,display_phone,verified_name,business_name,quality_rating,messaging_tier,connected_at,is_default')
      .eq('company_id', companyId).eq('status', 'connected').not('phone_number_id', 'is', null)
      .order('is_default', { ascending: false }).order('connected_at', { ascending: true });
    return (data || []) as any[];
  };
  const pickAccount = async () => {
    const rows = await listNumbers();
    return (wantPid ? rows.find((r) => r.phone_number_id === wantPid) : rows[0]) ?? null;
  };
  const tokenFor = async (pid: string | null | undefined) => {
    if (!pid) return undefined;
    const { data } = await admin.from('employer_whatsapp_tokens').select('access_token').eq('company_id', companyId).eq('phone_number_id', pid).maybeSingle();
    return (data as any)?.access_token as string | undefined;
  };
  // Meta-style tiered limit on the employer's own number (24h tier cap + burst + quality throttle).
  const checkEmployerSendLimit = async (acc: any) => {
    // Meta's most recent tier/quality wins over the stored copy, so a missed webhook can
    // never let a send through that Meta would reject.
    const live = peekCachedTier(acc?.phone_number_id);
    const r = await consumeWhatsappSend(admin, { phoneNumberId: acc.phone_number_id }, {
      tierLimit: tierLimitFromMeta(live?.messaging_tier ?? acc?.messaging_tier),
      quality: live?.quality_rating ?? acc?.quality_rating ?? null,
    });
    if (r.allowed) return null;
    return json(whatsappLimitError(r), 200);
  };
  if (rawAny.action === 'list_numbers') {
    const rows = await listNumbers();
    return json({ success: true, numbers: rows.map(({ id: _id, ...r }) => r) });
  }
  if (rawAny.action === 'set_default') {
    if (!wantPid) return json({ success: false, error: 'phone_number_id is required' }, 400);
    const rows = await listNumbers();
    if (!rows.some((r) => r.phone_number_id === wantPid)) return json({ success: false, error: 'Number not found' }, 404);
    await admin.from('employer_whatsapp_accounts').update({ is_default: false }).eq('company_id', companyId);
    await admin.from('employer_whatsapp_accounts').update({ is_default: true }).eq('company_id', companyId).eq('phone_number_id', wantPid);
    return json({ success: true });
  }

  const parsed = EmployerBody.safeParse(raw);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;
  const now = new Date().toISOString();

  if (b.action === 'disconnect') {
    const target = await pickAccount();
    if (!target) return json({ success: true });
    await admin.from('employer_whatsapp_tokens').delete().eq('company_id', companyId).eq('phone_number_id', target.phone_number_id);
    await admin.from('employer_whatsapp_accounts').delete().eq('id', target.id);
    if (target.is_default) {
      const rest = await listNumbers();
      if (rest[0]) await admin.from('employer_whatsapp_accounts').update({ is_default: true }).eq('id', rest[0].id);
    }
    return json({ success: true });
  }

  if (b.action === 'update_ai_settings') {
    const target = await pickAccount();
    if (!target?.phone_number_id) return json({ success: false, error: 'WhatsApp number not found' }, 404);
    const { error } = await admin.from('employer_whatsapp_accounts').update(b.settings)
      .eq('company_id', companyId).eq('phone_number_id', target.phone_number_id);
    if (error) return json({ success: false, error: error.message }, 400);
    return json({ success: true });
  }

  const loadEmployerCreds = async () => {
    const acc = await pickAccount();
    return { acc: acc as any, token: await tokenFor(acc?.phone_number_id) };
  };

  if (b.action === 'get_profile') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !acc.waba_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    const live = await g(`/${acc.phone_number_id}`, token, {
      query: { fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status,platform_type,throughput' },
    });
    const setupStatus = await g(`/${acc.phone_number_id}`, token, {
      query: { fields: 'status,is_pin_enabled' },
    }).catch(() => ({}));
    // The portfolio-level limit (what WhatsApp Manager shows) comes from the new field only.
    const liveTier = await fetchLiveTier(String(acc.phone_number_id), token);
    const currentTier = liveTier?.messaging_tier ?? readTier(live);
    const businessProfile = await g(`/${acc.phone_number_id}/whatsapp_business_profile`, token, {
      query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url,messaging_product' },
    }).catch(() => ({ data: [] }));
    const waba = await g(`/${acc.waba_id}`, token, {
      query: { fields: 'id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,currency' },
    }).catch(() => ({}));
    // Meta just answered with this number's current tier and quality: store them so the
    // limits page and the send path use Meta's truth, not the value from connect time.
    await rememberLiveTier(admin, acc.phone_number_id, {
      quality_rating: typeof live?.quality_rating === 'string' ? live.quality_rating : null,
      messaging_tier: currentTier,
    });
    return json({
      success: true,
      profile: {
        phone_number: live?.display_phone_number ?? acc.display_phone ?? null,
        verified_name: live?.verified_name ?? acc.verified_name ?? null,
        business_name: acc.business_name ?? null,
        quality_rating: live?.quality_rating ?? acc.quality_rating ?? null,
        messaging_limit: currentTier,
        display_name_status: live?.name_status ?? null,
        code_verification_status: live?.code_verification_status ?? null,
        platform_type: live?.platform_type ?? null,
        status: setupStatus?.status ?? null,
        is_pin_enabled: typeof setupStatus?.is_pin_enabled === 'boolean' ? setupStatus.is_pin_enabled : null,
        throughput: live?.throughput?.level ?? null,
        account_review_status: waba?.account_review_status ?? null,
        business_verification_status: waba?.business_verification_status ?? null,
        timezone_id: waba?.timezone_id ?? null,
        currency: waba?.currency ?? null,
        message_template_namespace: waba?.message_template_namespace ?? null,
        waba_id: acc.waba_id ?? null,
        phone_number_id: acc.phone_number_id ?? null,
        connected_at: acc.connected_at ?? null,
        ...(businessProfile?.data?.[0] || {}),
      },
    });
  }

  if (b.action === 'update_profile') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      about: b.about,
      description: b.description ?? '',
      address: b.address ?? '',
      email: b.email ?? '',
      websites: b.websites ?? [],
    };
    if (b.vertical) payload.vertical = b.vertical;
    if (b.profile_picture) {
      const match = b.profile_picture.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
      if (!match) return json({ success: false, error: 'Choose a JPG or PNG picture.' }, 400);
      const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) return json({ success: false, error: 'Picture must be under 5 MB.' }, 400);
      const { appId } = await getMetaAppCreds(admin);
      const session = await g(`/${appId}/uploads`, token, {
        method: 'POST',
        query: { file_length: String(bytes.byteLength), file_type: match[1], file_name: 'profile-picture' },
      });
      const upload = await fetch(`${GRAPH}/${session.id}`, {
        method: 'POST',
        headers: { Authorization: `OAuth ${token}`, file_offset: '0', 'Content-Type': match[1] },
        body: bytes,
      });
      const uploaded = await upload.json().catch(() => ({}));
      if (!upload.ok || !uploaded?.h) return json({ success: false, error: uploaded?.error?.message || 'Meta could not upload the picture.' }, upload.status || 400);
      payload.profile_picture_handle = uploaded.h;
    }
    await g(`/${acc.phone_number_id}/whatsapp_business_profile`, token, { method: 'POST', body: payload });
    const fresh = await g(`/${acc.phone_number_id}/whatsapp_business_profile`, token, {
      query: { fields: 'about,address,description,email,websites,vertical,profile_picture_url,messaging_product' },
    }).catch(() => ({ data: [] }));
    return json({ success: true, profile: fresh?.data?.[0] || {} });
  }

  if (b.action === 'set_pin') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    try { await g(`/${acc.phone_number_id}`, token, { method: 'POST', body: { pin: b.pin } }); }
    catch (e: any) {
      // Number not yet registered on Cloud API: register it with this PIN instead.
      if (!/does not exist in Cloud API|\/register/i.test(String(e?.message))) throw e;
      await g(`/${acc.phone_number_id}/register`, token, { method: 'POST', body: { messaging_product: 'whatsapp', pin: b.pin } });
    }
    return json({ success: true });
  }

  if (b.action === 'register_number') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 400);
    const phone = await g(`/${acc.phone_number_id}`, token, { query: { fields: 'status,is_pin_enabled' } });
    if (!needsWhatsAppRegistration(phone)) return json({ success: false, error: 'This number does not require registration. Refresh its setup status.' }, 409);
    const result = await g(`/${acc.phone_number_id}/register`, token, { method: 'POST', body: { messaging_product: 'whatsapp', pin: b.pin } });
    return json({ success: result?.success === true });
  }

  if (b.action === 'get_calling_settings') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    const settings = await g(`/${acc.phone_number_id}/settings`, token, { query: { fields: 'calling' } });
    return json({ success: true, calling: settings?.calling ?? settings?.data?.[0]?.calling ?? null });
  }

  if (b.action === 'update_calling_settings') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    const source = b.calling as Record<string, any>;
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
      const status = String(source.call_hours?.status || 'DISABLED').toUpperCase();
      if (!['ENABLED', 'DISABLED'].includes(status)) return json({ success: false, error: 'Invalid call hours status.' }, 400);
      const validDays = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
      const weekly = Array.isArray(source.call_hours?.weekly_operating_hours) ? source.call_hours.weekly_operating_hours.slice(0, 14) : [];
      const holidays = Array.isArray(source.call_hours?.holiday_schedule) ? source.call_hours.holiday_schedule.slice(0, 50) : [];
      if (weekly.some((item: any) => !validDays.has(String(item?.day_of_week)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.open_time)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.close_time)))) return json({ success: false, error: 'Weekly call hours are invalid.' }, 400);
      if (holidays.some((item: any) => !/^\d{4}-\d{2}-\d{2}$/.test(String(item?.date)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.start_time)) || !/^([01]\d|2[0-3])[0-5]\d$/.test(String(item?.end_time)))) return json({ success: false, error: 'Holiday call hours are invalid.' }, 400);
      const timezoneId = String(source.call_hours?.timezone_id || '').trim();
      if (status === 'ENABLED' && !timezoneId) return json({ success: false, error: 'A timezone is required when call hours are enabled.' }, 400);
      calling.call_hours = {
        status,
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
    await g(`/${acc.phone_number_id}/settings`, token, { method: 'POST', body: { calling } });
    const fresh = await g(`/${acc.phone_number_id}/settings`, token, { query: { fields: 'calling' } });
    return json({ success: true, calling: fresh?.calling ?? fresh?.data?.[0]?.calling ?? calling });
  }

  if (b.action === 'upload_template_media') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    try {
      const { appId } = await getMetaAppCreds(admin);
      return json({ success: true, handle: await uploadTemplateMedia(token, appId, b.data_url) });
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'Upload failed' }, 200);
    }
  }

  if (b.action === 'list_all_templates' || b.action === 'create_template' || b.action === 'edit_template' || b.action === 'delete_template') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.waba_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    try {
      if (b.action === 'list_all_templates') {
        const edge = await g(`/${acc.waba_id}/message_templates`, token, { query: { fields: 'id,name,status,category,language,components,rejected_reason', limit: '200' } });
        return json({ success: true, data: Array.isArray(edge?.data) ? edge.data : [] });
      }
      if (b.action === 'delete_template') {
        await g(`/${acc.waba_id}/message_templates`, token, { method: 'DELETE', query: { name: b.template_name } });
        return json({ success: true });
      }
      if (b.category !== 'AUTHENTICATION' && !b.content.trim()) return json({ success: false, error: 'Message text is required' }, 400);
      const components = buildTemplateComponents(b as any);
      if (b.action === 'edit_template') {
        if (!b.template_id) return json({ success: false, error: 'Template ID missing' }, 400);
        const owned = await g(`/${acc.waba_id}/message_templates`, token, { query: { fields: 'id,name', name: b.template_name, limit: '100' } });
        if (!(owned?.data || []).some((t: any) => t?.id === b.template_id)) return json({ success: false, error: 'Template not found' }, 404);
        await g(`/${b.template_id}`, token, { method: 'POST', body: { components } });
        return json({ success: true });
      }
      const res = await g(`/${acc.waba_id}/message_templates`, token, { method: 'POST', body: { name: b.template_name, language: b.language, category: b.category, components } });
      return json({ success: true, template_id: res?.id, status: res?.status });
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'Meta request failed' }, 200);
    }
  }

  if (b.action === 'get_templates') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.waba_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    let edge: any;
    try {
      edge = await g(`/${acc.waba_id}/message_templates`, token, {
        query: { fields: 'id,name,status,category,language,components', limit: '100' },
      });
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'Could not load templates' }, 200);
    }
    const rows = Array.isArray(edge?.data) ? edge.data : [];
    const approved = rows.filter((t: any) => String(t?.status || '').toUpperCase() === 'APPROVED');
    return json({ success: true, data: approved });
  }

  if (b.action === 'send_template') {
    const { acc, token } = await loadEmployerCreds();
    if (acc?.status !== 'connected' || !acc.phone_number_id || !acc.waba_id || !token) return json({ success: false, error: 'WhatsApp is not connected' }, 200);
    const templateLimited = await checkEmployerSendLimit(acc);
    if (templateLimited) return templateLimited;
    let approvedTemplate: any = null;
    try {
      const edge = await g(`/${acc.waba_id}/message_templates`, token, {
        query: { fields: 'id,name,status,language,category', name: b.template_name, limit: '100' },
      });
      approvedTemplate = (Array.isArray(edge?.data) ? edge.data : []).find(
        (item: any) => item?.name === b.template_name
          && item?.language === b.template_language
          && String(item?.status || '').toUpperCase() === 'APPROVED',
      );
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'Could not verify template approval' }, 200);
    }
    if (!approvedTemplate) return json({ success: false, error: 'This template is not approved by Meta' }, 200);
    const phone = b.phone_number.replace(/\D/g, '');
    const params = (b.body_params || []).map((t) => ({ type: 'text', text: t }));
    const template: Record<string, unknown> = {
      name: b.template_name,
      language: { code: b.template_language },
    };
    const comps: any[] = [];
    if (params.length > 0) comps.push({ type: 'body', parameters: params });
    if (String(approvedTemplate?.category || '').toUpperCase() === 'AUTHENTICATION' && b.body_params?.[0]) {
      comps.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: b.body_params[0] }] });
    }
    if (comps.length) template.components = comps;
    const res = await fetch(`${GRAPH}/${acc.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template', template }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ success: false, error: data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}`, details: data }, 200);
    }

    let convId = b.conversation_id ?? null;
    if (convId) {
      const { data: c } = await admin.from('whatsapp_conversations').select('id,company_id,phone_number,whatsapp_phone_number_id').eq('id', convId).maybeSingle();
      if (!c || c.company_id !== companyId || c.whatsapp_phone_number_id !== acc.phone_number_id || c.phone_number !== phone) convId = null;
    }
    if (!convId) {
      const { data: c } = await admin.from('whatsapp_conversations').select('id').eq('company_id', companyId).eq('phone_number', phone).eq('whatsapp_phone_number_id', acc.phone_number_id).limit(1).maybeSingle();
      convId = c?.id ?? null;
      if (!convId) {
        const { data: ins, error } = await admin.from('whatsapp_conversations').insert({ phone_number: phone, company_id: companyId, whatsapp_phone_number_id: acc.phone_number_id, last_message_at: now, unread_count: 0 }).select('id').single();
        if (error) return json({ success: false, error: error.message }, 400);
        convId = ins.id;
      }
    }
    let preview = b.template_body || b.template_name;
    (b.body_params || []).forEach((v, i) => { preview = preview.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v); });
    await admin.from('whatsapp_messages').insert({
      conversation_id: convId, company_id: companyId, direction: 'outbound', recipient_phone: phone,
      message_content: preview, message_type: 'template', template_name: b.template_name, status: 'sent',
      msg91_message_id: data?.messages?.[0]?.id ?? null, whatsapp_phone_number_id: acc.phone_number_id,
      sent_at: now, metadata: { provider: 'cloud_api', template_language: b.template_language, body_params: b.body_params || [] },
    });
    await admin.from('whatsapp_conversations').update({ last_message_at: now, last_message_preview: preview.slice(0, 100) }).eq('id', convId);
    return json({ success: true, message_id: data?.messages?.[0]?.id ?? null });
  }



  if (b.action === 'send_reply' || b.action === 'send_media' || b.action === 'advanced') {
    const { acc, token: accessToken } = await loadEmployerCreds();
    const tok = { access_token: accessToken };
    if (acc?.status !== 'connected' || !acc.phone_number_id || !tok?.access_token) return json({ success: false, error: 'WhatsApp is not connected' }, 400);
    const replyLimited = await checkEmployerSendLimit(acc);
    if (replyLimited) return replyLimited;
    const phone = b.phone_number.replace(/\D/g, '');
    let payload: Record<string, unknown>;
    let preview = '';
    let msgType = 'text';
    let content: string | null = null;
    const meta: Record<string, unknown> = { provider: 'cloud_api' };
    if (b.action === 'advanced') {
      payload = { type: 'reaction', reaction: { message_id: b.wa_message_id, emoji: b.emoji } };
    } else if (b.action === 'send_reply') {
      payload = { type: 'text', text: { body: b.message } };
      if (b.reply_to_wa_message_id) payload.context = { message_id: b.reply_to_wa_message_id };
      preview = b.message; content = b.message;
    } else {
      const media: Record<string, unknown> = { link: b.media_url };
      if (b.caption && b.media_type !== 'audio') media.caption = b.caption;
      if (b.media_type === 'document') media.filename = decodeURIComponent(b.media_url.split('/').pop()?.split('?')[0] || 'document');
      payload = { type: b.media_type, [b.media_type]: media };
      msgType = b.media_type; content = b.caption || null; meta.media_url = b.media_url;
      preview = b.caption || `[${b.media_type}]`;
    }
    const res = await fetch(`${GRAPH}/${acc.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}`;
      const expired = data?.error?.code === 131047;
      return json({ success: false, error: expired ? '24-hour session expired' : msg, details: data }, 200);
    }
    if (b.action === 'advanced') return json({ success: true });

    let convId = b.conversation_id ?? null;
    if (convId) {
      const { data: c } = await admin.from('whatsapp_conversations').select('id,company_id,phone_number,whatsapp_phone_number_id').eq('id', convId).maybeSingle();
      if (!c || c.company_id !== companyId || c.whatsapp_phone_number_id !== acc.phone_number_id || c.phone_number !== phone) convId = null;
    }
    if (!convId) {
      const { data: c } = await admin.from('whatsapp_conversations').select('id').eq('company_id', companyId).eq('phone_number', phone).eq('whatsapp_phone_number_id', acc.phone_number_id).limit(1).maybeSingle();
      convId = c?.id ?? null;
      if (!convId) {
        const { data: ins, error } = await admin.from('whatsapp_conversations').insert({ phone_number: phone, company_id: companyId, whatsapp_phone_number_id: acc.phone_number_id, last_message_at: now, unread_count: 0 }).select('id').single();
        if (error) return json({ success: false, error: error.message }, 400);
        convId = ins.id;
      }
    }
    await admin.from('whatsapp_messages').insert({
      conversation_id: convId, company_id: companyId, direction: 'outbound', recipient_phone: phone,
      message_content: content, message_type: msgType, template_name: msgType, status: 'sent',
      msg91_message_id: data?.messages?.[0]?.id ?? null, whatsapp_phone_number_id: acc.phone_number_id,
      reply_to_message_id: b.action === 'send_reply' ? (b.reply_to_message_id ?? null) : null,
      sent_at: now, metadata: meta,
    });
    await admin.from('whatsapp_conversations').update({ last_message_at: now, last_message_preview: preview.slice(0, 100) }).eq('id', convId);
    return json({ success: true, message_id: data?.messages?.[0]?.id ?? null });
  }

  if (b.action === 'send') {
    const { data: conv } = await admin.from('whatsapp_conversations').select('id,phone_number,company_id,whatsapp_phone_number_id').eq('id', b.conversation_id).maybeSingle();
    const { acc, token: accessToken } = await loadEmployerCreds();
    const tok = { access_token: accessToken };
    if (acc?.status !== 'connected' || !acc.phone_number_id || !tok?.access_token) return json({ success: false, error: 'WhatsApp is not connected' }, 400);
    const sendLimited = await checkEmployerSendLimit(acc);
    if (sendLimited) return sendLimited;
    if (!conv || conv.company_id !== companyId || conv.whatsapp_phone_number_id !== acc.phone_number_id) return json({ success: false, error: 'Conversation not found' }, 404);
    const res = await fetch(`${GRAPH}/${acc.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: conv.phone_number, type: 'text', text: { body: b.message } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ success: false, error: data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}`, details: data }, 400);
    }
    await admin.from('whatsapp_messages').insert({
      conversation_id: conv.id, company_id: companyId, direction: 'outbound', recipient_phone: conv.phone_number,
      message_content: b.message, message_type: 'text', template_name: 'text', status: 'sent',
      msg91_message_id: data?.messages?.[0]?.id ?? null, whatsapp_phone_number_id: acc.phone_number_id,
      sent_at: now, metadata: { provider: 'cloud_api' },
    });
    await admin.from('whatsapp_conversations').update({ last_message_at: now, last_message_preview: b.message.slice(0, 100) }).eq('id', conv.id);
    return json({ success: true });
  }

  // Manual setup (without Facebook login) is owner-only — employers connect with Facebook.
  if (rawAny.action === 'manual_connect') {
    return json({ success: false, error: 'Manual setup is not available for company WhatsApp. Please connect with Facebook.' }, 400);
  }

  // connect / manual_connect
  if (b.action !== 'connect' && b.action !== 'manual_connect') {
    return json({ success: false, error: 'Unsupported WhatsApp action' }, 400);
  }
  let token: string;
  let tokenType = 'MANUAL';
  let expiresAt: string | null = null;
  if (b.action === 'manual_connect') {
    token = b.access_token;
  } else {
    const { appId, secret } = await getMetaAppCreds(admin);
    if (!secret) return json({ success: false, error: 'META_APP_SECRET is not configured' }, 500);
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', secret);
    tokenUrl.searchParams.set('code', b.code);
    const tRes = await fetch(tokenUrl);
    const tData = await tRes.json().catch(() => ({}));
    if (!tRes.ok || !tData.access_token) return json({ success: false, error: tData?.error?.message || 'Code exchange failed' }, 400);
    token = tData.access_token;
    const debug = await g('/debug_token', `${appId}|${secret}`, { query: { input_token: token } });
    if (!debug?.data?.is_valid || String(debug.data.app_id) !== String(appId)) return json({ success: false, error: 'Meta returned an invalid token' }, 400);
    tokenType = debug.data.type ?? 'BUSINESS';
    expiresAt = Number(debug.data.expires_at) > 0 ? new Date(Number(debug.data.expires_at) * 1000).toISOString() : null;
  }

  const waba = await g(`/${b.waba_id}`, token, { query: { fields: 'id,name' } });
  if (String(waba?.id) !== String(b.waba_id)) return json({ success: false, error: 'Invalid WhatsApp Business Account ID.' }, 400);
  const phone = await verifyPhoneBelongsToWaba(b.waba_id, b.phone_number_id, token);
  const warnings: string[] = [];
  try { await g(`/${b.waba_id}/subscribed_apps`, token, { method: 'POST' }); }
  catch (e: any) { warnings.push(`Webhook subscribe: ${e.message}`); }

  const { error: accErr } = await admin.from('employer_whatsapp_accounts').upsert({
    company_id: companyId, user_id: uid, waba_id: b.waba_id, phone_number_id: b.phone_number_id,
    display_phone: phone.display_phone_number ?? null, verified_name: phone.verified_name ?? null,
    quality_rating: phone.quality_rating ?? null, messaging_tier: readTier(phone), business_name: waba?.name ?? null,
    status: 'connected', connected_via: b.action === 'manual_connect' ? 'manual' : 'embedded_signup', connected_at: now,
    is_default: (await listNumbers()).filter((r) => r.phone_number_id !== b.phone_number_id).length === 0,
    ...(typeof rawAny.dev_ref === 'string' && /^[0-9a-f-]{36}$/i.test(rawAny.dev_ref) && rawAny.dev_ref !== uid
      ? { referred_by_developer: rawAny.dev_ref } : {}),
  }, { onConflict: 'company_id,phone_number_id' });
  if (accErr) return json({ success: false, error: accErr.message.includes('already connected') ? 'This WhatsApp number is already connected elsewhere.' : accErr.message }, 400);
  const { error: tokErr } = await admin.from('employer_whatsapp_tokens').upsert({
    company_id: companyId, phone_number_id: b.phone_number_id, access_token: token, token_type: tokenType, expires_at: expiresAt, updated_at: now,
  }, { onConflict: 'company_id,phone_number_id' });
  if (tokErr) throw tokErr;
  return json({ success: true, display_phone: phone.display_phone_number ?? null, warnings });
}

// Partner (developer) scope: a developer can message customers who connected
// WhatsApp through that developer's referral link (referred_by_developer = developer uid).
async function handlePartner(req: Request, raw: unknown) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const uid = u.user?.id;
  if (!uid) return json({ success: false, error: 'Please sign in' }, 401);

  const rawAny = (raw || {}) as Record<string, unknown>;
  if (rawAny.action !== 'send_to_customer') return json({ success: false, error: 'Unknown action' }, 400);

  const pid = typeof rawAny.phone_number_id === 'string' && /^\d{5,30}$/.test(rawAny.phone_number_id) ? rawAny.phone_number_id : null;
  const to = typeof rawAny.to === 'string' ? rawAny.to.replace(/\D/g, '') : '';
  const message = typeof rawAny.message === 'string' ? rawAny.message.trim().slice(0, 4000) : '';
  if (!pid) return json({ success: false, error: 'Valid phone_number_id is required' }, 400);
  if (!/^\d{8,15}$/.test(to)) return json({ success: false, error: 'Valid customer mobile number is required' }, 400);
  if (!message) return json({ success: false, error: 'Message is required' }, 400);

  // Only allowed for connections referred by THIS developer
  const { data: acc } = await admin.from('employer_whatsapp_accounts')
    .select('id,company_id,phone_number_id,status,referred_by_developer')
    .eq('phone_number_id', pid).eq('referred_by_developer', uid).eq('status', 'connected')
    .maybeSingle();
  if (!acc) return json({ success: false, error: 'This connection is not linked to your partner account' }, 403);

  const { data: tok } = await admin.from('employer_whatsapp_tokens')
    .select('access_token').eq('company_id', acc.company_id).eq('phone_number_id', pid).maybeSingle();
  if (!tok?.access_token) return json({ success: false, error: 'Customer WhatsApp token not available' }, 400);

  const res = await fetch(`${GRAPH}/${pid}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ success: false, error: data?.error?.error_user_msg || data?.error?.message || `Meta error ${res.status}` }, 400);
  }
  return json({ success: true, message_id: data?.messages?.[0]?.id ?? null });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Headers': `${(corsHeaders as any)['Access-Control-Allow-Headers'] || 'authorization, x-client-info, apikey, content-type'}, x-api-key` },
    });
  }
  if ((req.headers.get('x-api-key') || '').startsWith('wfh_')) {
    const peek = await req.clone().json().catch(() => ({}));
    if (peek?.platform === 'instagram' || peek?.platform === 'facebook') return trackApiResponse(req, () => handlePublicSocialApi(req));
    return trackApiResponse(req, () => handlePublicWhatsAppApi(req));
  }

  try {
    let raw = await req.json().catch(() => ({}));
    // Daily cron backstop (formerly the whatsapp-tier-refresh function): re-reads tier,
    // quality and Meta block status for every number. Only refreshes from Meta; returns counts.
    if (raw?.scope === 'tier_refresh') return json({ success: true, ...(await refreshAllTiers(admin)) });
    if (raw?.scope === 'widget') return await handlePublicWidget(req, raw, admin);
    if (raw?.scope === 'widget_manage') return await handleWidgetManage(req, raw, admin);
    if (raw?.scope === 'employer') return await handleEmployer(req, raw);
    if (raw?.scope === 'partner') return await handlePartner(req, raw);
    if (raw?.scope === 'sub_manage') {
      // Developer Portal page: signed-in developer can disconnect their own sub-account
      // numbers and view their own WhatsApp usage/limits overview.
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
      if (!u.user?.id) return json({ success: false, error: 'Please sign in' }, 401);
      if (raw.action === 'limits_overview') {
        const { data: keyRow } = await admin.from('api_keys').select('id').eq('user_id', u.user.id).eq('is_active', true).limit(1).maybeSingle();
        return json(await whatsappLimitsOverview(admin, u.user.id, keyRow?.id ?? null));
      }
      if (raw.action === 'channels_overview') {
        return json({ success: true, overview: await subChannelsOverview(admin, u.user.id) });
      }
      if (raw.action !== 'disconnect_sub_account') return json({ success: false, error: 'Unknown action' }, 400);
      const [st, body] = await handleSubAccountAction(admin, u.user.id, raw);
      return json(body, st);
    }
    if (raw?.scope === 'sub_connect') { const [st, body] = await handleSubConnect(admin, raw); return json(body, st); }
    if (raw?.scope === 'meta_social') return await handleMetaSocial(req, raw, admin);

    // Only owner/admin can connect WhatsApp accounts.
    const adminUid = await requireAdmin(req);
    if (!adminUid) {
      return json(
        {
          success: false,
          error: 'Only owner/admin can do this',
        },
        403,
      );
    }

    if (raw.action === 'list_notification_sources') {
      const [{ data: audienceRows, error: audienceError }, { data: ownRows, error: ownError }] = await Promise.all([
        admin.from('whatsapp_audience_accounts').select('audience,phone_number_id,display_phone,verified_name,business_name').eq('status', 'connected'),
        admin.from('employer_whatsapp_accounts').select('phone_number_id,display_phone,verified_name,business_name').eq('user_id', adminUid).eq('status', 'connected'),
      ]);
      if (audienceError || ownError) throw audienceError || ownError;
      return json({ success: true, sources: [
        ...(audienceRows || []).filter((row) => row.phone_number_id).map((row) => ({ ...row, source: 'audience', source_id: row.audience })),
        ...(ownRows || []).filter((row) => row.phone_number_id).map((row) => ({ ...row, source: 'ai_connect', source_id: row.phone_number_id })),
      ] });
    }
    if (raw.action === 'reuse_connection') {
      const reuse = z.object({ audience: z.enum(['job_seeker', 'employer']), source: z.enum(['audience', 'ai_connect']), source_id: z.string().min(1).max(40) }).safeParse(raw);
      if (!reuse.success) return json({ success: false, error: 'Choose a connected number and a notification audience.' }, 400);
      const choice = reuse.data;
      let sourceAccount: { waba_id: string | null; phone_number_id: string | null } | null = null;
      let sourceToken: string | null = null;
      if (choice.source === 'audience') {
        if (!['job_seeker', 'employer', 'customer_service'].includes(choice.source_id) || choice.source_id === choice.audience) return json({ success: false, error: 'Choose another connected audience.' }, 400);
        const { data: account, error } = await admin.from('whatsapp_audience_accounts').select('waba_id,phone_number_id').eq('audience', choice.source_id).eq('status', 'connected').maybeSingle();
        if (error) throw error;
        sourceAccount = account;
        const { data: token, error: tokenError } = await admin.from('whatsapp_audience_tokens').select('access_token').eq('audience', choice.source_id).maybeSingle();
        if (tokenError) throw tokenError;
        sourceToken = token?.access_token || null;
      } else {
        if (!/^\d+$/.test(choice.source_id)) return json({ success: false, error: 'Invalid connected number.' }, 400);
        const { data: account, error } = await admin.from('employer_whatsapp_accounts').select('company_id,waba_id,phone_number_id').eq('user_id', adminUid).eq('phone_number_id', choice.source_id).eq('status', 'connected').maybeSingle();
        if (error) throw error;
        sourceAccount = account;
        if (account) {
          const { data: token, error: tokenError } = await admin.from('employer_whatsapp_tokens').select('access_token').eq('company_id', account.company_id).eq('phone_number_id', choice.source_id).maybeSingle();
          if (tokenError) throw tokenError;
          sourceToken = token?.access_token || null;
        }
      }
      if (!sourceAccount?.waba_id || !sourceAccount.phone_number_id || !sourceToken) return json({ success: false, error: 'That number is no longer connected. Refresh and try again.' }, 409);
      // Credentials remain server-side; reuse the same Meta-validated save path.
      raw = { action: 'manual_connect', audience: choice.audience, waba_id: sourceAccount.waba_id, phone_number_id: sourceAccount.phone_number_id, access_token: sourceToken };
    }

    const parsed = Body.safeParse(raw);

    if (!parsed.success) {
      return json(
        {
          success: false,
          error: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const b = parsed.data;

    // ============================================================
    // DISCONNECT
    // ============================================================

    if (b.action === 'disconnect') {
      await admin
        .from('whatsapp_audience_tokens')
        .delete()
        .eq('audience', b.audience);

      await admin
        .from('whatsapp_audience_accounts')
        .update({
          status: 'disconnected',
          waba_id: null,
          phone_number_id: null,
          display_phone: null,
          verified_name: null,
          business_name: null,
          quality_rating: null,
          updated_at: new Date().toISOString(),
        })
        .eq('audience', b.audience);

      return json({
        success: true,
      });
    }

    // ============================================================
    // REFRESH
    // ============================================================

    if (b.action === 'refresh') {
      const { data: acc } = await admin
        .from('whatsapp_audience_accounts')
        .select('*')
        .eq('audience', b.audience)
        .maybeSingle();

      const { data: tok } = await admin
        .from('whatsapp_audience_tokens')
        .select('access_token')
        .eq('audience', b.audience)
        .maybeSingle();

      if (
        !acc?.phone_number_id ||
        !tok?.access_token
      ) {
        return json({
          success: false,
          error: 'Not connected',
        });
      }

      const p = await getPhone(
        acc.phone_number_id,
        tok.access_token,
      );

      await admin
        .from('whatsapp_audience_accounts')
        .update({
          display_phone:
            p.display_phone_number ?? null,
          verified_name:
            p.verified_name ?? null,
          quality_rating:
            p.quality_rating ?? null,
          updated_at:
            new Date().toISOString(),
        })
        .eq('audience', b.audience);

      return json({
        success: true,
        profile: p,
      });
    }

    // ============================================================
    // MANUAL CONNECT
    // ============================================================

    if (b.action === 'manual_connect') {
      // Validate WABA itself.
      const waba = await g(
        `/${b.waba_id}`,
        b.access_token,
        {
          query: {
            fields: 'id,name',
          },
        },
      );

      if (String(waba?.id) !== String(b.waba_id)) {
        return json(
          {
            success: false,
            error:
              'Invalid WhatsApp Business Account ID.',
          },
          400,
        );
      }

      // Validate phone + WABA relationship.
      const phone =
        await verifyPhoneBelongsToWaba(
          b.waba_id,
          b.phone_number_id,
          b.access_token,
        );

      const warnings: string[] = [];

      // Subscribe app to WABA webhooks.
      try {
        await g(
          `/${b.waba_id}/subscribed_apps`,
          b.access_token,
          {
            method: 'POST',
          },
        );
      } catch (e: any) {
        warnings.push(
          `Webhook subscribe: ${e.message}`,
        );
      }

      const now =
        new Date().toISOString();

      const {
        error: accErr,
      } = await admin
        .from('whatsapp_audience_accounts')
        .upsert(
          {
            audience: b.audience,
            waba_id: b.waba_id,
            phone_number_id:
              b.phone_number_id,

            display_phone:
              phone.display_phone_number ??
              null,

            verified_name:
              phone.verified_name ??
              null,

            quality_rating:
              phone.quality_rating ??
              null,

            business_name:
              waba?.name ?? null,

            status: 'connected',
            connected_via: 'manual',
            connected_at: now,
            updated_at: now,
          },
          {
            onConflict: 'audience',
          },
        );

      if (accErr) return json({ success: false, error: accountSaveError(accErr) }, 400);

      const {
        error: tokErr,
      } = await admin
        .from('whatsapp_audience_tokens')
        .upsert(
          {
            audience: b.audience,
            access_token:
              b.access_token,
            token_type: 'MANUAL',
            expires_at: null,
            updated_at: now,
          },
          {
            onConflict: 'audience',
          },
        );

      if (tokErr) throw tokErr;

      return json({
        success: true,
        display_phone:
          phone.display_phone_number ??
          null,
        warnings,
      });
    }

    // ============================================================
    // EMBEDDED SIGNUP CONNECT
    // ============================================================

    const { appId, secret } =
      await getMetaAppCreds(admin);

    if (!secret) {
      return json(
        {
          success: false,
          error_type: 'config',
          error:
            'META_APP_SECRET is not configured',
        },
        500,
      );
    }

    // ------------------------------------------------------------
    // 1. Exchange Embedded Signup code for access token
    // ------------------------------------------------------------

    const tokenUrl = new URL(
      `${GRAPH}/oauth/access_token`,
    );

    tokenUrl.searchParams.set(
      'client_id',
      appId,
    );

    tokenUrl.searchParams.set(
      'client_secret',
      secret,
    );

    tokenUrl.searchParams.set(
      'code',
      b.code,
    );

    const tRes =
      await fetch(tokenUrl);

    const tData =
      await tRes.json().catch(
        () => ({}),
      );

    if (
      !tRes.ok ||
      !tData.access_token
    ) {
      return json(
        {
          success: false,
          error:
            tData?.error?.message ||
            'Code exchange failed',
          details: tData,
        },
        400,
      );
    }

    const token =
      tData.access_token as string;

    // ------------------------------------------------------------
    // 2. Validate exchanged token
    // ------------------------------------------------------------

    const appToken =
      `${appId}|${secret}`;

    const debug = await g(
      '/debug_token',
      appToken,
      {
        query: {
          input_token: token,
        },
      },
    );

    const tokenInfo =
      debug?.data;

    if (
      !tokenInfo?.is_valid ||
      String(tokenInfo.app_id) !==
        String(appId)
    ) {
      return json(
        {
          success: false,
          error:
            'Meta returned an invalid token for this app',
        },
        400,
      );
    }

    // ------------------------------------------------------------
    // 3. Validate WABA
    // ------------------------------------------------------------

    const waba = await g(
      `/${b.waba_id}`,
      token,
      {
        query: {
          fields: 'id,name',
        },
      },
    );

    if (
      String(waba?.id) !==
      String(b.waba_id)
    ) {
      return json(
        {
          success: false,
          error:
            'The selected WABA ID could not be verified with the exchanged Meta token.',
        },
        400,
      );
    }

    // ------------------------------------------------------------
    // 4. Validate phone number
    //
    // IMPORTANT:
    // Do NOT request:
    // whatsapp_business_account
    //
    // The old code did:
    //
    // fields:
    // id,display_phone_number,verified_name,
    // quality_rating,whatsapp_business_account
    //
    // That caused Meta error #100.
    // ------------------------------------------------------------

    const phone =
      await verifyPhoneBelongsToWaba(
        b.waba_id,
        b.phone_number_id,
        token,
      );

    // ------------------------------------------------------------
    // 5. Subscribe app to WABA
    // ------------------------------------------------------------

    const warnings: string[] = [];

    try {
      await g(
        `/${b.waba_id}/subscribed_apps`,
        token,
        {
          method: 'POST',
        },
      );
    } catch (e: any) {
      warnings.push(
        `Webhook subscribe: ${e.message}`,
      );
    }

    // ------------------------------------------------------------
    // IMPORTANT:
    //
    // Meta registers the number itself during
    // Embedded Signup.
    //
    // NEVER call:
    //
    // /{PHONE_NUMBER_ID}/register
    //
    // here with an app-generated PIN.
    // ------------------------------------------------------------

    const profile = phone;

    const businessName:
      string | null =
      waba?.name ?? null;

    const now =
      new Date().toISOString();

    // ------------------------------------------------------------
    // 6. Save WhatsApp account
    // ------------------------------------------------------------

    const {
      error: accErr,
    } = await admin
      .from('whatsapp_audience_accounts')
      .upsert(
        {
          audience: b.audience,

          waba_id:
            b.waba_id,

          phone_number_id:
            b.phone_number_id,

          display_phone:
            profile.display_phone_number ??
            null,

          verified_name:
            profile.verified_name ??
            null,

          quality_rating:
            profile.quality_rating ??
            null,

          business_name:
            businessName,

          status: 'connected',

          connected_via:
            'embedded_signup',

          connected_at:
            now,

          updated_at:
            now,
        },
        {
          onConflict:
            'audience',
        },
      );

    if (accErr) return json({ success: false, error: accountSaveError(accErr) }, 400);

    // ------------------------------------------------------------
    // 7. Save access token
    // ------------------------------------------------------------

    const {
      error: tokErr,
    } = await admin
      .from('whatsapp_audience_tokens')
      .upsert(
        {
          audience:
            b.audience,

          access_token:
            token,

          token_type:
            tokenInfo.type ??
            tData.token_type ??
            'BUSINESS',

          expires_at:
            tokenInfo.expires_at &&
            Number(
              tokenInfo.expires_at,
            ) > 0
              ? new Date(
                  Number(
                    tokenInfo.expires_at,
                  ) * 1000,
                ).toISOString()
              : null,

          updated_at:
            now,
        },
        {
          onConflict:
            'audience',
        },
      );

    if (tokErr) throw tokErr;

    // ------------------------------------------------------------
    // 8. Success
    // ------------------------------------------------------------

    return json({
      success: true,

      display_phone:
        profile.display_phone_number ??
        null,

      warnings,
    });
  } catch (e: any) {
    console.error(
      'workly-india error',
      e?.message,
      e?.details,
    );

    return json(
      {
        success: false,
        error:
          e?.message ||
          'WhatsApp connection failed',

        details:
          e?.details ??
          null,
      },
      500,
    );
  }
});
