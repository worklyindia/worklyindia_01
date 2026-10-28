import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getTaskRouting, PROFILE_READ_TOOLS } from './utils/taskRouter.ts';

Deno.test('routes profile audit with read-only tools enabled', () => {
  const routing = getTaskRouting([{ role: 'user', content: 'Meri profile check karo' }], false);
  assertEquals(routing.taskType, 'profile_audit');
  assertEquals(routing.enableTools, true);
  assertEquals(routing.primaryModel, 'google/gemini-2.5-flash');
  assertEquals(routing.toolSubset, PROFILE_READ_TOOLS);
  assert(routing.openerStatus && routing.openerStatus.length > 0);
});

Deno.test('routes personal lookup (mera email batao) with read-only tools', () => {
  const routing = getTaskRouting([{ role: 'user', content: 'Mera email batao' }], false);
  assertEquals(routing.taskType, 'personal_lookup');
  assertEquals(routing.enableTools, true);
  assertEquals(routing.primaryModel, 'google/gemini-2.5-flash');
  assert(routing.toolSubset?.includes('get_user_profile'));
  assert(!routing.toolSubset?.includes('send_email_to_user'));
});

Deno.test('routes email send with action model and full tools', () => {
  const routing = getTaskRouting([{ role: 'user', content: 'Ye pdf mere email pe bhej do' }], false);
  assertEquals(routing.taskType, 'delivery');
  assertEquals(routing.enableTools, true);
  assertEquals(routing.primaryModel, 'google/gemini-2.5-flash');
  assertEquals(routing.toolSubset, null);
});

Deno.test('routes greeting to flash-lite with no tools', () => {
  const routing = getTaskRouting([{ role: 'user', content: 'Hello' }], false);
  assertEquals(routing.taskType, 'greeting');
  assertEquals(routing.enableTools, false);
  assertEquals(routing.primaryModel, 'google/gemini-2.5-flash-lite');
});

Deno.test('every routing returns an opener status', () => {
  const cases = ['Hello', 'Mera email batao', 'jobs dikhao', 'image banao logo', 'pdf bhejo', 'profile update karo'];
  for (const text of cases) {
    const routing = getTaskRouting([{ role: 'user', content: text }], false);
    assert(routing.openerStatus && routing.openerStatus.length > 0, `missing openerStatus for: ${text}`);
  }
});

Deno.test('routes Hinglish bio update ("acha new likho update kare") to profile_update with tools', () => {
  const routing = getTaskRouting(
    [
      { role: 'user', content: 'Job seekers profile bio kya abhi' },
      { role: 'assistant', content: 'Tumhara current bio: Experienced full-stack developer ...' },
      { role: 'user', content: 'Acha new likho update kare' },
    ],
    false,
  );
  assertEquals(routing.taskType, 'profile_update');
  assertEquals(routing.enableTools, true);
  assertEquals(routing.forceTools, true);
});

Deno.test('routes short confirmation ("Ok kar de update") as profile_update when prior context was a profile change', () => {
  const routing = getTaskRouting(
    [
      { role: 'user', content: 'Bio update karo' },
      { role: 'assistant', content: 'Naya bio kya likhna hai? Confirm karo to update kar dun.' },
      { role: 'user', content: 'Ok kar de update' },
    ],
    false,
  );
  assertEquals(routing.taskType, 'profile_update');
  assertEquals(routing.enableTools, true);
});

Deno.test('plain "ok" without prior profile context still routes to greeting', () => {
  const routing = getTaskRouting(
    [
      { role: 'user', content: 'jobs dikhao' },
      { role: 'assistant', content: 'Yahan kuch jobs hain ...' },
      { role: 'user', content: 'ok' },
    ],
    false,
  );
  assertEquals(routing.taskType, 'greeting');
});

Deno.test('Hinglish "naam update karo to Rahul" routes to profile_update', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Mera naam update karo to Rahul Kumar' }],
    false,
  );
  assertEquals(routing.taskType, 'profile_update');
});

Deno.test('Hinglish "telegram username set karo @rahul" routes to profile_update', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Telegram username set karo @rahul_dev' }],
    false,
  );
  assertEquals(routing.taskType, 'profile_update');
});

Deno.test('connected YouTube channel performance request never routes to public video search', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Mere youtube channel dekho last video kese chal raha hai' }],
    false,
  );
  assertEquals(routing.taskType, 'youtube_analytics');
  assertEquals(routing.enableTools, false);
});

Deno.test('mere connected YouTube channel growth request uses private analytics', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Maine YouTube connect kiya hai mera channel full performance analytics karo' }],
    false,
  );
  assertEquals(routing.taskType, 'youtube_analytics');
});

Deno.test('plain YouTube advice does not trigger an unrelated video search', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'YouTube channel grow kaise kare' }],
    false,
  );
  assertEquals(routing.taskType, 'general_chat');
});

Deno.test('explicit YouTube video request still uses public search', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'YouTube search karke AI growth video do' }],
    false,
  );
  assertEquals(routing.taskType, 'youtube_search');
});

Deno.test('connected-channel latest video request wins over the word dikhao', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Mera connected YouTube channel dikhao aur latest video ka performance batao' }],
    false,
  );
  assertEquals(routing.taskType, 'youtube_analytics');
  assertEquals(routing.enableTools, false);
});

Deno.test('named owned video analytics does not invoke public discovery', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Mere video AI Se YouTube Channel Grow Kaise Kare ka full analytics check karo' }],
    false,
  );
  assertEquals(routing.taskType, 'youtube_analytics');
});

Deno.test('gmail request with the word "search" does not go to YouTube', () => {
  const routing = getTaskRouting(
    [{ role: 'user', content: 'Meri Gmail check kare jio pement bank statement search de' }],
    false,
  );
  assertEquals(routing.taskType, 'mailbox');
  assert(routing.toolSubset?.includes('search_my_mailbox'));
});

Deno.test('mailbox follow-up "pdf de" stays in mailbox context', () => {
  const routing = getTaskRouting(
    [
      { role: 'user', content: 'Meri gmail check karo' },
      { role: 'assistant', content: 'SBI email mila, subject: statement, sender: alerts@sbi.co.in' },
      { role: 'user', content: 'Pdf de' },
    ],
    false,
  );
  assertEquals(routing.taskType, 'mailbox');
});
