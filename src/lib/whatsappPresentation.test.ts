import { expect, test } from 'bun:test';
import { whatsappWebHref } from './whatsappLinks';
import { formatWhatsappTimezone } from './whatsappTimezone';

test('WhatsApp developer domain links open the original website', () => {
  expect(whatsappWebHref('developers.facebook.com')).toBe('https://developers.facebook.com/');
  expect(whatsappWebHref('https://developers.facebook.com/docs')).toBe('https://developers.facebook.com/docs');
});
test('template web links reject executable schemes and unfilled parameters', () => {
  expect(whatsappWebHref('javascript:alert(1)')).toBeUndefined();
  expect(whatsappWebHref('https://example.com/{{1}}')).toBeUndefined();
});
test('Meta timezone ID 1 means Los Angeles, not India or UTC+1', () => {
  expect(formatWhatsappTimezone('1')).toBe('Pacific Time (America/Los_Angeles)');
  expect(formatWhatsappTimezone('71')).toBe('India Standard Time (Asia/Kolkata, UTC+05:30)');
});