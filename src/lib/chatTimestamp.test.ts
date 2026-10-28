import { expect, test } from 'bun:test';
import { formatChatDate, formatChatTime, startsChatDay } from './chatTimestamp';

test('messages show HH:MM AM or PM without seconds on every day', () => {
  expect(formatChatTime('2026-10-09T09:05:59')).toBe('09:05 AM');
  expect(formatChatTime('2026-10-09T17:07:30')).toBe('05:07 PM');
  expect(formatChatTime('2026-10-09T00:00:00')).toBe('12:00 AM');
  expect(formatChatTime('2026-10-09T12:00:00')).toBe('12:00 PM');
});

test('day labels use DD Month YYYY', () => {
  expect(formatChatDate('2026-10-09T17:07:30')).toBe('09 October 2026');
});

test('day label appears at start and on day changes only', () => {
  expect(startsChatDay('2026-10-09T09:00:00')).toBe(true);
  expect(startsChatDay('2026-10-09T17:00:00', '2026-10-09T09:00:00')).toBe(false);
  expect(startsChatDay('2026-10-10T00:00:00', '2026-10-09T23:59:59')).toBe(true);
});

test('invalid timestamps do not crash or create labels', () => {
  expect(formatChatTime('invalid')).toBe('');
  expect(formatChatDate('invalid')).toBe('');
  expect(startsChatDay('invalid')).toBe(false);
});
