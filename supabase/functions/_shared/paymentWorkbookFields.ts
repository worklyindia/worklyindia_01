// Shared Razorpay "workbook" fields shown in the Payment Details sheet, PDF and payment emails.
// Every value is null when Razorpay did not send it, so callers hide that row instead of showing a blank.

const clean = (v: unknown): string | null => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s ? s : null;
};

function notesComment(notes: any): string | null {
  if (!notes || typeof notes !== 'object') return null;
  if (clean(notes.comment)) return clean(notes.comment);
  const vals = Object.values(notes).map(clean).filter(Boolean);
  return vals.length ? vals.join(' · ') : null;
}

export interface PaymentWorkbookFields {
  transaction_id: string | null;
  customer_id: string | null;
  currency: string | null;
  description: string | null;
  rrn: string | null;
}

export function paymentWorkbookFields(p: any): PaymentWorkbookFields {
  const a = p?.acquirer_data || {};
  return {
    transaction_id: clean(a.upi_transaction_id || a.bank_transaction_id || a.transaction_id || a.auth_code || a.arn),
    customer_id: clean(p?.customer_id),
    currency: clean(p?.currency),
    description: clean(p?.description),
    rrn: clean(a.rrn || a.upi_transaction_id),
  };
}

export function refundWorkbookFields(r: any) {
  const a = r?.acquirer_data || {};
  return {
    currency: clean(r?.currency),
    comment: notesComment(r?.notes),
    description: clean(r?.description),
    customer_id: clean(r?.customer_id),
    upi_transaction_id: clean(a.upi_transaction_id || a.rrn || a.arn),
  };
}

/** Subscription linked to a payment (api_subscriptions), when any. */
export async function subscriptionIdForPayment(supabase: any, paymentId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_subscriptions').select('subscription_id').eq('payment_id', paymentId).limit(1).maybeSingle();
    return clean(data?.subscription_id)?.startsWith('sub_') ? data.subscription_id : null;
  } catch { return null; }
}

/** Latest stored webhook event id for a payment, when any. */
export async function eventIdForPayment(supabase: any, paymentId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('razorpay_events').select('event_id').eq('entity_id', paymentId)
      .order('event_created_at', { ascending: false }).limit(1).maybeSingle();
    return clean(data?.event_id);
  } catch { return null; }
}
