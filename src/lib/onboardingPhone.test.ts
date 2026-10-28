import { expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmedAccountPhone, requiresAccountPhone, profilePhoneLocked, onboardingPhoneAllowed, verifiedOnboardingPhone, verifyAccountPhoneOtp } from './onboardingPhone';

test('enabling verification gates existing accounts without a confirmed Auth number', () => {
  expect(requiresAccountPhone(true, { phone: '', phone_confirmed_at: undefined })).toBe(true);
  expect(requiresAccountPhone(true, { phone: '919876543210', phone_confirmed_at: undefined })).toBe(true);
});
test('disabling verification removes the existing-account gate', () => {
  expect(requiresAccountPhone(false, { phone: '', phone_confirmed_at: undefined })).toBe(false);
});
test('confirmed Auth number releases the gate and locks profiles only while ON', () => {
  const user = { phone: '919876543210', phone_confirmed_at: '2026-10-14' };
  expect(requiresAccountPhone(true, user)).toBe(false);
  expect(confirmedAccountPhone(user)).toBe('+919876543210');
  expect(profilePhoneLocked(true, confirmedAccountPhone(user))).toBe(true);
  expect(profilePhoneLocked(false, confirmedAccountPhone(user))).toBe(false);
});

test('owner verification ON blocks social-login onboarding without a verified number', () => {
  expect(onboardingPhoneAllowed(true, false, '', '+919876543210', true)).toBe(false);
});
test('owner verification OFF permits an available unverified number', () => {
  expect(onboardingPhoneAllowed(false, false, '', '+919876543210', true)).toBe(true);
});
test('pending owner setting cannot bypass verification', () => {
  expect(onboardingPhoneAllowed(false, true, '', '+919876543210', true)).toBe(false);
});
test('verified signup number is locked and cannot be replaced', () => {
  expect(onboardingPhoneAllowed(true, false, '+919876543210', '+919876543210', null)).toBe(true);
  expect(onboardingPhoneAllowed(false, false, '+919876543210', '+919876543211', true)).toBe(false);
});
test('an unconfirmed Auth phone must not lock the number', () => {
  expect(verifiedOnboardingPhone({ phone: '919876543210', user_metadata: {} })).toBe('');
  expect(verifiedOnboardingPhone({ phone: '919876543210', phone_confirmed_at: '2026-10-14', user_metadata: {} })).toBe('+919876543210');
});
test('verified signup metadata continues to prefill the number', () => {
  expect(verifiedOnboardingPhone({ user_metadata: { mobile_number: '9876543210', phone_verified: true } })).toBe('+919876543210');
});
test('authenticated OTP uses phone_change and reads saved phone from the same account', async () => {
  let input: unknown;
  let reads = 0;
  const client = { auth: {
    getUser: async () => ({ data: { user: ++reads === 1 ? { id: 'social-user' } : { id: 'social-user', phone: '919876543210', phone_confirmed_at: '2026-10-14' } }, error: null }),
    verifyOtp: async (value: unknown) => { input = value; return { error: null }; },
  } } as unknown as Pick<SupabaseClient, 'auth'>;
  await verifyAccountPhoneOtp(client, '+919876543210', '123456');
  expect(input).toEqual({ phone: '+919876543210', token: '123456', type: 'phone_change' });
  expect(reads).toBe(2);
});
test('OTP success without a persisted confirmed phone cannot report verified', async () => {
  const client = { auth: {
    getUser: async () => ({ data: { user: { id: 'social-user' } }, error: null }),
    verifyOtp: async () => ({ error: null }),
  } } as unknown as Pick<SupabaseClient, 'auth'>;
  await expect(verifyAccountPhoneOtp(client, '+919876543210', '123456')).rejects.toThrow('not been saved');
});