import type { SupabaseClient, User } from '@supabase/supabase-js';

export function confirmedAccountPhone(user: Pick<User, 'phone' | 'phone_confirmed_at'> | null | undefined): string {
  return user?.phone && user.phone_confirmed_at ? `+${user.phone.replace(/\D/g, '')}` : '';
}

export function requiresAccountPhone(enabled: boolean, user: Pick<User, 'phone' | 'phone_confirmed_at'> | null | undefined): boolean {
  return enabled && Boolean(user) && !confirmedAccountPhone(user);
}

export function profilePhoneLocked(enabled: boolean, confirmedPhone: string): boolean {
  return enabled && Boolean(confirmedPhone);
}

export function verifiedOnboardingPhone(user: Pick<User, 'phone' | 'phone_confirmed_at' | 'user_metadata'> | null | undefined): string {
  if (!user) return '';
  if (user.phone && user.phone_confirmed_at) return `+${user.phone.replace(/\D/g, '')}`;
  const digits = String(user.user_metadata?.mobile_number || '').replace(/\D/g, '');
  if (user.user_metadata?.phone_verified !== true) return '';
  return digits.length === 10 ? `+91${digits}` : digits.length >= 11 ? `+${digits}` : '';
}

export function onboardingPhoneAllowed(enabled: boolean, loading: boolean, lockedPhone: string, phone: string, available: boolean | null): boolean {
  if (loading) return false;
  if (lockedPhone) return lockedPhone === phone;
  return !enabled && available === true;
}

/** Read back the confirmed phone from Auth; never trust the entered OTP alone. */
export async function verifyAccountPhoneOtp(client: Pick<SupabaseClient, 'auth'>, phone: string, token: string): Promise<void> {
  const { data: before, error: beforeError } = await client.auth.getUser();
  if (beforeError || !before.user) throw new Error('Please sign in again to verify your number.');
  const { error } = await client.auth.verifyOtp({ phone, token, type: 'phone_change' });
  if (error) throw error;
  const { data, error: readError } = await client.auth.getUser();
  if (readError || data.user?.id !== before.user.id || !data.user?.phone_confirmed_at ||
      `+${String(data.user?.phone || '').replace(/\D/g, '')}` !== phone) {
    throw new Error('Your number has not been saved yet. Please verify it again.');
  }
}