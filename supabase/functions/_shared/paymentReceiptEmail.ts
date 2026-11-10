// Checkout receipts are retired. Webhook paymentStatusEmail owns all payment emails.

export interface PaymentReceiptInput {
  paymentType: string;          // e.g. "Wallet Points", "Job Boost", "Company Verification", "AI Career Chat", "API Subscription", "Interview Booking", "Job Posting"
  planName?: string;            // e.g. "Pro Monthly", "500 Points"
  amountInr: number;            // paid amount in INR
  paymentId: string;            // razorpay payment id
  orderId?: string;             // razorpay order id (optional)
  extras?: Array<{ label: string; value: string }>; // e.g. points added, expiry date
  ctaUrl?: string;              // app URL to view purchase
  ctaLabel?: string;            // button label
  audience?: 'jobseeker' | 'employer'; // which side's mailbox sends this receipt
}

/**
 * Resolve a usable recipient email for a userId.
 * Priority: profiles.email → auth.users.email
 */
export async function resolveUserEmail(supabase: any, userId: string): Promise<{ email: string | null; name: string | null; phone: string | null }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, phone')
      .eq('user_id', userId)
      .maybeSingle();

    let email: string | null = profile?.email || null;
    const name: string | null = profile?.full_name || null;
    const phone: string | null = profile?.phone || null;

    if (!email) {
      try {
        const { data } = await supabase.auth.admin.getUserById(userId);
        email = data?.user?.email || null;
      } catch (_) { /* ignore */ }
    }
    return { email, name, phone };
  } catch (e) {
    console.warn('[paymentReceiptEmail] resolveUserEmail failed:', e);
    return { email: null, name: null, phone: null };
  }
}

/** Compatibility entry point for checkout callers; never sends a second receipt. */
export async function sendPaymentReceiptEmail(
  _supabase: any,
  _toEmail: string | null,
  _toName: string | null,
  _input: PaymentReceiptInput,
): Promise<boolean> {
  return false;
}
