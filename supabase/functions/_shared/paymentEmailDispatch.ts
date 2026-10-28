// Signed Razorpay events only. Optional bank/workbook fields never gate status mail.
export type PaymentEmailKind = 'success' | 'failed' | 'refund';

export function paymentEmailKind(eventType: string): PaymentEmailKind | null {
  if (['payment.captured', 'order.paid', 'payment_link.paid', 'qr_code.credited'].includes(eventType)) return 'success';
  if (eventType === 'payment.failed') return 'failed';
  if (['refund.processed', 'refund.failed'].includes(eventType)) return 'refund';
  return null;
}

export function hasPaymentEmailCore(payment: any): boolean {
  return typeof payment?.id === 'string' && payment.id.startsWith('pay_') && Number.isFinite(Number(payment.amount)) && Number(payment.amount) > 0;
}

export async function dispatchPaymentEmail(
  event: any,
  loadPayment: (id: string) => Promise<any>,
  send: (kind: PaymentEmailKind, payment: any, refund?: any) => Promise<void>,
): Promise<void> {
  const kind = paymentEmailKind(String(event?.event || ''));
  if (!kind) return;
  const refund = event?.payload?.refund?.entity;
  let payment = event?.payload?.payment?.entity;
  if (kind === 'refund' && !hasPaymentEmailCore(payment)) {
    const id = refund?.payment_id;
    if (typeof id !== 'string' || !/^pay_[a-zA-Z0-9]+$/.test(id)) throw new Error('Refund event has no valid payment ID');
    payment = await loadPayment(id);
    if (payment?.id !== id) throw new Error('Refund payment lookup returned a different payment');
  }
  if (!hasPaymentEmailCore(payment)) throw new Error('Payment email requires a payment ID and positive amount');
  await send(kind, payment, refund);
}