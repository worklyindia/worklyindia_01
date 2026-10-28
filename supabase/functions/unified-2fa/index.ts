import { istStampParts } from "../_shared/emailFormat.ts";
import { getTurnstileConfig, verifyTurnstileToken } from "../_shared/turnstile.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CANONICAL_DOMAIN, WEBSITE_DOMAIN } from '../_shared/domain.ts';
// All push sending goes through the single email-api hub.
import { sendPushToDevices } from '../_shared/pushBridge.ts';
import { escapeHtmlAttribute, renderEmailTemplateHtml } from '../_shared/templateHtml.ts';
import { AUTH_OTP_EXPIRY_SECONDS, authOtpExpiresAt, renderAuthEmail } from '../_shared/authEmailTemplates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OTP_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = AUTH_OTP_EXPIRY_SECONDS / 60;
const PUSH_OTP_EXPIRY_MINUTES = 2;

type OtpChannel = 'email' | 'telegram' | 'push';

const OTP_TEMPLATE_TABLES: Record<OtpChannel, string> = {
  email: 'email_lifecycle_templates',
  telegram: 'telegram_lifecycle_templates',
  push: 'push_lifecycle_templates',
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const fillOtpTemplate = (
  text: string | null | undefined,
  values: Record<string, string>,
  html = false,
): string => {
  let output = String(text || '');
  for (const [key, rawValue] of Object.entries(values)) {
    const value = html ? escapeHtml(rawValue) : rawValue;
    output = output.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
  }
  if (!/\{\{\s*[\w.]+\s*\}\}/.test(output)) return output.trim();
  const kept = output
    .split('\n')
    .filter((line) => !/\{\{\s*[\w.]+\s*\}\}/.test(line))
    .join('\n')
    .trim();
  return kept || output.replace(/\{\{\s*[\w.]+\s*\}\}/g, '').replace(/[ \t]{2,}/g, ' ').trim();
};

// Push is no longer a separate 2FA method. Whatever OTP goes out over Telegram or
// Email is mirrored to the user's devices as a push notification with the SAME code.
// Best effort only — a push failure must never block the Telegram/Email OTP.
async function mirrorOtpToPush(
  supabase: any,
  opts: { userId: string; userName: string; userType: string; otp: string; expiryMinutes: number },
) {
  try {
    const { data: tokens } = await supabase
      .from('push_subscriptions')
      .select('player_id:fcm_token')
      .eq('user_id', opts.userId)
      .eq('enabled', true)
      .order('updated_at', { ascending: false });

    const playerIds = (tokens || [])
      .map((row: { player_id?: string | null }) => row.player_id)
      .filter((token: string | null | undefined): token is string => Boolean(token));

    if (playerIds.length === 0) return;

    const twoFaKey = opts.userType === 'employer' ? 'employer_2fa_otp' : 'jobseeker_2fa_otp';
    const template = await loadOtpTemplate(supabase, 'push', twoFaKey);
    const templateValues = { name: opts.userName, otp: opts.otp, expiry_minutes: String(opts.expiryMinutes) };
    const title = fillOtpTemplate(template?.title, templateValues) || '🔐 Login Verification';
    const message = fillOtpTemplate(template?.body, templateValues)
      || `Hi ${opts.userName}!\n\nYour login OTP is: ${opts.otp}\n\nValid for ${opts.expiryMinutes} minutes.`;

    await sendPushToDevices(supabase, {
      player_ids: playerIds,
      title,
      message,
      no_ai: true,
      data: { type: '2fa_verification', otp: opts.otp, user_id: opts.userId },
    });
  } catch (err) {
    console.warn('[OTP] push mirror failed (ignored):', err);
  }
}

async function loadOtpTemplate(supabase: any, channel: OtpChannel, eventType: string) {
  const { data, error } = await supabase
    .from(OTP_TEMPLATE_TABLES[channel])
    .select('*')
    .eq('event_type', eventType)
    .maybeSingle();
  if (error) console.error(`[OTP] ${channel} template lookup failed:`, error.message);
  return data && data.enabled !== false ? data : null;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function generateShortToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRecoveryCodes(count: number = 6): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Array.from({ length: 8 }, () => 
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    codes.push(code);
  }
  return codes;
}

async function hashPattern(userId: string, pattern: string): Promise<string> {
  const salt = 'pattern_lock_v1_' + userId;
  const data = new TextEncoder().encode(salt + pattern);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanEncoded = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of cleanEncoded) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

async function generateTOTP(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false);
  
  const keyData = new ArrayBuffer(secretBytes.length);
  const keyView = new Uint8Array(keyData);
  keyView.set(secretBytes);
  
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  
  const hmac = await crypto.subtle.sign('HMAC', key, counterBuffer);
  const hmacArray = new Uint8Array(hmac);
  
  const offset = hmacArray[hmacArray.length - 1] & 0x0f;
  const code = (
    ((hmacArray[offset] & 0x7f) << 24) |
    ((hmacArray[offset + 1] & 0xff) << 16) |
    ((hmacArray[offset + 2] & 0xff) << 8) |
    (hmacArray[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

async function verifyTOTP(secret: string, token: string, window: number = 1): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  for (let i = -window; i <= window; i++) {
    const counter = Math.floor((now + i * timeStep) / timeStep);
    const expectedToken = await generateTOTP(secret, counter);
    if (expectedToken === token) {
      return true;
    }
  }
  return false;
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let body: any = {};
    
    // Handle both GET (for push approval redirect) and POST
    if (req.method === 'GET') {
      // Parse query params for push approval
      const t = url.searchParams.get('t') || url.searchParams.get('token');
      const u = url.searchParams.get('u') || url.searchParams.get('userId');
      const shortType = url.searchParams.get('y');
      const userType = shortType ? (shortType === 'e' ? 'employer' : 'job_seeker') : url.searchParams.get('userType');
      body = { action: 'verify-push-approval', token: t, userId: u, userType, isRedirect: true };
    } else {
      body = await req.json();
    }

    const { action, ...params } = body;

    console.log(`[unified-2fa] Action: ${action}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    switch (action) {
      case 'send-telegram-otp':
        return await handleSendTelegramOtp(supabase, supabaseUrl, supabaseServiceKey, params);
      
      case 'verify-telegram-otp':
        return await handleVerifyTelegramOtp(supabase, params, supabaseUrl, supabaseServiceKey);
      
      case 'send-push-otp':
        return await handleSendPushOtp(supabase, supabaseUrl, params);
      
      case 'verify-push-approval':
      case 'check-push-approval':
        return await handlePushApproval(supabase, params, url);
      
      case 'check-login':
        return await handleCheckLogin(supabase, params);
      
      case 'send-email-otp':
        return await handleSendEmailOtp(supabase, supabaseUrl, supabaseServiceKey, params);
      
      case 'verify-email-otp':
        return await handleVerifyEmailOtp(supabase, params);
      
      case 'password-reset-verify':
      case 'password-reset-execute':
      case 'send-reset-telegram-otp':
      case 'get-passkey-options':
      case 'send-reset-push-otp':
      case 'send-reset-email-otp':
        return await handlePasswordReset(supabase, supabaseUrl, action, params, req);
      
      case 'pattern-setup':
      case 'pattern-verify':
        return await handlePatternLock(supabase, action, params);
      
      case 'admin-disable':
        return await handleAdminDisable(supabase, params);

      case 'check-auth-phone':
        return await handleCheckAuthPhone(supabase, params, req);

      case 'sync-auth-phone':
        return await handleSyncAuthPhone(supabase, params, req);

      case 'turnstile-config':
        return new Response(JSON.stringify(await getTurnstileConfig()), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'turnstile-verify': {
        const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
        const result = await verifyTurnstileToken(params.token, ip);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }


      
      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[unified-2fa] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =============================================
// ACTION HANDLERS
// =============================================

// Mobile number change now uses the native Supabase Auth phone OTP (SMS) flow:
// the client calls supabase.auth.updateUser({ phone }) and then
// supabase.auth.verifyOtp({ type: 'phone_change' }). These two helpers only
// guard the rules around it (existing number required, no duplicates) and keep
// profiles/companies in sync afterwards.

function jsonResponse(payload: unknown, status = 200) {
  return new Response(
    JSON.stringify(payload),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

async function getAuthUser(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error) return null;
  return data?.user || null;
}

// Pre-check before the SMS OTP is sent.
// RULE: only an account that ALREADY has an auth phone can update it.
async function handleCheckAuthPhone(supabase: any, params: any, req: Request) {
  const authUser = await getAuthUser(supabase, req);
  if (!authUser) return jsonResponse({ error: 'Not authenticated' }, 401);

  const currentPhone = String(authUser.phone || '').replace(/\D/g, '');
  if (!currentPhone) {
    return jsonResponse({
      error: 'no_existing_phone',
      message: 'No mobile number is linked to this account. Adding a new number is not allowed here.',
    }, 400);
  }

  const newPhone = String(params?.newPhone || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(newPhone)) return jsonResponse({ error: 'Invalid mobile number' }, 400);
  const e164Digits = newPhone.length === 10 ? `91${newPhone}` : newPhone;
  if (e164Digits === currentPhone) {
    return jsonResponse({ error: 'This is already your current mobile number' }, 400);
  }

  const { data: clash } = await supabase
    .from('profiles')
    .select('user_id')
    .or(`phone.eq.${e164Digits},phone.eq.+${e164Digits},phone.eq.${e164Digits.slice(-10)}`)
    .neq('user_id', authUser.id)
    .limit(1);
  if (clash && clash.length > 0) {
    return jsonResponse({ error: 'This mobile number is already used by another account' }, 409);
  }

  return jsonResponse({ success: true, phone: `+${e164Digits}` });
}

// Called with the NEW session (after phone_change OTP verification) to mirror
// the auth phone into profiles / companies.
async function handleSyncAuthPhone(supabase: any, params: any, req: Request) {
  const authUser = await getAuthUser(supabase, req);
  if (!authUser) return jsonResponse({ error: 'Not authenticated' }, 401);

  const authDigits = String(authUser.phone || '').replace(/\D/g, '');
  if (!authDigits) return jsonResponse({ error: 'No mobile number on this account' }, 400);

  const expected = String(params?.newPhone || '').replace(/\D/g, '');
  if (expected) {
    const expectedE164 = expected.length === 10 ? `91${expected}` : expected;
    if (expectedE164 !== authDigits) {
      return jsonResponse({ error: 'Mobile number verification is not complete yet' }, 400);
    }
  }

  const phone = `+${authDigits}`;
  await supabase.from('profiles').update({ phone }).eq('user_id', authUser.id);
  if (params?.companyId) {
    await supabase.from('companies').update({ phone }).eq('id', params.companyId);
  }

  return jsonResponse({ success: true, phone });
}



async function handleSendTelegramOtp(supabase: any, supabaseUrl: string, supabaseServiceKey: string, params: any) {
  const { userId, userType, checkOnly } = params;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check cooldown
  const { data: existingOtp } = await supabase
    .from('otp_codes')
    .select('created_at')
    .eq('user_id', userId)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let remainingCooldown = 0;
  if (existingOtp?.created_at) {
    const createdAt = new Date(existingOtp.created_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    remainingCooldown = Math.max(0, OTP_COOLDOWN_SECONDS - elapsedSeconds);
  }

  if (checkOnly) {
    return new Response(
      JSON.stringify({ success: true, remainingCooldown, canResend: remainingCooldown === 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (remainingCooldown > 0) {
    return new Response(
      JSON.stringify({ error: `Please wait ${remainingCooldown} seconds`, remainingCooldown, canResend: false }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get Telegram chat ID
  let telegramChatId: number | null = null;
  let userName: string = 'User';
  
  if (userType === 'employer') {
    const { data: company } = await supabase
      .from('companies')
      .select('telegram_chat_id, company_name')
      .eq('user_id', userId)
      .maybeSingle();
    telegramChatId = company?.telegram_chat_id;
    userName = company?.company_name || 'Employer';
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    telegramChatId = profile?.telegram_chat_id;
    userName = profile?.full_name || 'User';
  }

  if (!telegramChatId) {
    return new Response(
      JSON.stringify({ error: 'Telegram not connected' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(authOtpExpiresAt(Date.now())).toISOString();

  await supabase.from('otp_codes').delete().eq('user_id', userId);
  const { data: otpRow } = await supabase
    .from('otp_codes')
    .insert({ user_id: userId, code: otp, expires_at: expiresAt, verified: false, telegram_chat_id: telegramChatId })
    .select('id')
    .maybeSingle();

  // Send the owner-managed OTP template through Telegram.
  const twoFaKey = userType === 'employer' ? 'employer_2fa_otp' : 'jobseeker_2fa_otp';
  const template = await loadOtpTemplate(supabase, 'telegram', twoFaKey);
  const templateValues = { name: userName, otp, expiry_minutes: String(OTP_EXPIRY_MINUTES) };
  const templateTitle = fillOtpTemplate(template?.title, templateValues, true) || 'Your Workly India Login Code';
  const templateBody = fillOtpTemplate(template?.body, templateValues, true)
    || `Hi ${escapeHtml(userName)},\n\nYour login OTP is: ${otp}\nValid for: ${OTP_EXPIRY_MINUTES} minutes\n\nIf you did not request this code, please ignore this message.`;
  
  const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/email-api/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({
      action: 'send',
      // OTP usi side ke bot se jaata hai jis side se login ho raha hai.
      audience: userType === 'employer' ? 'employer' : 'job_seeker',
      chat_id: telegramChatId,
      text: `<b>${templateTitle}</b>\n\n${templateBody}`,
      parse_mode: 'HTML',
      button_text: 'Copy code',
      copy_text: otp,
    })
  });

  const triggerResult = await triggerResponse.json();
  const success = triggerResult?.success || (triggerResult?.sent > 0);

  if (!success && triggerResult?.failed > 0) {
    return new Response(
      JSON.stringify({ error: triggerResult?.results?.[0]?.error || 'Failed to send OTP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Remember the Telegram message so it can be removed from the chat after verification.
  const sentMessageId = triggerResult?.message_id ?? triggerResult?.results?.[0]?.message_id ?? null;
  if (otpRow?.id && sentMessageId) {
    await supabase.from('otp_codes').update({ telegram_message_id: sentMessageId }).eq('id', otpRow.id);
  }

  // Same code also goes to the user's devices as a push notification.
  await mirrorOtpToPush(supabase, { userId, userName, userType, otp, expiryMinutes: OTP_EXPIRY_MINUTES });

  return new Response(
    JSON.stringify({ success: true, message: 'OTP sent successfully', remainingCooldown: OTP_COOLDOWN_SECONDS, canResend: false }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleVerifyTelegramOtp(supabase: any, params: any, supabaseUrl?: string, supabaseServiceKey?: string) {
  const { userId, code, userType } = params;

  if (!userId || !code) {
    return new Response(
      JSON.stringify({ error: 'User ID and code are required', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: otpRecord } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('user_id', userId)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRecord) {
    return new Response(
      JSON.stringify({ error: 'No OTP found. Please request a new one.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (new Date(otpRecord.expires_at) < new Date()) {
    await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
    return new Response(
      JSON.stringify({ error: 'OTP has expired. Please request a new one.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (otpRecord.code !== code) {
    return new Response(
      JSON.stringify({ error: 'Invalid OTP', verified: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Remove the OTP message from the Telegram chat once the code is verified.
  if (otpRecord.telegram_chat_id && otpRecord.telegram_message_id && supabaseUrl && supabaseServiceKey) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/email-api/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          action: 'delete_message',
          chat_id: otpRecord.telegram_chat_id,
          message_id: otpRecord.telegram_message_id,
        }),
      });
    } catch (err) {
      console.error('Failed to delete Telegram OTP message:', err);
    }
  }

  await supabase.from('otp_codes').delete().eq('id', otpRecord.id);

  return new Response(
    JSON.stringify({ verified: true, message: 'OTP verified successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSendPushOtp(supabase: any, supabaseUrl: string, params: any) {
  const { userId, userType, checkOnly } = params;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }


  // Check cooldown
  const { data: existingOtp } = await supabase
    .from('otp_codes')
    .select('created_at')
    .eq('user_id', userId)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let remainingCooldown = 0;
  if (existingOtp?.created_at) {
    const createdAt = new Date(existingOtp.created_at);
    const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    remainingCooldown = Math.max(0, OTP_COOLDOWN_SECONDS - elapsedSeconds);
  }

  if (checkOnly) {
    return new Response(
      JSON.stringify({ success: true, remainingCooldown, canResend: remainingCooldown === 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (remainingCooldown > 0) {
    return new Response(
      JSON.stringify({ error: `Please wait ${remainingCooldown} seconds`, remainingCooldown, canResend: false }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get player ID
  const { data: tokens } = await supabase
    .from('push_subscriptions')
    .select('player_id:fcm_token')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('updated_at', { ascending: false });

  if (!tokens || tokens.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Push notifications not enabled' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const playerIds = tokens
    .map((row: { player_id?: string | null }) => row.player_id)
    .filter((token: string | null | undefined): token is string => Boolean(token));

  if (playerIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Push notifications not enabled' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get user name
  let userName = 'User';
  if (userType === 'employer') {
    const { data: company } = await supabase.from('companies').select('company_name').eq('user_id', userId).maybeSingle();
    userName = company?.company_name || 'Employer';
  } else {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
    userName = profile?.full_name || 'User';
  }


  // Generate OTP and approval token
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const approvalToken = generateShortToken();
  const expiresAt = new Date(Date.now() + PUSH_OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  await supabase.from('otp_codes').delete().eq('user_id', userId);
  await supabase.from('otp_codes').insert({ user_id: userId, code: otp, expires_at: expiresAt, verified: false });

  // Store approval token
  const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
  await supabase.from(tableName).update({
    push_otp_approval_token: approvalToken,
    push_otp_approval_expires_at: expiresAt
  }).eq('user_id', userId);

  // Create approval URL
  const shortUserType = userType === 'employer' ? 'e' : 'j';
  const approvalUrl = `${supabaseUrl}/functions/v1/unified-2fa?action=verify-push-approval&t=${approvalToken}&u=${userId}&y=${shortUserType}`;
  const twoFaKey = userType === 'employer' ? 'employer_2fa_otp' : 'jobseeker_2fa_otp';
  const template = await loadOtpTemplate(supabase, 'push', twoFaKey);
  const templateValues = { name: userName, otp, expiry_minutes: String(PUSH_OTP_EXPIRY_MINUTES) };
  const pushTitle = fillOtpTemplate(template?.title, templateValues) || '🔐 Login Verification';
  const pushMessage = fillOtpTemplate(template?.body, templateValues)
    || `Hi ${userName}!\n\nYour login OTP is: ${otp}\n\nValid for ${PUSH_OTP_EXPIRY_MINUTES} minutes.`;
  const pushButtonText = String(template?.button_text || '✅ Approve Login').trim() || '✅ Approve Login';

  // Send push notification through the single push hub (email-api)
  const pushResult = await sendPushToDevices(supabase, {
    player_ids: playerIds,
    title: pushTitle,
    message: pushMessage,
    url: approvalUrl,
    no_ai: true,
    buttons: [{ id: 'approve-login', text: pushButtonText, url: approvalUrl }],
    data: { type: '2fa_verification', otp, approval_token: approvalToken, user_id: userId, user_type: userType, approval_url: approvalUrl },
  });

  if (!pushResult.sent) {
    const needsFreshToken = /UNREGISTERED|NotRegistered|registration-token-not-registered/i.test(String(pushResult.error || ''));
    return new Response(
      JSON.stringify({
        error: needsFreshToken
          ? 'This device notification registration has expired. Sign in on the device and enable Push Notifications again.'
          : 'Failed to send push notification',
        code: needsFreshToken ? 'PUSH_TOKEN_EXPIRED' : 'PUSH_SEND_FAILED',
        details: pushResult.error,
      }),
      { status: needsFreshToken ? 410 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Push OTP sent successfully', remainingCooldown: OTP_COOLDOWN_SECONDS, canResend: false }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePushApproval(supabase: any, params: any, reqUrl: URL) {
  const { token, userId, userType, isRedirect, subAction, code } = params;
  const action = params.subAction || (token ? 'approve' : 'check');

  if (!userId || !userType) {
    return new Response(
      JSON.stringify({ error: 'userId and userType are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
  const STATIC_PAGE_BASE = WEBSITE_DOMAIN;

  // Handle approval action
  if (action === 'approve' && token) {
    const { data: settings } = await supabase
      .from(tableName)
      .select('push_otp_approval_token, push_otp_approval_expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!settings?.push_otp_approval_token) {
      if (isRedirect) return Response.redirect(`${STATIC_PAGE_BASE}/2fa-approval.html?status=error`, 302);
      return new Response(JSON.stringify({ error: 'No active approval token', verified: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isExpired = new Date(settings.push_otp_approval_expires_at) < new Date();
    const tokenMatches = settings.push_otp_approval_token === token;

    if (!tokenMatches || isExpired) {
      if (isRedirect) return Response.redirect(`${STATIC_PAGE_BASE}/2fa-approval.html?status=${isExpired ? 'expired' : 'invalid'}`, 302);
      return new Response(JSON.stringify({ error: isExpired ? 'Token expired' : 'Invalid token', verified: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('otp_codes').update({ verified: true }).eq('user_id', userId).eq('verified', false);
    await supabase.from(tableName).update({ push_otp_approval_token: 'APPROVED', push_otp_approval_expires_at: new Date().toISOString() }).eq('user_id', userId);

    if (isRedirect) {
      const typeParam = userType === 'employer' ? 'employer' : 'job_seeker';
      return Response.redirect(`${STATIC_PAGE_BASE}/2fa-approval.html?status=success&type=${typeParam}`, 302);
    }

    return new Response(JSON.stringify({ verified: true, message: 'Login approved successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Handle check action
  if (action === 'check') {
    const { data: settings } = await supabase.from(tableName).select('push_otp_approval_token').eq('user_id', userId).maybeSingle();
    const isApproved = settings?.push_otp_approval_token === 'APPROVED';

    if (isApproved) {
      await supabase.from(tableName).update({ push_otp_approval_token: null, push_otp_approval_expires_at: null }).eq('user_id', userId);
    }

    return new Response(JSON.stringify({ approved: isApproved }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Handle verify action (manual OTP entry)
  if (action === 'verify' && code) {
    const { data: otpData } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('verified', false)
      .maybeSingle();

    if (!otpData) {
      return new Response(JSON.stringify({ verified: false, error: 'Invalid or expired OTP' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (new Date(otpData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ verified: false, error: 'OTP has expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('otp_codes').update({ verified: true }).eq('id', otpData.id);
    await supabase.from(tableName).update({ push_otp_approval_token: null, push_otp_approval_expires_at: null }).eq('user_id', userId);

    return new Response(JSON.stringify({ verified: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCheckLogin(supabase: any, params: any) {
  const { email, userType } = params;

  if (!email || !userType) {
    return new Response(
      JSON.stringify({ error: 'Email and userType are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const cleanEmail = email.toLowerCase().trim();
  const isEmployer = userType === 'employer';
  const tableName = isEmployer ? 'companies' : 'profiles';
  const settingsTable = isEmployer ? 'employer_settings' : 'user_settings';

  const { data: userData } = await supabase
    .from(tableName)
    .select('user_id, telegram_chat_id')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (!userData) {
    return new Response(
      JSON.stringify({ required: false, userId: null, telegramConnected: false, userType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: settings } = await supabase
    .from(settingsTable)
    .select('two_factor_enabled, two_factor_method, totp_enabled, passkey_enabled, push_otp_enabled, telegram_2fa_enabled, email_otp_enabled')
    .eq('user_id', userData.user_id)
    .maybeSingle();

  const telegramConnected = settings?.telegram_2fa_enabled ?? false;
  const totpEnabled = settings?.totp_enabled ?? false;
  const passkeyEnabled = settings?.passkey_enabled ?? false;
  const pushOtpEnabled = settings?.push_otp_enabled ?? false;
  const emailOtpEnabled = settings?.email_otp_enabled ?? false;
  
  // Push is NOT a standalone 2FA method — the code is simply mirrored to push.
  // Passkeys are device-bound and never act as a login 2FA step either.
  const hasAnyMethodEnabled = totpEnabled || telegramConnected || emailOtpEnabled;
  const required = hasAnyMethodEnabled;

  let twoFactorMethod = settings?.two_factor_method;
  if (!twoFactorMethod || twoFactorMethod === 'push_otp' || twoFactorMethod === 'passkey') {
    if (totpEnabled) twoFactorMethod = 'google_authenticator';
    else if (telegramConnected) twoFactorMethod = 'telegram';
    else if (emailOtpEnabled) twoFactorMethod = 'email_otp';
    else twoFactorMethod = null;
  }

  return new Response(
    JSON.stringify({ required, userId: userData.user_id, telegramConnected, twoFactorMethod, totpEnabled, passkeyEnabled: false, pushOtpEnabled: false, emailOtpEnabled, userType }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePasswordReset(supabase: any, supabaseUrl: string, action: string, params: any, req: Request) {
  const { userId, userType, method, code, token, newPassword, credential } = params;
  const settingsTable = userType === 'employer' ? 'employer_settings' : 'user_settings';
  const requestOrigin = params.origin || req.headers.get('origin') || req.headers.get('referer') || '';

  // Send Telegram OTP for password reset
  if (action === 'send-reset-telegram-otp') {
    const { data, error } = await supabase.functions.invoke('unified-2fa', { body: { action: 'send-telegram-otp', userId, userType } });
    if (error) return new Response(JSON.stringify({ error: 'Failed to send OTP' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Get passkey options
  if (action === 'get-passkey-options') {
    const { data, error } = await supabase.functions.invoke('passkey-auth', { body: { action: 'generate-authentication-options', userId, userType, origin: requestOrigin } });
    if (error) return new Response(JSON.stringify({ error: 'Failed to get passkey options' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ options: data, challengeId: userId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Send push OTP for password reset
  if (action === 'send-reset-push-otp') {
    const { data, error } = await supabase.functions.invoke('unified-2fa', { body: { action: 'send-push-otp', userId, userType, purpose: 'password_reset' } });
    if (error) return new Response(JSON.stringify({ error: 'Failed to send push notification' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Verify 2FA and generate reset token
  if (action === 'password-reset-verify') {
    if (!userId || !userType || !method) {
      return new Response(JSON.stringify({ error: 'userId, userType, and method are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let verified = false;

    if (method === 'google_authenticator' || method === 'totp') {
      if (!code) return new Response(JSON.stringify({ error: 'Code is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: settings } = await supabase.from(settingsTable).select('totp_secret, totp_enabled').eq('user_id', userId).maybeSingle();
      if (!settings?.totp_enabled || !settings?.totp_secret) return new Response(JSON.stringify({ error: 'TOTP not enabled' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      verified = await verifyTOTP(settings.totp_secret, code);
    } else if (method === 'telegram') {
      if (!code) return new Response(JSON.stringify({ error: 'Code is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: verifyResult } = await supabase.functions.invoke('unified-2fa', { body: { action: 'verify-telegram-otp', userId, code, userType } });
      verified = verifyResult?.verified === true;
    } else if (method === 'passkey') {
      if (!credential) return new Response(JSON.stringify({ error: 'Credential is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: verifyResult } = await supabase.functions.invoke('passkey-auth', { body: { action: 'verify-authentication', userId, userType, credential, origin: requestOrigin } });
      verified = verifyResult?.verified === true;
    } else if (method === 'push_otp') {
      const { data: recentApproval } = await supabase.from('push_2fa_challenges').select('*').eq('user_id', userId).eq('status', 'approved').gte('approved_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()).order('approved_at', { ascending: false }).limit(1).maybeSingle();
      verified = !!recentApproval;
      if (verified) await supabase.from('push_2fa_challenges').update({ status: 'used' }).eq('id', recentApproval.id);
    }

    if (!verified) {
      return new Response(JSON.stringify({ error: 'Verification failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resetToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await supabase.from('password_reset_tokens').insert({ user_id: userId, token: resetToken, user_type: userType, expires_at: expiresAt.toISOString() });

    return new Response(JSON.stringify({ success: true, token: resetToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Execute password reset
  if (action === 'password-reset-execute') {
    if (!token || !newPassword) return new Response(JSON.stringify({ error: 'Token and newPassword are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (newPassword.length < 6) return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: tokenData } = await supabase.from('password_reset_tokens').select('*').eq('token', token).eq('used', false).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!tokenData) return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { error: updateError } = await supabase.auth.admin.updateUserById(tokenData.user_id, { password: newPassword });
    if (updateError) return new Response(JSON.stringify({ error: 'Failed to update password' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await supabase.auth.admin.signOut(tokenData.user_id, 'global');
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', tokenData.id);

    return new Response(JSON.stringify({ success: true, userType: tokenData.user_type, message: 'Password updated successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handlePatternLock(supabase: any, action: string, params: any) {
  const { userId, userType, patternSequence } = params;

  if (!userId || !userType || !patternSequence) {
    return new Response(
      JSON.stringify({ success: false, error: 'userId, userType, and patternSequence are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const dots = patternSequence.split(',').map(Number);
  if (dots.length < 4 || dots.some((d: number) => d < 0 || d > 8 || isNaN(d))) {
    return new Response(
      JSON.stringify({ success: false, error: 'Pattern must have at least 4 valid dots (0-8)' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';

  if (action === 'pattern-setup') {
    const uniqueDots = new Set(dots);
    if (uniqueDots.size !== dots.length) {
      return new Response(JSON.stringify({ success: false, error: 'Each dot can only be used once' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const patternHash = await hashPattern(userId, patternSequence);
    const recoveryCodes = generateRecoveryCodes(6);

    await supabase.from(tableName).upsert({
      user_id: userId,
      pattern_lock_enabled: true,
      pattern_lock_hash: patternHash,
      pattern_lock_verified_at: new Date().toISOString(),
      two_factor_enabled: true,
      two_factor_method: 'pattern_lock',
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ success: true, recoveryCodes, message: 'Pattern lock enabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (action === 'pattern-verify') {
    const { data: settings } = await supabase.from(tableName).select('pattern_lock_enabled, pattern_lock_hash').eq('user_id', userId).maybeSingle();

    if (!settings?.pattern_lock_enabled || !settings?.pattern_lock_hash) {
      return new Response(JSON.stringify({ success: false, verified: false, error: 'Pattern lock not enabled' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const inputHash = await hashPattern(userId, patternSequence);
    const verified = inputHash === settings.pattern_lock_hash;

    if (verified) {
      await supabase.from(tableName).update({ pattern_lock_verified_at: new Date().toISOString() }).eq('user_id', userId);
    }

    return new Response(JSON.stringify({ success: true, verified }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleAdminDisable(supabase: any, params: any) {
  const { userId, disableAction } = params;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (disableAction === 'disable_passkey') {
    const { data, error } = await supabase
      .from('user_settings')
      .update({ passkey_enabled: false, two_factor_enabled: false, two_factor_method: null })
      .eq('user_id', userId)
      .select();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ success: true, message: 'Passkey disabled successfully', data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// =============================================
// EMAIL OTP HANDLERS
// =============================================

async function handleSendEmailOtp(supabase: any, supabaseUrl: string, supabaseServiceKey: string, params: any) {
  const { userId, userType, checkOnly } = params;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'User ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check cooldown
  const { data: existingOtp } = await supabase
    .from('otp_codes')
    .select('created_at')
    .eq('user_id', userId)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let remainingCooldown = 0;
  if (existingOtp?.created_at) {
    const createdAt = new Date(existingOtp.created_at);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    remainingCooldown = Math.max(0, OTP_COOLDOWN_SECONDS - elapsedSeconds);
  }

  if (checkOnly) {
    return new Response(
      JSON.stringify({ success: true, remainingCooldown, canResend: remainingCooldown === 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (remainingCooldown > 0) {
    return new Response(
      JSON.stringify({ error: `Please wait ${remainingCooldown} seconds`, remainingCooldown, canResend: false }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get user email
  let userEmail: string | null = null;
  let userName: string = 'User';
  
  if (userType === 'employer') {
    const { data: company } = await supabase
      .from('companies')
      .select('email, company_name')
      .eq('user_id', userId)
      .maybeSingle();
    userEmail = company?.email;
    userName = company?.company_name || 'Employer';
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    userEmail = profile?.email;
    userName = profile?.full_name || 'User';
  }

  if (!userEmail) {
    // Try to get email from auth.users table via service role
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    userEmail = authUser?.user?.email;
  }

  if (!userEmail) {
    return new Response(
      JSON.stringify({ error: 'Email not found for this user' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Delete existing OTPs and insert new one
  await supabase.from('otp_codes').delete().eq('user_id', userId);
  await supabase.from('otp_codes').insert({ user_id: userId, code: otp, expires_at: expiresAt, verified: false });

  // Job seekers and employers each have their own Two-Factor Authentication
  // template (Email Templates → Job Seekers / Employers).
  const twoFaKey = userType === 'employer' ? 'employer_2fa_otp' : 'jobseeker_2fa_otp';
  const template = await loadOtpTemplate(supabase, 'email', twoFaKey);
  const requestedAt = new Date();
  const templateValues = {
    name: userName,
    otp,
    expiry_minutes: String(OTP_EXPIRY_MINUTES),
    date: istStampParts(requestedAt).date,
    time: istStampParts(requestedAt).time,
  };
  const emailSubject = fillOtpTemplate(template?.subject, templateValues) || 'Your Login OTP - Workly India';
  // Security emails share the code-only layout; saved button copy cannot override it.
  const otpEmailContent = renderAuthEmail({
    name: userName, saved: template,
    plan: { to: userEmail, templateKey: 'magic_link', otp, link: '', tokenHash: '', newEmail: '', oldEmail: '' },
  }).html;

  // Send email via the unified send-email endpoint function
  const emailResponse = await fetch(`${supabaseUrl}/functions/v1/email-api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({
      to: userEmail,
      toName: userName,
      subject: emailSubject,
      senderName: 'Workly India',
      audience: userType === 'employer' ? 'employer' : 'jobseeker',
      htmlContent: otpEmailContent,
      templateMode: 'complete',
      suppressGreeting: true,
      suppressTitle: true,
      textContent: `Hi ${userName},\n\nYour login verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes and can be used only once. Enter it on the sign-in or security verification screen. Never share this code. If you did not request it, ignore this email.\n\nWorkly India security team`
    })
  });

  const emailResult = await emailResponse.json();

  if (!emailResult?.success) {
    console.error('[Email OTP] Failed to send email:', emailResult);
    return new Response(
      JSON.stringify({ error: emailResult?.error || 'Failed to send OTP email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[Email OTP] OTP sent successfully to:', userEmail);

  // Same code also goes to the user's devices as a push notification.
  await mirrorOtpToPush(supabase, { userId, userName, userType, otp, expiryMinutes: OTP_EXPIRY_MINUTES });

  return new Response(
    JSON.stringify({ success: true, message: 'OTP sent successfully to your email', remainingCooldown: OTP_COOLDOWN_SECONDS, canResend: false }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleVerifyEmailOtp(supabase: any, params: any) {
  const { userId, code, userType } = params;

  if (!userId || !code) {
    return new Response(
      JSON.stringify({ error: 'User ID and code are required', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: otpRecord } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('user_id', userId)
    .eq('verified', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRecord) {
    return new Response(
      JSON.stringify({ error: 'No OTP found. Please request a new one.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (new Date(otpRecord.expires_at) < new Date()) {
    await supabase.from('otp_codes').delete().eq('id', otpRecord.id);
    return new Response(
      JSON.stringify({ error: 'OTP has expired. Please request a new one.', verified: false }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (otpRecord.code !== code) {
    return new Response(
      JSON.stringify({ error: 'Invalid OTP', verified: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await supabase.from('otp_codes').delete().eq('id', otpRecord.id);

  return new Response(
    JSON.stringify({ verified: true, message: 'OTP verified successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
