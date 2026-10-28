import { expect, test } from 'bun:test';
import { metaReplyPatch, supportOwnerId, supportSettingsKey, type SupportChannel } from '../../supabase/functions/_shared/supportReplyScope';
import { metaChatRequest } from './metaChatScope';
import { loadSupportAccountSettings } from '../../supabase/functions/_shared/supportReplySettings';

function client(common: Record<string, unknown> | null, saved: Record<string, unknown> | null) {
  const reads: Array<{ table: string; filters: Record<string, string> }> = [];
  return { reads, from(table: string) {
    const filters: Record<string, string> = {};
    reads.push({ table, filters });
    const query = { select: (_fields: string) => query, eq: (key: string, value: string) => { filters[key] = value; return query; }, maybeSingle: async () => ({ data: table === 'owner_support_settings' ? common : saved ? { settings: saved } : null, error: null }) };
    return query;
  } };
}

test('Support WhatsApp stays off until that number is explicitly enabled, even if email is enabled', async () => {
  const db = client({ enabled: true }, null);
  expect((await loadSupportAccountSettings(db, 'owner-a', 'whatsapp', 'phone-a')).enabled).toBe(false);
  expect(db.reads[1]).toEqual({ table: 'support_account_reply_settings', filters: { user_id: 'owner-a', channel: 'whatsapp', account_id: 'phone-a' } });
});
test('An individual mailbox can be enabled while the shared email switch is off', async () => {
  expect((await loadSupportAccountSettings(client({ enabled: false }, { enabled: true }), 'owner', 'gmail')).enabled).toBe(true);
});
test('An individual mailbox can be disabled while shared email replies are on', async () => {
  expect((await loadSupportAccountSettings(client({ enabled: true }, { enabled: false }), 'owner', 'outlook')).enabled).toBe(false);
});
test('Never-enabled Gmail stays off even when the removed shared switch was on', async () => {
  expect((await loadSupportAccountSettings(client({ enabled: true }, null), 'owner', 'gmail')).enabled).toBe(false);
});
test('Never-enabled Outlook stays off even when the removed shared switch was on', async () => {
  expect((await loadSupportAccountSettings(client({ enabled: true }, null), 'owner', 'outlook')).enabled).toBe(false);
});
test('Never-enabled domain email stays off even when the removed shared switch was on', async () => {
  expect((await loadSupportAccountSettings(client({ enabled: true }, null), 'owner', 'custom_email')).enabled).toBe(false);
});
test('Support ignores removed custom details and uses automatic website support defaults', async () => {
  const settings = await loadSupportAccountSettings(client({ business_info: 'old contacts', language: 'English' }, { enabled: true, signature: 'old email' }), 'owner', 'gmail');
  expect(settings).toEqual({ enabled: true, tone: 'friendly', language: 'auto', business_info: '', custom_instructions: '', signature: '' });
});

test('Support comment toggle changes only comments on the selected support account', () => {
  expect(metaChatRequest({ action: 'settings', account_id: 'support-instagram', settings: metaReplyPatch('comments', false) }, 'support')).toEqual({ action: 'settings', account_id: 'support-instagram', audience: 'support', settings: { ai_reply_comments: false } });
});
test('Support DM toggle changes only messages, independently of comments', () => {
  expect(metaReplyPatch('messages', true)).toEqual({ ai_reply_messages: true });
  expect(metaReplyPatch('messages', false)).toEqual({ ai_reply_messages: false });
});
test('Each support email provider has an independent settings key', () => {
  const channels: SupportChannel[] = ['gmail', 'outlook', 'custom_email'];
  expect(new Set(channels.map((p) => supportSettingsKey('owner', p))).size).toBe(3);
});
test('WhatsApp settings never apply to another phone or owner', () => {
  const key = supportSettingsKey('owner-a', 'whatsapp', 'phone-a');
  expect(key).not.toBe(supportSettingsKey('owner-a', 'whatsapp', 'phone-b'));
  expect(key).not.toBe(supportSettingsKey('owner-b', 'whatsapp', 'phone-a'));
});
test('Support identity is stable and separate from personal AI identity', async () => {
  const id = '12345678-1234-1234-1234-123456789012';
  expect(await supportOwnerId(id)).toBe(await supportOwnerId(id));
  expect(await supportOwnerId(id)).not.toBe(id);
  expect(await supportOwnerId(id)).not.toBe(await supportOwnerId('other-owner'));
});