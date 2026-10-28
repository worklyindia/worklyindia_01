// Shared payment notification helper.
// Sends a detailed in-app notification + push for every payment outcome
// (Razorpay or wallet-points): success, failed and cancelled.

export type PaymentStatus = 'success' | 'failed' | 'cancelled';

export interface PaymentNotifyInput {
  userId: string | null;
  /** Legacy flag — still supported. Prefer `status`. */
  success?: boolean;
  /** success | failed | cancelled. Falls back to `success` when omitted. */
  status?: PaymentStatus;
  /** What was bought, e.g. "500 Points Package", "Job Boost", "AI Chat Pro Plan" */
  itemName: string;
  /** Rupee amount for Razorpay payments */
  amountInr?: number | null;
  /** Points spent for wallet payments */
  pointsSpent?: number | null;
  /** Points credited (points purchase) */
  pointsAdded?: number | null;
  method: 'razorpay' | 'wallet';
  paymentId?: string | null;
  orderId?: string | null;
  /** Where the user lands when tapping the notification */
  actionUrl?: string;
  /** Reason shown when the payment did not succeed */
  failureReason?: string | null;
  transactionType?: 'purchase' | 'boost' | 'verification' | 'job_posting' | 'subscription' | 'donation' | 'other';
}

const formatInr = (amount?: number | null) =>
  typeof amount === 'number' && !Number.isNaN(amount)
    ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount)}`
    : null;

const formatDateTime = () =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

export function resolveStatus(input: PaymentNotifyInput): PaymentStatus {
  if (input.status) return input.status;
  return input.success ? 'success' : 'failed';
}

export function buildPaymentMessage(input: PaymentNotifyInput) {
  const status = resolveStatus(input);
  const lines: string[] = [];
  const amount = formatInr(input.amountInr);

  if (input.method === 'wallet' && input.pointsSpent) {
    lines.push(`${input.pointsSpent} points used`);
  } else if (amount) {
    lines.push(status === 'success' ? `${amount} paid` : `${amount}`);
  }

  lines.push(input.itemName);

  if (status === 'success') {
    if (input.pointsAdded) lines.push(`${input.pointsAdded} points added to your wallet`);
    if (input.paymentId) lines.push(`Payment ID: ${input.paymentId}`);
  } else if (input.failureReason) {
    lines.push(input.failureReason);
  }

  lines.push(formatDateTime());

  const base = lines.filter(Boolean).join(' • ');

  if (status === 'success') {
    return { title: '✅ Payment Successful', message: base };
  }

  if (status === 'cancelled') {
    return {
      title: '⚠️ Payment Cancelled',
      message: `${base} • You cancelled the payment. Nothing was charged — you can try again anytime.`,
    };
  }

  return {
    title: '❌ Payment Failed',
    message: `${base} • No amount will be deducted if it was not captured.`,
  };
}

/**
 * Best-effort: never throws, so a notification problem can never fail a payment.
 */
export async function notifyPayment(supabase: any, input: PaymentNotifyInput) {
  try {
    if (!input.userId) return;

    const status = resolveStatus(input);
    const { title, message } = buildPaymentMessage(input);
    const actionUrl = input.actionUrl || '/employer-portal';

    const metadata = {
      status,
      method: input.method,
      transaction_type: input.transactionType || 'purchase',
      item_name: input.itemName,
      amount: input.amountInr ?? null,
      points_spent: input.pointsSpent ?? null,
      points_added: input.pointsAdded ?? null,
      payment_id: input.paymentId ?? null,
      order_id: input.orderId ?? null,
      failure_reason: status === 'success' ? null : input.failureReason ?? null,
    };

    await supabase.from('notifications').insert({
      user_id: input.userId,
      title,
      message,
      type: 'payment',
      action_url: actionUrl,
      metadata,
    });

    // Pick the exact template for what happened.
    const tType = input.transactionType || 'purchase';
    let eventType = status === 'success' ? 'payment_success' : 'payment_failed';
    let audience: string | undefined;
    if (status === 'success') {
      if (tType === 'boost') {
        eventType = 'job_boost_activated'; audience = 'employer';
      } else if (tType === 'verification') {
        eventType = 'verification_badge_activated'; audience = 'employer';
      } else if (tType === 'subscription') {
        eventType = 'ai_plan_activated'; audience = 'employer';
      } else if (input.method === 'wallet') {
        // Points spent on another service: "Wallet points used" is sent by the ledger.
        return;
      }
    }

    await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        user_id: input.userId,
        title,
        message,
        action_url: actionUrl,
        button_text: status === 'success' ? 'View Receipt' : 'Try Again',
        skip_rephrase: true,
        // Lets Owner Portal → Push Templates control the wording, with the
        // real amount / points / order id filled into the placeholders.
        event_type: eventType,
        ...(audience ? { audience } : {}),
        variables: {
          amount: formatInr(input.amountInr) ?? '',
          points: input.pointsAdded ?? input.pointsSpent ?? '',
          order_id: input.paymentId || input.orderId || '',
          status,
          item: input.itemName,
          plan: input.itemName,
          job_title: input.itemName,
        },
        data: metadata,
      },
    });
  } catch (e) {
    console.error('[paymentNotify] failed:', e);
  }
}
