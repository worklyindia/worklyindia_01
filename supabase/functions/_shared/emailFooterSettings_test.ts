import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { loadSocialLinks, socialRowHtml } from './engagementEmailTemplates.ts';
import { publicEmailImage } from './emailImageAssets.ts';

Deno.test('footer WhatsApp reads latest owner link', async () => {
  let whatsapp = '+91 9904923067';
  const db = { from: (table: string) => table === 'site_settings'
    ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: { whatsapp } } }) }) }) }
    : { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) } };
  assertEquals((await loadSocialLinks(db)).whatsapp, 'https://wa.me/919904923067');
  whatsapp = 'https://wa.me/123456789';
  assertEquals((await loadSocialLinks(db)).whatsapp, 'https://wa.me/123456789');
});

Deno.test('owner Cloudflare icon remains original and never copies to Supabase', async () => {
  const icon = 'https://pub-example.r2.dev/media/brand/11111111-2222-3333-4444-555555555555/new-icon.png';
  const db = { storage: { from: () => { throw new Error('Must not copy R2 artwork'); } } };
  assertEquals(await publicEmailImage(db, icon, 'https://example.com/fallback.png', 'https://example.lovable.app'), icon);
});

Deno.test('WhatsApp is in same social row with selected icon and link', () => {
  const html = socialRowHtml({ whatsapp: 'https://wa.me/123456789' }, { whatsapp: 'https://example.com/owner.png' });
  assertStringIncludes(html, 'href="https://wa.me/123456789"');
  assertStringIncludes(html, 'src="https://example.com/owner.png"');
  assertEquals((html.match(/<tr>/g) || []).length, 1);
  assertEquals((html.match(/<td /g) || []).length, 7);
});