// Razorpay Invoice records for completed payments. One invoice per payment (payment_id unique,
// invoice_id unique), created server-side with the Razorpay secret; the browser only gets the
// hosted invoice URL, where Razorpay's own "Download Invoice" provides the official PDF.
import { resolvePayment } from './paymentStatusEmail.ts';

function creds() {
  const id = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!id || !secret) return null;
  return { auth: `Basic ${btoa(`${id}:${secret}`)}`, mode: id.startsWith('rzp_test_') ? 'test' : 'live' };
}

export async function rzpInvoiceApi(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const c = creds();
  if (!c) return { ok: false, status: 503, data: { error: { description: 'Razorpay keys not configured' } } };
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: c.auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function refundStatusOf(payment: any): string | null {
  const refunded = Number(payment?.amount_refunded || 0);
  if (!refunded) return null;
  return refunded >= Number(payment.amount) ? 'refunded' : 'partially_refunded';
}

/** Copy the latest Razorpay invoice fields onto our row. */
export function invoiceFields(inv: any) {
  return {
    invoice_id: inv.id,
    invoice_number: inv.invoice_number || inv.receipt || null,
    short_url: inv.short_url || null,
    status: inv.status || 'issued',
    customer_name: inv.customer_details?.name || null,
    customer_email: inv.customer_details?.email || null,
    amount: inv.amount ?? null,
    tax_amount: inv.tax_amount ?? 0,
    currency: inv.currency || 'INR',
    invoice_date: inv.issued_at ? new Date(inv.issued_at * 1000).toISOString() : new Date().toISOString(),
    last_error: null,
  };
}

/** Idempotently create the Razorpay invoice for a captured payment. Never throws. */
export async function ensureInvoiceForPayment(admin: any, payment: any, known?: { userId: string | null; label: string }) {
  try {
    if (!payment?.id || !['captured', 'refunded'].includes(payment.status)) return null;
    const { data: existing } = await admin.from('razorpay_invoices').select('*').eq('payment_id', payment.id).maybeSingle();
    if (existing?.invoice_id) return existing;
    const c = creds();
    if (!c) return null;
    const { userId, label } = known ?? await resolvePayment(admin, payment);
    if (!userId) return null;

    // Claim the payment first so parallel webhook/user calls cannot create two invoices.
    if (!existing) {
      const { error: claimErr } = await admin.from('razorpay_invoices').insert({
        user_id: userId, payment_id: payment.id, order_id: payment.order_id || null, mode: c.mode,
        payment_status: payment.status, refund_status: refundStatusOf(payment),
      });
      if (claimErr) return null; // someone else claimed it
    } else if (existing.status === 'creating' && Date.now() - new Date(existing.updated_at).getTime() < 60_000) {
      return null; // creation already in progress
    }

    const { data: prof } = await admin.from('profiles').select('full_name,email').eq('user_id', userId).maybeSingle();
    const email = prof?.email || (payment.email && !String(payment.email).endsWith('@razorpay.com') ? payment.email : undefined);
    const res = await rzpInvoiceApi('/invoices', {
      type: 'invoice',
      description: label,
      receipt: payment.id.slice(0, 40),
      customer: { name: prof?.full_name || 'Customer', email, contact: payment.contact || undefined },
      line_items: [{ name: label, amount: Number(payment.amount), currency: payment.currency || 'INR', quantity: 1 }],
      sms_notify: 0, email_notify: 0, currency: payment.currency || 'INR',
      notes: { payment_id: payment.id, order_id: payment.order_id || '', user_id: userId },
    });
    if (!res.ok || !res.data?.id) {
      const msg = res.data?.error?.description || `Razorpay error ${res.status}`;
      await admin.from('razorpay_invoices').update({ status: 'error', last_error: msg }).eq('payment_id', payment.id);
      console.error('[razorpayInvoice] create failed', res.status, msg);
      return null;
    }
    const { data: row } = await admin.from('razorpay_invoices')
      .update({ ...invoiceFields(res.data), payment_status: payment.status, refund_status: refundStatusOf(payment) })
      .eq('payment_id', payment.id).select('*').maybeSingle();
    return row;
  } catch (e) {
    console.error('[razorpayInvoice] ensure failed (non-blocking):', e);
    return null;
  }
}

/** Webhook: invoice.paid / invoice.partially_paid / invoice.expired, keyed by invoice_id (idempotent). */
export async function applyInvoiceWebhook(admin: any, type: string, invoice: any, payment?: any) {
  if (!invoice?.id) return;
  const status = type === 'invoice.paid' ? 'paid' : type === 'invoice.partially_paid' ? 'partially_paid' : type === 'invoice.expired' ? 'expired' : invoice.status;
  const patch: Record<string, unknown> = { ...invoiceFields(invoice), status };
  if (payment?.id) { patch.payment_status = payment.status; patch.refund_status = refundStatusOf(payment); }
  await admin.from('razorpay_invoices').update(patch).eq('invoice_id', invoice.id);
}

/** Webhook: keep payment/refund status on the invoice row in sync. */
export async function applyPaymentToInvoice(admin: any, payment: any) {
  if (!payment?.id) return;
  await admin.from('razorpay_invoices').update({ payment_status: payment.status, refund_status: refundStatusOf(payment) }).eq('payment_id', payment.id);
}
