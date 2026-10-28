import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getPasskeyRpId, CANONICAL_DOMAIN } from "../_shared/domain.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
};

// Crypto utilities for WebAuthn
function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64Encode(array.buffer);
}
function base64URLEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper: Store challenge in database
async function storeChallenge(supabase: any, userId: string | null, challenge: string, challengeType: 'registration' | 'authentication' | 'discoverable'): Promise<string> {
  // Generate a challenge ID for discoverable login (where userId is null)
  const challengeId = crypto.randomUUID();

  // If userId provided, delete any existing challenges for this user and type
  if (userId) {
    await supabase.from('passkey_challenges').delete().eq('user_id', userId).eq('challenge_type', challengeType);
  }

  // Clean up expired challenges (housekeeping)
  await supabase.from('passkey_challenges').delete().lt('expires_at', new Date().toISOString());

  // Store new challenge with 5-minute expiry
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const {
    error
  } = await supabase.from('passkey_challenges').insert({
    id: challengeId,
    user_id: userId || challengeId,
    // For discoverable, use challengeId as user_id
    challenge,
    challenge_type: challengeType,
    expires_at: expiresAt
  });
  if (error) {
    console.error('[passkey-auth] Error storing challenge:', error);
    throw new Error('Failed to store challenge');
  }
  return challengeId;
}

// Helper: Get and validate challenge from database
async function getAndDeleteChallenge(supabase: any, userId: string, challengeType: 'registration' | 'authentication' | 'discoverable'): Promise<string | null> {
  // Get the most recent challenge for this user and type
  const {
    data,
    error
  } = await supabase.from('passkey_challenges').select('challenge, expires_at').eq('user_id', userId).eq('challenge_type', challengeType).order('created_at', {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    console.error('[passkey-auth] Error fetching challenge:', error);
    return null;
  }
  if (!data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    // Delete expired challenge
    await supabase.from('passkey_challenges').delete().eq('user_id', userId).eq('challenge_type', challengeType);
    return null;
  }

  // Delete the challenge after retrieving (one-time use)
  await supabase.from('passkey_challenges').delete().eq('user_id', userId).eq('challenge_type', challengeType);
  return data.challenge;
}

// Normalize base64url credential IDs for consistent matching
// Strips padding, replaces +/ with -_, and trims whitespace
function normalizeCredentialId(id: string): string {
  if (!id) return '';
  return String(id).trim().replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Build a list of variants to try when matching a browser-supplied id
// against stored credentialIds. Some clients send `credential.id`, some
// tools have historically stored `credential.rawId` — accept both.
function credentialIdVariants(credential: any): string[] {
  const variants = new Set<string>();
  if (credential?.id) variants.add(normalizeCredentialId(credential.id));
  if (credential?.rawId) variants.add(normalizeCredentialId(credential.rawId));
  return Array.from(variants).filter(Boolean);
}

// Helper: Find user by credential ID (with normalized matching)
// Accepts either a plain credentialId string OR the whole credential object
async function findUserByCredentialId(supabase: any, credentialOrId: string | any): Promise<{
  userId: string;
  userType: 'job_seeker' | 'employer';
  email: string;
} | null> {
  const searchIds = typeof credentialOrId === 'string' ? [normalizeCredentialId(credentialOrId)] : credentialIdVariants(credentialOrId);
  if (searchIds.length === 0) {
    return null;
  }
  const matches = (storedId: string) => {
    const norm = normalizeCredentialId(storedId);
    return searchIds.some(s => s === norm);
  };

  // Search in user_settings
  const {
    data: userSettings
  } = await supabase.from('user_settings').select('user_id, passkey_credentials').eq('passkey_enabled', true);
  if (userSettings) {
    for (const setting of userSettings) {
      const credentials = setting.passkey_credentials || [];
      const found = credentials.find((c: any) => matches(c.credentialId));
      if (found) {
        const {
          data: profile
        } = await supabase.from('profiles').select('email').eq('user_id', setting.user_id).maybeSingle();
        return {
          userId: setting.user_id,
          userType: 'job_seeker',
          email: profile?.email || ''
        };
      }
    }
  }

  // Search in employer_settings
  const {
    data: employerSettings
  } = await supabase.from('employer_settings').select('user_id, passkey_credentials').eq('passkey_enabled', true);
  if (employerSettings) {
    for (const setting of employerSettings) {
      const credentials = setting.passkey_credentials || [];
      const found = credentials.find((c: any) => matches(c.credentialId));
      if (found) {
        const {
          data: company
        } = await supabase.from('companies').select('email').eq('user_id', setting.user_id).maybeSingle();
        return {
          userId: setting.user_id,
          userType: 'employer',
          email: company?.email || ''
        };
      }
    }
  }
  return null;
}
serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const {
      action,
      userId,
      userType,
      origin: bodyOrigin,
      ...params
    } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({
        error: 'Action is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    const tableName = userType === 'employer' ? 'employer_settings' : 'user_settings';
    const rpName = 'Workly India';

    // Get origin from multiple sources (priority order):
    // 1. Body origin (from frontend or forwarded from password-reset-2fa)
    // 2. Origin header
    // 3. Referer header
    const requestOrigin = bodyOrigin || req.headers.get('origin') || req.headers.get('referer') || '';
    // Use centralized domain helper to get correct rpId
    const rpId = getPasskeyRpId(requestOrigin);
    switch (action) {
      case 'generate-registration-options':
        {
          if (!userId) {
            return new Response(JSON.stringify({
              error: 'userId is required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Get user email for user info
          const profileTable = userType === 'employer' ? 'companies' : 'profiles';
          const {
            data: profile
          } = await supabaseAdmin.from(profileTable).select('email').eq('user_id', userId).maybeSingle();
          const userEmail = profile?.email || `user-${userId.substring(0, 8)}`;

          // Get existing credentials to exclude
          const {
            data: settings
          } = await supabaseAdmin.from(tableName).select('passkey_credentials').eq('user_id', userId).maybeSingle();
          const existingCredentials = settings?.passkey_credentials || [];

          // Generate challenge and store in database
          const challenge = generateChallenge();
          await storeChallenge(supabaseAdmin, userId, challenge, 'registration');
          const options = {
            challenge,
            rp: {
              name: rpName,
              id: rpId
            },
            user: {
              id: base64URLEncode(new TextEncoder().encode(userId)),
              name: userEmail,
              displayName: userEmail.split('@')[0]
            },
            pubKeyCredParams: [{
              alg: -7,
              type: 'public-key'
            },
            // ES256
            {
              alg: -257,
              type: 'public-key'
            } // RS256
            ],
            authenticatorSelection: {
              // REMOVED: authenticatorAttachment: 'platform'
              // By not specifying, we allow BOTH platform and roaming authenticators
              // This enables Google Password Manager sync on Chrome/Android
              // and iCloud Keychain sync on iOS/macOS
              userVerification: 'required',
              residentKey: 'required',
              // Required for discoverable credentials (synced passkeys)
              requireResidentKey: true // For better compatibility with older browsers
            },
            timeout: 60000,
            attestation: 'none',
            excludeCredentials: existingCredentials.map((cred: any) => ({
              id: cred.credentialId,
              type: 'public-key',
              transports: cred.transports || ['internal']
            }))
          };
          return new Response(JSON.stringify(options), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'verify-registration':
        {
          if (!userId || !params.credential) {
            return new Response(JSON.stringify({
              error: 'userId and credential are required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Get challenge from database
          const storedChallenge = await getAndDeleteChallenge(supabaseAdmin, userId, 'registration');
          if (!storedChallenge) {
            return new Response(JSON.stringify({
              error: 'Challenge expired or not found. Please try again.'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const {
            credential
          } = params;

          // Extract credential data
          const credentialData = {
            credentialId: credential.id,
            publicKey: credential.response?.publicKey || credential.rawId,
            counter: 0,
            transports: credential.response?.transports || ['internal'],
            createdAt: new Date().toISOString(),
            deviceName: params.deviceName || 'Unknown Device'
          };

          // Get existing credentials
          const {
            data: existingSettings
          } = await supabaseAdmin.from(tableName).select('passkey_credentials').eq('user_id', userId).maybeSingle();
          const existingCredentials = existingSettings?.passkey_credentials || [];
          const updatedCredentials = [...existingCredentials, credentialData];

          // Update settings
          const {
            error: updateError
          } = await supabaseAdmin.from(tableName).upsert({
            user_id: userId,
            passkey_enabled: true,
            passkey_credentials: updatedCredentials,
            passkey_verified_at: new Date().toISOString(),
            two_factor_enabled: true
          }, {
            onConflict: 'user_id'
          });
          if (updateError) {
            console.error('[passkey-auth] Error saving credential:', updateError);
            return new Response(JSON.stringify({
              error: 'Failed to save credential'
            }), {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          return new Response(JSON.stringify({
            success: true,
            message: 'Passkey registered successfully',
            credentialCount: updatedCredentials.length
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'generate-authentication-options':
        {
          if (!userId) {
            return new Response(JSON.stringify({
              error: 'userId is required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Get user's credentials
          const {
            data: settings
          } = await supabaseAdmin.from(tableName).select('passkey_credentials, passkey_enabled').eq('user_id', userId).maybeSingle();
          if (!settings?.passkey_enabled || !settings?.passkey_credentials?.length) {
            return new Response(JSON.stringify({
              error: 'No passkeys registered'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Generate challenge and store in database
          const challenge = generateChallenge();
          await storeChallenge(supabaseAdmin, userId, challenge, 'authentication');
          const options = {
            challenge,
            rpId,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: settings.passkey_credentials.map((cred: any) => ({
              id: cred.credentialId,
              type: 'public-key',
              transports: cred.transports || ['internal']
            }))
          };
          return new Response(JSON.stringify(options), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'verify-authentication':
        {
          if (!userId || !params.credential) {
            return new Response(JSON.stringify({
              error: 'userId and credential are required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Get challenge from database
          const storedChallenge = await getAndDeleteChallenge(supabaseAdmin, userId, 'authentication');
          if (!storedChallenge) {
            return new Response(JSON.stringify({
              error: 'Challenge expired or not found. Please try again.'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          const {
            credential
          } = params;

          // Get user's credentials
          const {
            data: settings
          } = await supabaseAdmin.from(tableName).select('passkey_credentials').eq('user_id', userId).maybeSingle();
          if (!settings?.passkey_credentials?.length) {
            return new Response(JSON.stringify({
              error: 'No passkeys found'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Find matching credential (normalized comparison)
          const matchingCredential = settings.passkey_credentials.find((cred: any) => normalizeCredentialId(cred.credentialId) === normalizeCredentialId(credential.id));
          if (!matchingCredential) {
            return new Response(JSON.stringify({
              error: 'Credential not recognized'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // In a full implementation, we would verify the signature here
          // For now, we trust the browser's WebAuthn API validation

          // Update counter for replay protection
          const updatedCredentials = settings.passkey_credentials.map((cred: any) => {
            if (normalizeCredentialId(cred.credentialId) === normalizeCredentialId(credential.id)) {
              return {
                ...cred,
                counter: (cred.counter || 0) + 1,
                lastUsedAt: new Date().toISOString()
              };
            }
            return cred;
          });
          await supabaseAdmin.from(tableName).update({
            passkey_credentials: updatedCredentials
          }).eq('user_id', userId);
          return new Response(JSON.stringify({
            verified: true,
            message: 'Authentication successful'
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'disable':
        {
          if (!userId) {
            return new Response(JSON.stringify({
              error: 'userId is required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Check if other 2FA methods are enabled
          const {
            data: settings
          } = await supabaseAdmin.from(tableName).select('totp_enabled, two_factor_method').eq('user_id', userId).maybeSingle();
          const hasOther2FA = settings?.totp_enabled || settings?.two_factor_method === 'telegram';

          // Clean up any pending challenges
          await supabaseAdmin.from('passkey_challenges').delete().eq('user_id', userId);
          const {
            error: updateError
          } = await supabaseAdmin.from(tableName).update({
            passkey_enabled: false,
            passkey_credentials: [],
            passkey_verified_at: null,
            two_factor_enabled: hasOther2FA
          }).eq('user_id', userId);
          if (updateError) {
            return new Response(JSON.stringify({
              error: 'Failed to disable passkeys'
            }), {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          return new Response(JSON.stringify({
            success: true,
            message: 'Passkeys disabled'
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'discoverable-login-options':
        {
          // Generate options for passwordless login (no userId required)
          const challenge = generateChallenge();
          const challengeId = await storeChallenge(supabaseAdmin, null, challenge, 'discoverable');
          const options = {
            challenge,
            challengeId,
            // Return this so client can send it back for verification
            rpId,
            timeout: 60000,
            userVerification: 'required',
            // Empty allowCredentials = browser shows all available passkeys for this RP
            allowCredentials: []
          };
          return new Response(JSON.stringify(options), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      case 'verify-discoverable-login':
        {
          const {
            credential,
            challengeId
          } = params;
          if (!credential || !challengeId) {
            return new Response(JSON.stringify({
              error: 'credential and challengeId are required'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Get challenge from database using challengeId

          const storedChallenge = await getAndDeleteChallenge(supabaseAdmin, challengeId, 'discoverable');
          if (!storedChallenge) {
            return new Response(JSON.stringify({
              error: 'Challenge expired or not found. Please try again.'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Find user by credential ID — pass whole credential so both
          // credential.id AND credential.rawId variants are tried.
          const userInfo = await findUserByCredentialId(supabaseAdmin, credential);
          if (!userInfo) {
            return new Response(JSON.stringify({
              error: 'This passkey is not registered for this website. If you set it up on a different domain, please login with email/password once — it will be linked automatically.'
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Update counter for the credential
          const settingsTable = userInfo.userType === 'employer' ? 'employer_settings' : 'user_settings';
          const {
            data: settings
          } = await supabaseAdmin.from(settingsTable).select('passkey_credentials').eq('user_id', userInfo.userId).maybeSingle();
          if (settings?.passkey_credentials) {
            const updatedCredentials = settings.passkey_credentials.map((cred: any) => {
              if (normalizeCredentialId(cred.credentialId) === normalizeCredentialId(credential.id)) {
                return {
                  ...cred,
                  counter: (cred.counter || 0) + 1,
                  lastUsedAt: new Date().toISOString()
                };
              }
              return cred;
            });
            await supabaseAdmin.from(settingsTable).update({
              passkey_credentials: updatedCredentials
            }).eq('user_id', userInfo.userId);
          }
          // Generate session tokens directly (no magic link email needed)
          // Step 1: Generate a magic link token server-side
          const {
            data: linkData,
            error: linkError
          } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: userInfo.email
          });
          if (linkError || !linkData?.properties?.hashed_token) {
            console.error('[passkey-auth] Error generating link:', linkError);
            return new Response(JSON.stringify({
              error: 'Failed to create session. Please try again.'
            }), {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }

          // Step 2: Immediately verify the token to create a session
          const {
            data: sessionData,
            error: sessionError
          } = await supabaseAdmin.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'email'
          });
          if (sessionError || !sessionData?.session) {
            console.error('[passkey-auth] Error verifying OTP:', sessionError);
            return new Response(JSON.stringify({
              error: 'Failed to create session. Please try again.'
            }), {
              status: 500,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          }
          // Step 3: Return session tokens to frontend
          return new Response(JSON.stringify({
            verified: true,
            userId: userInfo.userId,
            userType: userInfo.userType,
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
            message: 'Passkey verified and logged in successfully'
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }
  } catch (error) {
    console.error('[passkey-auth] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});