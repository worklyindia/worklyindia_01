import { expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifySignupEmailOtp } from './signupEmailOtp';

test('email verification submits the entered six-digit signup OTP', async () => {
  let submitted: unknown;
  const session = { access_token: 'test-session' };
  const client = { auth: { verifyOtp: async (input: unknown) => {
    submitted = input;
    return { data: { session }, error: null };
  } } } as unknown as Pick<SupabaseClient, 'auth'>;
  expect(await verifySignupEmailOtp(client, ' User@Example.com ', '123456')).toBe(session);
  expect(submitted).toEqual({ email: 'user@example.com', token: '123456', type: 'signup' });
});

test('incomplete codes cannot initiate verification', async () => {
  let called = false;
  const client = { auth: { verifyOtp: async () => { called = true; } } } as unknown as Pick<SupabaseClient, 'auth'>;
  await expect(verifySignupEmailOtp(client, 'user@example.com', '12345')).rejects.toThrow();
  expect(called).toBe(false);
});

test('a verification without a session cannot report success', async () => {
  const client = { auth: { verifyOtp: async () => ({ data: { session: null }, error: null }) } } as unknown as Pick<SupabaseClient, 'auth'>;
  await expect(verifySignupEmailOtp(client, 'user@example.com', '123456')).rejects.toThrow('Could not complete verification');
});