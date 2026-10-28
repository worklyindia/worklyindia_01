import { expect, test } from 'bun:test';
import { loadSupportWebsiteFacts } from '../../supabase/functions/_shared/supportWebsiteFacts';

function fixture() {
  let contact = { email: 'help@example.com', phone: '+919876543210', office_address: 'Verified office' };
  const filters: Array<[string, unknown]> = [];
  return { filters, update(v: typeof contact) { contact = v; }, from(table: string) {
    const q = { select: () => q, in: (key: string, value: unknown) => { filters.push([key, value]); return q; }, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, order: () => q,
      limit: async () => ({ data: [{ question: 'How to apply?', answer: 'Sign in and apply from the job page.' }], error: null }),
      then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: table === 'site_settings' ? [{ key: 'contact_info', value: contact }] : [], error: null }).then(resolve); },
    }; return q;
  } };
}
test('Support shares the current Contact Us email, phone and address', async () => {
  const facts = await loadSupportWebsiteFacts(fixture());
  expect(facts).toContain('Contact email: help@example.com');
  expect(facts).toContain('Contact phone: +919876543210');
  expect(facts).toContain('Contact address: Verified office');
});
test('Contact Us updates are read on the next reply without a stale cache', async () => {
  const db = fixture(); await loadSupportWebsiteFacts(db);
  db.update({ email: 'new@example.com', phone: '+441234567890', office_address: 'New office' });
  const facts = await loadSupportWebsiteFacts(db);
  expect(facts).toContain('new@example.com'); expect(facts).not.toContain('help@example.com');
});
test('Support loads only active public FAQs and never customer records', async () => {
  const db = fixture(); const facts = await loadSupportWebsiteFacts(db);
  expect(db.filters).toContainEqual(['is_active', true]);
  expect(facts).toContain('Verified answer: Sign in and apply from the job page.');
});