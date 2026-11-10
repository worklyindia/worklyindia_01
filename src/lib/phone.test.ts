import { describe, expect, it } from 'vitest';
import { isValidE164, joinPhone, toE164 } from './phone';

describe('global phone numbers', () => {
  it('saves a US number with its own country code', () => {
    expect(joinPhone('1', '2025550123')).toBe('+12025550123');
  });
  it('saves a UK number and drops the leading trunk zero', () => {
    expect(joinPhone('44', '07911123456')).toBe('+447911123456');
  });
  it('accepts non-Indian numbers as valid', () => {
    expect(isValidE164('+971501234567')).toBe(true);
  });
  it('keeps old 10-digit numbers as Indian', () => {
    expect(toE164('9876543210')).toBe('+919876543210');
  });
});
