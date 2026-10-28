import { describe, expect, test } from 'bun:test';
import { DEFAULT_SOCIAL_ICONS, resolveSocialIcons } from './emailSocialIcons';

describe('shared email social artwork', () => {
  test('saved Cloudflare artwork is used without transforming its original URL', () => {
    const url = 'https://pub-workly.r2.dev/media/brand/1769cddb-7244-4b4b-a86f-e0ca3bc028db/instagram.png';
    expect(resolveSocialIcons({ email_social_icon_instagram: url }).instagram).toBe(url);
  });
  test('replacing a saved icon resolves the new artwork', () => {
    const first = resolveSocialIcons({ email_social_icon_whatsapp: 'https://cdn.example/old.png' });
    const updated = resolveSocialIcons({ email_social_icon_whatsapp: 'https://cdn.example/new.png' });
    expect(first.whatsapp).toBe('https://cdn.example/old.png');
    expect(updated.whatsapp).toBe('https://cdn.example/new.png');
  });
  test('deleting an override restores the same email default', () => {
    expect(resolveSocialIcons({ email_social_icon_whatsapp: '' }).whatsapp).toBe(DEFAULT_SOCIAL_ICONS.whatsapp);
  });
});