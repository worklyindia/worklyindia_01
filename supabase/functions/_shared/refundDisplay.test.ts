import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { refundDisplay, refundDestination } from './refundDisplay.ts';

const events = [{ type: 'refund.processed', at: '2026-10-09T03:34:00Z' }];

Deno.test('refund processed 06 Oct (IST) shows success on 13 Oct (IST), not before', () => {
  const oct6 = [{ type: 'refund.processed', at: '2026-10-06T12:32:00Z' }]; // 06 Oct 6:02 pm IST
  assertEquals(refundDisplay({ status: 'processed', events: oct6 }, Date.parse('2026-10-12T18:29:59Z')).display_status, 'in_progress');
  assertEquals(refundDisplay({ status: 'processed', events: oct6 }, Date.parse('2026-10-13T07:37:00Z')).display_status, 'successful');
});

Deno.test('processing date, not refund creation or provider status alone, starts the clock', () => {
  assertEquals(refundDisplay({ status: 'processed' }, Date.parse('2026-10-20T00:00:00Z')).display_status, 'in_progress');
  assertEquals(refundDisplay({ status: 'processed', events }, Date.parse('2026-10-13T06:19:00Z')).display_status, 'in_progress');
});

Deno.test('provider processed timestamp can recover missing processed webhooks', () => {
  assertEquals(refundDisplay({ status: 'processed', processed_at: Date.parse('2026-10-09T03:34:00Z') / 1000 }, Date.parse('2026-10-15T18:30:00Z')).display_status, 'successful');
});

Deno.test('failed refunds never become successful after seven days', () => {
  assertEquals(refundDisplay({ status: 'failed', events }, Date.parse('2026-10-20T00:00:00Z')).display_status, 'failed');
});

Deno.test('refund destination uses the original UPI, bank or masked card only', () => {
  assertEquals(refundDestination({ method: 'upi', vpa: 'payer@upi' }), 'UPI · payer@upi');
  assertEquals(refundDestination({ method: 'netbanking', bank_name: 'HDFC' }), 'Bank · HDFC');
  assertEquals(refundDestination({ method: 'card', card_network: 'Visa', card_last4: '1234' }), 'Visa · ending 1234');
  assertEquals(refundDestination({ method: 'upi' }), 'Original UPI account');
});