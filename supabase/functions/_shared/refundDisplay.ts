type RefundEvent = { type: string; at: string | null };
type RefundTiming = { status?: string; processed_at?: string | number | null; events?: RefundEvent[] };

function timestamp(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = typeof value === 'number' ? value * 1000 : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Presentation estimate only; does not change the provider's actual refund status. */
export function refundDisplay(refund: RefundTiming, now = Date.now()) {
  const events = refund.events ?? [];
  const processedTimes = events.filter(event => event.type === 'refund.processed')
    .map(event => timestamp(event.at)).filter((at): at is number => at !== null);
  const processedAt = processedTimes.length ? Math.min(...processedTimes) : timestamp(refund.processed_at);
  // Count whole India calendar days: success from the start of the 7th day after processing.
  const IST = 5.5 * 60 * 60 * 1000, DAY = 24 * 60 * 60 * 1000;
  const expectedAt = processedAt === null ? null : Math.floor((processedAt + IST) / DAY) * DAY - IST + 7 * DAY;
  const failed = refund.status === 'failed' || events.some(event => event.type === 'refund.failed');
  const display_status = failed ? 'failed' : expectedAt !== null && now >= expectedAt ? 'successful' : 'in_progress';
  return {
    display_status,
    processed_at: processedAt === null ? null : new Date(processedAt).toISOString(),
    expected_by: expectedAt === null ? null : new Date(expectedAt).toISOString(),
  } as const;
}

type PaymentDestination = {
  method?: string | null;
  vpa?: string | null;
  bank_name?: string | null;
  card_network?: string | null;
  card_last4?: string | null;
  wallet?: string | null;
};

export function refundDestination(payment: PaymentDestination): string {
  const method = (payment.method ?? '').toLowerCase();
  if (method === 'upi') return payment.vpa ? `UPI · ${payment.vpa}` : 'Original UPI account';
  if (method === 'card' || method === 'emi') {
    const card = [payment.card_network || 'Card', payment.card_last4 ? `ending ${payment.card_last4}` : '', payment.bank_name].filter(Boolean).join(' · ');
    return card;
  }
  if (payment.bank_name) return `Bank · ${payment.bank_name}`;
  if (payment.wallet) return `Wallet · ${payment.wallet}`;
  return 'Original payment method';
}