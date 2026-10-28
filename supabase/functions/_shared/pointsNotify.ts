// Shared points-wallet notification helper.
// Every points ledger movement (credit or debit) gets an in-app notification + push.

export interface PointsNotifyInput {
  userId: string | null;
  /** Positive = credit, negative = debit. */
  pointsAmount: number;
  balanceAfter?: number | null;
  description?: string | null;
  transactionType?: string | null;
  transactionId?: string | null;
  actionUrl?: string;
}

const formatDateTime = () =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

const formatPoints = (value: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(value));

export function buildPointsMessage(input: PointsNotifyInput) {
  const isCredit = input.pointsAmount > 0;
  const points = formatPoints(input.pointsAmount);

  const lines: string[] = [
    isCredit ? `+${points} points added` : `-${points} points used`,
  ];

  if (input.description) lines.push(input.description);
  if (typeof input.balanceAfter === 'number' && !Number.isNaN(input.balanceAfter)) {
    lines.push(`Balance: ${formatPoints(input.balanceAfter)} points`);
  }
  lines.push(formatDateTime());

  return {
    title: isCredit ? '🪙 Points Credited' : '🔻 Points Debited',
    message: lines.filter(Boolean).join(' • '),
  };
}

/**
 * Best-effort: never throws, so a notification problem can never break a points update.
 */
export async function notifyPoints(supabase: any, input: PointsNotifyInput) {
  try {
    if (!input.userId || !input.pointsAmount) return { skipped: true, reason: 'no_user_or_zero' };

    const isCredit = input.pointsAmount > 0;
    const { title, message } = buildPointsMessage(input);
    const actionUrl = input.actionUrl || '/wallet-history';

    const metadata = {
      status: isCredit ? 'credit' : 'debit',
      points_amount: input.pointsAmount,
      balance_after: input.balanceAfter ?? null,
      transaction_type: input.transactionType ?? null,
      transaction_id: input.transactionId ?? null,
      description: input.description ?? null,
    };

    await supabase.from('notifications').insert({
      user_id: input.userId,
      title,
      message,
      type: 'points',
      action_url: actionUrl,
      metadata,
    });

    // Credits: only a Razorpay points purchase uses "Wallet points added" (that
    // receipt is sent by the payment flow). Refunds / other credits stay in-app.
    // Debits: every service bought with points sends "Wallet points used".
    if (isCredit) return { skipped: false, reason: 'credit_in_app_only' };

    await supabase.functions.invoke('email-api', {
      body: {
        action: 'send_push',
        audience: 'employer',
        user_id: input.userId,
        title,
        message,
        action_url: actionUrl,
        button_text: 'View Wallet',
        skip_rephrase: true,
        // Owner Portal → Push Templates ("wallet_credit") controls the wording;
        // the real points / balance are filled into its placeholders.
        event_type: 'wallet_points_debited',
        variables: {
          points: Math.abs(input.pointsAmount) ?? '',
          balance: input.balanceAfter ?? '',
          status: 'debit',
          item: input.description ?? '',
          amount: Math.abs(input.pointsAmount) ?? '',
          order_id: input.transactionId ?? '',
        },
        data: metadata,
      },
    });

    return { skipped: false };
  } catch (e) {
    console.error('[pointsNotify] failed:', e);
    return { skipped: true, reason: 'error' };
  }
}
