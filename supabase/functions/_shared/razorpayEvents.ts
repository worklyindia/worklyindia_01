// Shared helpers to classify and persist every Razorpay webhook event.

export const RAZORPAY_EVENT_CATEGORIES: Record<string, string[]> = {
  payment: [
    'payment.authorized',
    'payment.failed',
    'payment.captured',
    'payment.dispute.created',
    'payment.dispute.won',
    'payment.dispute.lost',
    'payment.dispute.closed',
    'payment.dispute.under_review',
    'payment.dispute.action_required',
    'payment.downtime.started',
    'payment.downtime.updated',
    'payment.downtime.resolved',
  ],
  order: ['order.paid', 'order.notification.delivered', 'order.notification.failed'],
  invoice: ['invoice.paid', 'invoice.partially_paid', 'invoice.expired'],
  subscription: [
    'subscription.authenticated',
    'subscription.paused',
    'subscription.resumed',
    'subscription.activated',
    'subscription.pending',
    'subscription.halted',
    'subscription.charged',
  ],
  settlement: ['settlement.processed'],
  qr_code: ['qr_code.closed', 'qr_code.created', 'qr_code.credited'],
  fund_account: ['fund_account.validation.completed', 'fund_account.validation.failed'],
  refund: ['refund.speed_changed', 'refund.processed', 'refund.failed', 'refund.created'],
  account: ['account.instantly_activated', 'account.activated_kyc_pending'],
  payment_link: [
    'payment_link.paid',
    'payment_link.partially_paid',
    'payment_link.expired',
    'payment_link.cancelled',
  ],
  engage: [
    'engage.rewards.disabled',
    'engage.rewards.enabled',
    'engage.rewards.denomination_disabled',
    'engage.rewards.denomination_enabled',
    'engage.rewards.denomination_updated',
    'engage.rewards.discount_updated',
    'engage.rewards.termsandconditions_updated',
    'engage.rewards.instructions_updated',
    'engage.inventory.low_stock',
    'engage.balance.low_balance',
  ],
};

const TYPE_TO_CATEGORY: Record<string, string> = Object.entries(RAZORPAY_EVENT_CATEGORIES)
  .reduce((acc, [category, types]) => {
    for (const t of types) acc[t] = category;
    return acc;
  }, {} as Record<string, string>);

export function categorizeRazorpayEvent(type: string): string {
  if (!type) return 'other';
  if (TYPE_TO_CATEGORY[type]) return TYPE_TO_CATEGORY[type];
  const prefix = type.split('.')[0];
  return RAZORPAY_EVENT_CATEGORIES[prefix] ? prefix : (prefix || 'other');
}

// Entity keys Razorpay may send inside payload, in priority order
const ENTITY_KEYS = [
  'payment',
  'order',
  'refund',
  'dispute',
  'invoice',
  'subscription',
  'settlement',
  'qr_code',
  'fund_account',
  'payment_link',
  'account',
  'payment_downtime',
  'transfer',
  'virtual_account',
];

export interface ExtractedEvent {
  event_id: string | null;
  event_type: string;
  category: string;
  account_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  error_code: string | null;
  error_description: string | null;
  notes: Record<string, unknown> | null;
  payload: unknown;
  signature_verified: boolean;
  event_created_at: string | null;
}

export function extractRazorpayEvent(
  event: any,
  opts: { eventId?: string | null; signatureVerified?: boolean } = {},
): ExtractedEvent {
  const type: string = event?.event || 'unknown';
  const payload = event?.payload ?? {};

  let entityType: string | null = null;
  let entity: any = null;
  for (const key of ENTITY_KEYS) {
    if (payload?.[key]?.entity) {
      entityType = key;
      entity = payload[key].entity;
      break;
    }
  }
  if (!entity) {
    const firstKey = Object.keys(payload)[0];
    if (firstKey) {
      entityType = firstKey;
      entity = payload[firstKey]?.entity ?? payload[firstKey] ?? null;
    }
  }

  const amount = typeof entity?.amount === 'number' ? entity.amount : null;

  return {
    event_id: opts.eventId ?? null,
    event_type: type,
    category: categorizeRazorpayEvent(type),
    account_id: event?.account_id ?? null,
    entity_type: entityType,
    entity_id: entity?.id ?? null,
    amount_paise: amount,
    currency: entity?.currency ?? null,
    status: entity?.status ?? null,
    contact: entity?.contact ?? entity?.customer_details?.contact ?? null,
    email: entity?.email ?? entity?.customer_details?.email ?? null,
    error_code: entity?.error_code ?? null,
    error_description: entity?.error_description ?? entity?.error_reason ?? null,
    notes: entity?.notes ?? null,
    payload: event,
    signature_verified: opts.signatureVerified ?? false,
    event_created_at: event?.created_at ? new Date(event.created_at * 1000).toISOString() : null,
  };
}

/** Best-effort persistence: never throws, never blocks webhook processing. */
export async function recordRazorpayEvent(
  supabase: any,
  event: any,
  opts: { eventId?: string | null; signatureVerified?: boolean } = {},
): Promise<void> {
  try {
    const row = extractRazorpayEvent(event, opts);
    const { error } = await supabase
      .from('razorpay_events')
      .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) console.error('recordRazorpayEvent failed', error.message);
  } catch (e) {
    console.error('recordRazorpayEvent exception', e);
  }
}
