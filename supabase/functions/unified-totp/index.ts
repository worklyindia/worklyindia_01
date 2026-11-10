import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Base32 encoding for TOTP secret
function encodeBase32(data: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of data) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += alphabet[parseInt(chunk, 2)];
  }
  return result;
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

// Generate a random secret for TOTP
function generateSecret(): string {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return encodeBase32(array);
}

// Generate TOTP URI for QR code
function generateTotpUri(secret: string, email: string, issuer: string = 'Workly India'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// TOTP verification using HMAC-SHA1
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

async function generateTOTP(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false);
  
  const keyData = new ArrayBuffer(secretBytes.length);
  const keyView = new Uint8Array(keyData);
  keyView.set(secretBytes);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
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

// Generate recovery codes
function generateRecoveryCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

// Hash recovery code for storage
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.replace(/-/g, '').toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId, userType, email, token, recoveryCode } = body;

    console.log(`[unified-totp] Action: ${action}, UserType: ${userType}, UserId: ${userId}`);

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';

    // ACTION: get-or-generate-secret (NEW - checks existing first)
    if (action === 'get-or-generate-secret') {
      if (!userId || !userType || !email) {
        return new Response(
          JSON.stringify({ error: 'userId, userType, and email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already has TOTP enabled
      const { data: existingSettings } = await supabaseAdmin
        .from(tableName)
        .select('totp_enabled, totp_secret')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSettings?.totp_enabled && existingSettings?.totp_secret) {
        return new Response(
          JSON.stringify({ error: 'TOTP already enabled for this account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing pending verification (not expired)
      const { data: existingVerification } = await supabaseAdmin
        .from('totp_verification')
        .select('*')
        .eq('user_id', userId)
        .eq('user_type', userType)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingVerification) {
        // Return existing secret
        const totpUri = generateTotpUri(existingVerification.secret, email);
        console.log(`[unified-totp] Returning existing secret for ${userType}: ${userId}`);
        return new Response(
          JSON.stringify({ 
            secret: existingVerification.secret, 
            totpUri, 
            expiresIn: Math.floor((new Date(existingVerification.expires_at).getTime() - Date.now()) / 1000),
            isExisting: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate new secret
      const secret = generateSecret();
      const totpUri = generateTotpUri(secret, email);

      // Delete any expired verification
      await supabaseAdmin
        .from('totp_verification')
        .delete()
        .eq('user_id', userId)
        .eq('user_type', userType);

      // Store temporary verification record (valid for 30 minutes)
      const { error: insertError } = await supabaseAdmin
        .from('totp_verification')
        .insert({
          user_id: userId,
          user_type: userType,
          secret: secret,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });

      if (insertError) {
        console.error('[unified-totp] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store verification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[unified-totp] New secret generated for ${userType}: ${userId}`);

      return new Response(
        JSON.stringify({ secret, totpUri, expiresIn: 1800, isExisting: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: generate-secret (legacy - redirect to get-or-generate)
    if (action === 'generate-secret') {
      if (!userId || !userType || !email) {
        return new Response(
          JSON.stringify({ error: 'userId, userType, and email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const secret = generateSecret();
      const totpUri = generateTotpUri(secret, email);

      // Delete any existing pending verification
      await supabaseAdmin
        .from('totp_verification')
        .delete()
        .eq('user_id', userId)
        .eq('user_type', userType);

      // Store temporary verification record
      const { error: insertError } = await supabaseAdmin
        .from('totp_verification')
        .insert({
          user_id: userId,
          user_type: userType,
          secret: secret,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });

      if (insertError) {
        console.error('[unified-totp] Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store verification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[unified-totp] Secret generated for ${userType}: ${userId}`);

      return new Response(
        JSON.stringify({ secret, totpUri, expiresIn: 1800 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: verify-setup
    if (action === 'verify-setup') {
      if (!userId || !userType || !token) {
        return new Response(
          JSON.stringify({ error: 'userId, userType, and token are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get pending verification
      const { data: verification, error: verifyError } = await supabaseAdmin
        .from('totp_verification')
        .select('*')
        .eq('user_id', userId)
        .eq('user_type', userType)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (verifyError || !verification) {
        return new Response(
          JSON.stringify({ error: 'No pending verification found or expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyTOTP(verification.secret, token);

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid verification code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate recovery codes
      const recoveryCodes = generateRecoveryCodes(8);
      const hashedCodes = await Promise.all(recoveryCodes.map(async (code) => ({
        hash: await hashCode(code),
        used: false
      })));

      // Check if Telegram 2FA is already active to preserve it
      const { data: currentSettings } = await supabaseAdmin
        .from(tableName)
        .select('two_factor_method, two_factor_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const isTelegramActive = currentSettings?.two_factor_method === 'telegram';

      // Update user settings - preserve Telegram as primary method if already set
      const { error: updateError } = await supabaseAdmin
        .from(tableName)
        .update({
          totp_secret: verification.secret,
          totp_enabled: true,
          totp_verified_at: new Date().toISOString(),
          // Keep primary method as telegram if it was already set
          two_factor_method: isTelegramActive ? 'telegram' : 'google_authenticator',
          two_factor_enabled: true,
          recovery_codes: hashedCodes
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[unified-totp] Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to enable 2FA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete the verification record
      await supabaseAdmin
        .from('totp_verification')
        .delete()
        .eq('id', verification.id);

      console.log(`[unified-totp] Setup verified for ${userType}: ${userId}`);

      return new Response(
        JSON.stringify({ success: true, recoveryCodes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: verify-login
    if (action === 'verify-login') {
      if (!userId || !userType || !token) {
        return new Response(
          JSON.stringify({ error: 'userId, userType, and token are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from(tableName)
        .select('totp_secret, totp_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError || !settings) {
        return new Response(
          JSON.stringify({ error: 'User settings not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!settings.totp_enabled || !settings.totp_secret) {
        return new Response(
          JSON.stringify({ error: 'TOTP is not enabled for this user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = await verifyTOTP(settings.totp_secret, token);

      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid verification code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[unified-totp] Login verified for ${userType}: ${userId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: verify-recovery
    if (action === 'verify-recovery') {
      if (!userId || !userType || !recoveryCode) {
        return new Response(
          JSON.stringify({ error: 'userId, userType, and recoveryCode are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from(tableName)
        .select('recovery_codes')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError || !settings) {
        return new Response(
          JSON.stringify({ error: 'User settings not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recoveryCodes = settings.recovery_codes as Array<{ hash: string; used: boolean }> || [];
      
      if (recoveryCodes.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No recovery codes available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hashedInput = await hashCode(recoveryCode);
      
      let matchedIndex = -1;
      for (let i = 0; i < recoveryCodes.length; i++) {
        if (recoveryCodes[i].hash === hashedInput && !recoveryCodes[i].used) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or already used recovery code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark the code as used
      recoveryCodes[matchedIndex].used = true;
      
      const { error: updateError } = await supabaseAdmin
        .from(tableName)
        .update({ recovery_codes: recoveryCodes })
        .eq('user_id', userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update recovery codes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const remainingCodes = recoveryCodes.filter(c => !c.used).length;

      console.log(`[unified-totp] Recovery verified for ${userType}: ${userId}, remaining: ${remainingCodes}`);

      return new Response(
        JSON.stringify({ success: true, remainingCodes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: generate-recovery-codes
    if (action === 'generate-recovery-codes') {
      if (!userId || !userType) {
        return new Response(
          JSON.stringify({ error: 'userId and userType are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from(tableName)
        .select('two_factor_enabled, totp_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError || !settings) {
        return new Response(
          JSON.stringify({ error: 'User settings not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!settings.two_factor_enabled && !settings.totp_enabled) {
        return new Response(
          JSON.stringify({ error: '2FA must be enabled to generate recovery codes' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recoveryCodes = generateRecoveryCodes(8);
      const hashedCodes = await Promise.all(recoveryCodes.map(async (code) => ({
        hash: await hashCode(code),
        used: false
      })));

      const { error: updateError } = await supabaseAdmin
        .from(tableName)
        .update({ recovery_codes: hashedCodes })
        .eq('user_id', userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to save recovery codes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[unified-totp] Recovery codes generated for ${userType}: ${userId}`);

      return new Response(
        JSON.stringify({ success: true, recoveryCodes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[unified-totp] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
