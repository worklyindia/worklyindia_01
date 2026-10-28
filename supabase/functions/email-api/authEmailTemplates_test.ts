/**
 * Checks the auth email hook's decisions: the link Supabase's users click, the
 * two mails an email change needs, and whose copy is used for each message.
 */

import { assertEquals, assert } from 'jsr:@std/assert';
import {
  buildActionLink,
  fill,
  parseAuthHookPayload,
  planAuthEmails,
  renderAuthEmail,
  AUTH_OTP_EXPIRY_SECONDS,
  authOtpExpiresAt,
  AUTH_TEMPLATE_KEYS,
} from '../_shared/authEmailTemplates.ts';

const SUPABASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co';
const SITE = `${SUPABASE_URL}/auth/v1`;

Deno.test('password reset carries the six-digit OTP used by the reset screen', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u1', email: 'rahul@example.com', user_metadata: { full_name: 'Rahul Kumar' } },
      email_data: {
        email_action_type: 'recovery',
        token: '753643',
        token_hash: 'ABC123',
        site_url: SITE,
        redirect_to: 'https://worklyindia.devs.surf/reset-password',
      },
    },
    SUPABASE_URL,
  );

  assertEquals(plans.length, 1);
  assertEquals(plans[0].to, 'rahul@example.com');
  assertEquals(plans[0].templateKey, 'password_reset');
  assertEquals(plans[0].otp, '753643');
  assertEquals(
    plans[0].link,
    'https://jubwzelupbntbetpajqb.supabase.co/auth/v1/verify?token=ABC123&type=recovery&redirect_to=https%3A%2F%2Fworklyindia.devs.surf%2Freset-password',
  );
});

Deno.test('a signup confirms to the signup address and uses the confirm template', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u2', email: 'new@example.com', user_metadata: { full_name: 'New User' } },
      email_data: { email_action_type: 'signup', token_hash: 'SIG123', site_url: SITE },
    },
    SUPABASE_URL,
  );

  assertEquals(plans.length, 1);
  assertEquals(plans[0].templateKey, 'email_verification');
  assert(plans[0].link.includes('type=signup'));
});

Deno.test('an email change mails both addresses, each with its own OTP', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u3', email: 'old@example.com', new_email: 'new@example.com' },
      email_data: {
        email_action_type: 'email_change',
        token_hash: 'HASH_FOR_NEW',
        token: '333444',
        token_hash_new: 'HASH_FOR_CURRENT',
        token_new: '111222',
        site_url: SITE,
        redirect_to: 'https://worklyindia.devs.surf/verify-email-change',
      },
    },
    SUPABASE_URL,
  );

  assertEquals(plans.length, 2);
  const toNew = plans.find((p) => p.to === 'new@example.com');
  const toCurrent = plans.find((p) => p.to === 'old@example.com');
  assert(toNew, 'the address being moved to must be mailed');
  assert(toCurrent, 'the address on file today must be mailed');
  assertEquals(toNew.templateKey, 'email_change_new');
  assertEquals(toCurrent.templateKey, 'email_change_current');
  assertEquals(toNew.otp, '111222');
  assertEquals(toCurrent.otp, '333444');
  assert(toNew.link.includes('token=HASH_FOR_NEW'));
  assert(toCurrent.link.includes('token=HASH_FOR_CURRENT'));
  // Both links are verified as an email_change by Supabase's /verify endpoint.
  assert(toNew.link.includes('type=email_change'));
  assert(toCurrent.link.includes('type=email_change'));
});

Deno.test('single confirmation emails only the new address with token', () => {
  const plans = planAuthEmails({ user: { email: 'old@example.com', new_email: 'new@example.com' }, email_data: { email_action_type: 'email_change', token: '123456', token_hash: 'NEW_HASH' } }, SUPABASE_URL);
  assertEquals(plans.length, 1);
  assertEquals(plans[0].to, 'new@example.com');
  assertEquals(plans[0].otp, '123456');
});

Deno.test('email event destination metadata is used when user destination is absent', () => {
  const plans = planAuthEmails({ user: { email: 'old@example.com' }, email_data: { email_action_type: 'email_change', old_email: 'old@example.com', new_email: 'new@example.com', token: '654321', token_new: '123456', token_hash: 'NEW_HASH', token_hash_new: 'CURRENT_HASH' } }, SUPABASE_URL);
  assertEquals(plans.length, 2);
  assertEquals(plans[0].to, 'new@example.com');
  assertEquals(plans[0].otp, '123456');
  assertEquals(plans[1].to, 'old@example.com');
  assertEquals(plans[1].otp, '654321');
});

Deno.test('saved auth link copy cannot replace the fixed OTP-only email body', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u4', email: 'rahul@example.com', user_metadata: { full_name: 'Rahul Kumar' } },
      email_data: { email_action_type: 'recovery', token: '753643', token_hash: 'ABC123', site_url: SITE },
    },
    SUPABASE_URL,
  );

  const rendered = renderAuthEmail({
    plan: plans[0],
    name: 'Rahul Kumar',
    saved: {
      subject: 'Reset your password, {{name}}',
      body: '<p>Hi {{name}}, use {{confirm_link}} to get back in.</p>',
      enabled: true,
    },
  });

  assertEquals(rendered.subject, 'Reset your password, Rahul Kumar');
  assert(rendered.html.includes('753643'), 'the OTP must be visible in the body');
  assert(!rendered.html.includes('token=ABC123'), 'the signed link must not be in the body');
  assert(!rendered.html.includes('<a '), 'the email must not contain a button or link');
});

Deno.test('a missing or switched-off template still sends the built-in copy', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u5', email: 'rahul@example.com' },
      email_data: { email_action_type: 'recovery', token: '753643', token_hash: 'ABC123', site_url: SITE },
    },
    SUPABASE_URL,
  );

  for (const saved of [null, undefined]) {
    const rendered = renderAuthEmail({ plan: plans[0], name: 'Rahul', saved });
    assert(rendered.html.includes('Password reset code'), 'built-in copy must be used');
    assert(rendered.html.includes('753643'));
    assert(!rendered.html.includes('token=ABC123'));
  }
});

Deno.test('an empty variable leaves nothing behind', () => {
  const filled = fill('<p>Code: {{otp}} for {{email}}</p>', { otp: '', email: 'a@b.com' });
  assert(!filled.includes('{{otp}}'));
  assert(filled.includes('a@b.com'));
});

Deno.test('a site_url without /auth/v1 still produces a working link', () => {
  const link = buildActionLink({
    siteUrl: SUPABASE_URL,
    supabaseUrl: SUPABASE_URL,
    tokenHash: 'T1',
    action: 'recovery',
  });
  assertEquals(link, 'https://jubwzelupbntbetpajqb.supabase.co/auth/v1/verify?token=T1&type=recovery');
});

Deno.test('the hook body is parsed, and junk is refused', () => {
  const payload = parseAuthHookPayload(
    '{"user":{"email":"a@b.com"},"email_data":{"email_action_type":"recovery","token_hash":"T9"}}',
  );
  assert(payload, 'a well-formed hook body must parse');
  assertEquals(payload.email_data?.token_hash, 'T9');
  assertEquals(parseAuthHookPayload('not json'), null);
  assertEquals(parseAuthHookPayload('[1,2]'), null);
  assertEquals(parseAuthHookPayload('{"user":{"email":"a@b.com"}}'), null, 'email_data is required');
});

Deno.test('a plan carries its own token so a retry cannot send twice', () => {
  const plans = planAuthEmails(
    {
      user: { id: 'u6', email: 'rahul@example.com' },
      email_data: { email_action_type: 'recovery', token_hash: 'ABC123', site_url: SITE },
    },
    SUPABASE_URL,
  );
  assertEquals(plans[0].tokenHash, 'ABC123');
});

Deno.test('custom authentication email codes expire exactly five minutes after issuance', () => {
  const issuedAt = Date.parse('2026-10-12T08:48:00Z');
  assertEquals(AUTH_OTP_EXPIRY_SECONDS, 300);
  assertEquals(authOtpExpiresAt(issuedAt), Date.parse('2026-10-12T08:53:00Z'));
});

Deno.test('every auth email keeps all six digits together with personalized instructions and expiry', () => {
  for (const templateKey of AUTH_TEMPLATE_KEYS) {
    const rendered = renderAuthEmail({
      name: 'Rahul Kumar',
      plan: { to: 'rahul@example.com', templateKey, otp: '285351', tokenHash: 'TEST', link: 'https://example.com/verify', newEmail: 'new@example.com', oldEmail: 'old@example.com' },
    });
    assert(rendered.html.includes('Hi Rahul Kumar,'));
    assert(rendered.html.includes('white-space:nowrap'));
    assert(rendered.html.includes('word-break:normal'));
    assert(rendered.html.includes('overflow-wrap:normal'));
    assert(rendered.html.includes('letter-spacing:0'));
    assert(/<span[^>]*>285351<\/span>/.test(rendered.html));
    assert(rendered.html.includes('<strong>5 minutes</strong>'));
    assert(rendered.html.includes('only once'));
    assert(rendered.html.includes('Keep this code private'));
    assert(!rendered.html.includes('<a '));
    assert(!/background(?:-color)?\s*:|\bbgcolor\s*=/i.test(rendered.html), 'Gmail must own the background in both light and dark mode');
    assert(!rendered.html.includes('border-radius:'), 'authentication content must not be a decorative card');
    assert(rendered.html.includes('color:#374151'), 'body text needs a readable light-mode baseline');
  }
});

Deno.test('personalized greetings escape markup and fall back safely for a missing name', () => {
  const plan = { to: 'rahul@example.com', templateKey: 'password_reset' as const, otp: '285351', tokenHash: 'TEST', link: '', newEmail: '', oldEmail: '' };
  assert(renderAuthEmail({ plan, name: '   ' }).html.includes('Hi there,'));
  const html = renderAuthEmail({ plan, name: '<script>alert(1)</script>' }).html;
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt;'));
});
