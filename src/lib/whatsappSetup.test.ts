import { expect, test } from 'bun:test';
import { needsWhatsAppSetup, needsBusinessVerification, validWhatsAppPin } from './whatsappSetup';

test('missing PIN requires setup after connection', () => {
  expect(needsWhatsAppSetup({ status: 'CONNECTED', is_pin_enabled: false })).toBe(true);
});
test('existing PIN on an activated number does not repeat setup', () => {
  expect(needsWhatsAppSetup({ status: 'CONNECTED', is_pin_enabled: true })).toBe(false);
});
test('pending registration still requires activation with an existing PIN', () => {
  expect(needsWhatsAppSetup({ status: 'PENDING', is_pin_enabled: true })).toBe(true);
});
test('unknown Meta status is not treated as an unset PIN', () => {
  expect(needsWhatsAppSetup({ is_pin_enabled: null })).toBe(false);
});
test('business verification is independent of PIN and number registration', () => {
  expect(needsBusinessVerification({ business_verification_status: 'NOT_VERIFIED', status: 'CONNECTED', is_pin_enabled: true })).toBe(true);
  expect(needsBusinessVerification({ business_verification_status: 'VERIFIED' })).toBe(false);
  expect(needsBusinessVerification({})).toBe(false);
});
test('PIN requires exactly six digits and matching confirmation', () => {
  expect(validWhatsAppPin('012345', '012345')).toBe(true);
  expect(validWhatsAppPin('12345', '12345')).toBe(false);
  expect(validWhatsAppPin('1234567', '1234567')).toBe(false);
  expect(validWhatsAppPin('123456', '654321')).toBe(false);
  expect(validWhatsAppPin('abcdef', 'abcdef')).toBe(false);
});