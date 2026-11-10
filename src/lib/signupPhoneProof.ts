import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Signup SMS OTP creates a temporary phone-only login. We keep its user id as
 * proof, then (once the email account is signed in) the server moves the
 * verified phone onto that account and removes the temporary login.
 */
const KEY = 'signup_phone_proof';

export const saveSignupPhoneProof = (phoneUserId: string | undefined, phone: string) => {
  if (!phoneUserId) return;
  try { localStorage.setItem(KEY, JSON.stringify({ id: phoneUserId, phone, at: Date.now() })); } catch { /* ignore */ }
};

const readProof = (): { id: string; phone: string; at: number } | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!p?.id || Date.now() - Number(p.at) > 24 * 3600 * 1000) return null;
    return p;
  } catch { return null; }
};

let inFlight: Promise<boolean> | null = null;

/** Links the OTP-verified signup phone to the signed-in email account. Safe to call repeatedly. */
export const linkSignupVerifiedPhone = (client: SupabaseClient): Promise<boolean> => {
  if (inFlight) return inFlight;
  const proof = readProof();
  if (!proof) return Promise.resolve(false);
  inFlight = (async () => {
    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user?.email || user.id === proof.id) return false;
      const { data, error } = await (client as any).rpc('link_signup_verified_phone', { _phone_user_id: proof.id });
      if (error) return false;
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      if (data === true) await client.auth.refreshSession();
      return data === true;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};
