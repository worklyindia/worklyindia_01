import type { SupabaseClient } from '@supabase/supabase-js';

export async function verifySignupEmailOtp(client: Pick<SupabaseClient, 'auth'>, email: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the complete 6-digit code.');
  const { data, error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'signup' });
  if (error) throw error;
  if (!data.session) throw new Error('Could not complete verification. Please request a new code.');
  return data.session;
}