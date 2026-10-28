import { describe, expect, test } from 'bun:test';
import { dispatchPaymentEmail, hasPaymentEmailCore, paymentEmailKind } from './paymentEmailDispatch.ts';

describe('webhook-driven payment status emails', () => {
  test('success does not require transaction ID or RRN', async () => {
    const sent: string[] = [];
    await dispatchPaymentEmail({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123', amount: 10000 } } } }, async () => null, async (kind) => { sent.push(kind); });
    expect(sent).toEqual(['success']);
  });
  test('failed payment sends even without bank error details or order ID', async () => {
    const sent: string[] = [];
    await dispatchPaymentEmail({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_456', amount: 10000 } } } }, async () => null, async (kind) => { sent.push(kind); });
    expect(sent).toEqual(['failed']);
  });
  test('refund-only payload fetches its parent and sends refund email', async () => {
    const sent: unknown[] = [];
    const refund = { id: 'rfnd_1', payment_id: 'pay_789', amount: 5000, status: 'processed' };
    await dispatchPaymentEmail({ event: 'refund.processed', payload: { refund: { entity: refund } } }, async (id) => ({ id, amount: 10000 }), async (kind, payment, detail) => { sent.push([kind, payment.id, detail.id]); });
    expect(sent).toEqual([['refund', 'pay_789', 'rfnd_1']]);
  });
  test('QR and payment-link success events are not skipped by early returns', () => {
    expect(paymentEmailKind('qr_code.credited')).toBe('success');
    expect(paymentEmailKind('payment_link.paid')).toBe('success');
    expect(paymentEmailKind('payment.authorized')).toBeNull();
  });
  test('incomplete payment is not invented', () => {
    expect(hasPaymentEmailCore({ id: 'pay_1', amount: 0 })).toBe(false);
  });
  test('refund hydration failure is surfaced', async () => {
    await expect(dispatchPaymentEmail({ event: 'refund.failed', payload: { refund: { entity: { payment_id: 'pay_1' } } } }, async () => { throw new Error('Razorpay unavailable'); }, async () => {})).rejects.toThrow('Razorpay unavailable');
  });
});