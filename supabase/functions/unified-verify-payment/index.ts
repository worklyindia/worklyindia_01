import { istStampParts } from '../_shared/emailFormat.ts';
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveUserEmail, sendPaymentReceiptEmail } from "../_shared/paymentReceiptEmail.ts";
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';
import { notifyPayment } from '../_shared/paymentNotify.ts';
import { notifyEvent } from '../_shared/eventNotify.ts';
import { fulfillJobPayment } from '../_shared/jobPayments.ts';
import { ensureInvoiceForPayment, invoiceFields, rzpInvoiceApi, applyPaymentToInvoice } from '../_shared/razorpayInvoice.ts';
import { resolvePayment } from '../_shared/paymentStatusEmail.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { refundDisplay } from '../_shared/refundDisplay.ts';

// Timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Generate HMAC signature
async function generateSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const clientIP = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    
    const { action, ...params } = await req.json();
    const isInvoice = action === 'employee-invoice' || action === 'owner-invoice';
    const bucket = isInvoice ? `invoice_${clientIP}` : `verify_${clientIP}`;
    if (!checkRateLimit(bucket, isInvoice ? 30 : 5, 60000)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[unified-verify-payment] Action: ${action}`);

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    switch (action) {
      case 'owner-wallet-balance':
        return await handleOwnerWalletBalance(supabaseService, req);
      case 'owner-invoice':
        return await handleOwnerInvoice(supabaseService, req, params);
      case 'owner-refund-payment':
        return await handleOwnerRefund(supabaseService, req, params);
      case 'employee-payment-history':
        return await handleEmployeePaymentHistory(supabaseService, req, params);
      case 'employee-invoice':
        return await handleEmployeeInvoice(supabaseService, req, params);
      case 'verify-boost':
        return await handleVerifyBoost(supabaseService, params, req);
      
      case 'verify-verification':
        return await handleVerifyVerification(supabaseService, params, req);
      
      case 'verify-donation':
        return await handleVerifyDonation(supabaseService, params);

      case 'verify-job-payment':
        return await handleVerifyJobPayment(supabaseService, params, req);

      case 'verify-job-indexing':
        return await handleVerifyJobIndexing(supabaseService, params, req);

      default:
        return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }



  } catch (error) {
    console.error('[unified-verify-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Payment verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Owner/admin wallet ledger: captured payments minus refunds and processed settlements.
async function handleOwnerWalletBalance(supabase: any, req: Request) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Please sign in again.' }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return json({ error: 'Please sign in again.' }, 401);
  const { data: admin, error: roleError } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError || !['owner', 'admin'].includes(admin?.role || '')) return json({ error: 'Only admins can view the wallet balance.' }, 403);

  const captured = new Map<string, number>();
  const refunds = new Map<string, number>();
  const settlements = new Map<string, number>();
  const disputes = new Map<string, number>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('razorpay_events')
      .select('id,event_id,event_type,entity_id,amount_paise,payload')
      .in('event_type', ['payment.captured', 'refund.created', 'refund.processed', 'settlement.processed', 'payment.dispute.created', 'payment.dispute.lost', 'payment.dispute.won', 'payment.dispute.closed'])
      .order('created_at', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) return json({ error: 'Could not calculate the wallet balance.' }, 500);
    for (const row of data ?? []) {
      const payload = row.payload?.payload ?? row.payload ?? {};
      if (row.event_type === 'payment.captured') {
        const entity = payload?.payment?.entity;
        const id = String(entity?.id || row.entity_id || row.event_id || row.id);
        captured.set(id, Math.max(captured.get(id) || 0, Number(row.amount_paise ?? entity?.amount ?? 0)));
      } else if (row.event_type.startsWith('refund.')) {
        const entity = payload?.refund?.entity;
        if (entity?.status === 'failed') continue;
        const id = String(entity?.id || row.entity_id || row.event_id || row.id);
        refunds.set(id, Math.max(refunds.get(id) || 0, Number(row.amount_paise ?? entity?.amount ?? 0)));
      } else if (row.event_type.startsWith('payment.dispute.')) {
        // Disputes move money out of the balance when created/lost, and back in when won/closed.
        const entity = payload?.dispute?.entity;
        const id = String(entity?.id || row.entity_id || row.event_id || row.id);
        const amount = Number(row.amount_paise ?? entity?.amount ?? 0);
        if (row.event_type === 'payment.dispute.won' || row.event_type === 'payment.dispute.closed') {
          disputes.set(id, Math.max(disputes.get(id) || 0, -amount));
        } else {
          disputes.set(id, Math.max(disputes.get(id) || 0, amount));
        }
      } else {
        const entity = payload?.settlement?.entity;
        const id = String(entity?.id || row.entity_id || row.event_id || row.id);
        settlements.set(id, Math.max(settlements.get(id) || 0, Number(row.amount_paise ?? entity?.amount ?? 0)));
      }
    }
    if ((data?.length || 0) < pageSize) break;
  }
  const sum = (values: Map<string, number>) => Array.from(values.values()).reduce((total, amount) => total + amount, 0);
  const capturedPaise = sum(captured);
  const refundedPaise = sum(refunds);
  const settledPaise = sum(settlements);
  const disputedPaise = sum(disputes);
  return json({ balance_paise: capturedPaise - refundedPaise - settledPaise - disputedPaise, captured_paise: capturedPaise, refunded_paise: refundedPaise, settled_paise: settledPaise, disputed_paise: disputedPaise, currency: 'INR' });
}

// Read-only owner access: keep invoice tables private without creating another invoice.
async function handleOwnerInvoice(supabase: any, req: Request, params: any) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Please sign in again.' }, 401);
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return json({ error: 'Please sign in again.' }, 401);
  const { data: admin, error: roleError } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError || !['owner', 'admin'].includes(admin?.role || '')) return json({ error: 'Only admins can view these invoices.' }, 403);
  const paymentId = String(params?.payment_id || '');
  let invoiceId = String(params?.invoice_id || '');
  if ((paymentId && !/^pay_[A-Za-z0-9]{6,30}$/.test(paymentId)) || (invoiceId && !/^inv_[A-Za-z0-9]{6,30}$/.test(invoiceId)) || (!paymentId && !invoiceId)) return json({ error: 'Invalid invoice reference.' }, 400);
  let query = supabase.from('razorpay_invoices').select('invoice_id,short_url,status');
  query = invoiceId ? query.eq('invoice_id', invoiceId) : query.eq('payment_id', paymentId);
  const { data: row, error: readError } = await query.maybeSingle();
  if (readError) return json({ error: 'Could not load invoice.' }, 500);
  invoiceId = invoiceId || row?.invoice_id || '';
  if (!invoiceId && paymentId) {
    const payment = await rzpInvoiceApi(`/payments/${paymentId}`);
    if (!payment.ok) return json({ error: payment.status === 503 ? 'Razorpay invoice access is not configured.' : 'Could not retrieve the payment from Razorpay.' }, 502);
    invoiceId = payment.data?.invoice_id || '';
  }
  if (invoiceId) {
    if (!/^inv_[A-Za-z0-9]{6,30}$/.test(invoiceId)) return json({ error: 'Invalid invoice reference.' }, 400);
    const result = await rzpInvoiceApi(`/invoices/${invoiceId}`);
    if (!result.ok) return json({ error: result.status === 404 ? 'This invoice is no longer available on Razorpay.' : 'Could not retrieve the invoice from Razorpay.' }, result.status === 404 ? 404 : 502);
    const invoice = result.data;
    const available = invoice?.short_url && !['cancelled', 'deleted', 'expired', 'draft'].includes(invoice.status);
    return json({ download_url: available ? invoice.short_url : null, reason: available ? null : 'Razorpay invoice is not available for this event yet.' });
  }
  const usable = row?.short_url && !['cancelled', 'deleted', 'expired', 'draft'].includes(row.status);
  return json({ download_url: usable ? row.short_url : null, reason: usable ? null : 'Razorpay invoice is not available for this event yet.' });
}

// Razorpay invoice for one of the signed-in user's payments. Creates it on demand (idempotent),
// refreshes status from Razorpay, and returns only display fields plus the hosted invoice URL.
async function handleEmployeeInvoice(supabase: any, req: Request, params: any) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return json({ error: 'Please sign in again.' }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Please sign in again.' }, 401);
  const paymentId = String(params?.payment_id || '');
  if (!/^pay_[A-Za-z0-9]{6,30}$/.test(paymentId)) return json({ error: 'Invalid payment.' }, 400);

  let { data: row } = await supabase.from('razorpay_invoices').select('*').eq('payment_id', paymentId).maybeSingle();
  if (row && row.user_id !== user.id) return json({ error: 'Invoice not available.' }, 404);

  if (!row?.invoice_id) {
    const p = await rzpInvoiceApi(`/payments/${paymentId}`);
    if (!p.ok) return json({ error: p.status === 503 ? 'Invoices are not available right now.' : 'Could not reach Razorpay. Please try again.' }, 502);
    const owner = await resolvePayment(supabase, p.data);
    if (owner.userId !== user.id) return json({ error: 'Invoice not available.' }, 404);
    if (!['captured', 'refunded'].includes(p.data.status)) return json({ invoice: null, reason: 'Invoices are issued only for successful payments.' });
    row = await ensureInvoiceForPayment(supabase, p.data, owner);
    if (!row?.invoice_id) {
      const { data: failed } = await supabase.from('razorpay_invoices').select('status,last_error').eq('payment_id', paymentId).maybeSingle();
      return json({ invoice: null, reason: failed?.status === 'creating' ? 'Your invoice is being prepared. Please try again in a minute.' : 'Razorpay could not create the invoice. Please try again later.' });
    }
  } else {
    const inv = await rzpInvoiceApi(`/invoices/${row.invoice_id}`);
    if (inv.ok && inv.data?.id) {
      const { data: fresh } = await supabase.from('razorpay_invoices').update(invoiceFields(inv.data)).eq('id', row.id).select('*').maybeSingle();
      if (fresh) row = fresh;
    }
  }

  const usable = !!row.short_url && !['cancelled', 'deleted', 'expired', 'draft'].includes(row.status);
  return json({ invoice: {
    invoice_number: row.invoice_number, invoice_id: row.invoice_id, payment_id: row.payment_id, order_id: row.order_id,
    customer_name: row.customer_name, customer_email: row.customer_email,
    amount: row.amount != null ? Number(row.amount) / 100 : null, tax_amount: Number(row.tax_amount || 0) / 100,
    currency: row.currency, invoice_date: row.invoice_date, status: row.status,
    payment_status: row.payment_status, refund_status: row.refund_status, mode: row.mode,
    download_url: usable ? row.short_url : null,
  }, reason: usable ? null : row.status === 'expired' ? 'This invoice has expired.' : 'The invoice document is not available yet.' });
}

// Owner/admin: issue a refund through Razorpay from the owner portal.
// Razorpay rules enforced here (never from the browser): only captured payments,
// never above the remaining (amount - amount_refunded), and never older than 30 days.
async function handleOwnerRefund(supabase: any, req: Request, params: any) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Please sign in again.' }, 401);
  const { data: { user }, error: uErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (uErr || !user) return json({ error: 'Please sign in again.' }, 401);

  const { data: adminRow } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (!['owner', 'admin'].includes(adminRow?.role || '')) {
    return json({ error: 'Only admins can issue refunds.' }, 403);
  }

  const paymentId = String(params?.payment_id || '');
  if (!/^pay_[A-Za-z0-9]{6,30}$/.test(paymentId)) return json({ error: 'Invalid payment.' }, 400);
  const speed = params?.speed === 'optimum' ? 'optimum' : 'normal';
  const reason = String(params?.reason || '').slice(0, 250) || undefined;

  // Read the payment's current state straight from Razorpay.
  const p = await rzpInvoiceApi(`/payments/${paymentId}`);
  if (!p.ok) return json({ error: 'Could not reach Razorpay. Please try again.' }, 502);
  const payment = p.data;
  if (payment?.error?.description) return json({ error: payment.error.description }, 400);
  if (payment?.status !== 'captured') {
    return json({ error: `Only captured payments can be refunded (this one is ${payment?.status || 'unknown'}).` }, 400);
  }

  const createdMs = Number(payment.created_at) * 1000;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  if (!createdMs || Date.now() - createdMs > THIRTY_DAYS_MS) {
    return json({ error: 'Refunds are only possible within 30 days of the payment.' }, 400);
  }

  const total = Number(payment.amount || 0);
  const alreadyRefunded = Number(payment.amount_refunded || 0);
  const remaining = Math.max(0, total - alreadyRefunded);
  if (remaining <= 0) return json({ error: 'This payment is already fully refunded.' }, 400);

  const requested = Number(params?.amount_inr);
  if (!Number.isFinite(requested) || requested <= 0) return json({ error: 'Enter a refund amount.' }, 400);
  const amountPaise = Math.round(requested * 100);
  if (amountPaise > remaining) {
    return json({ error: `Only ₹${(remaining / 100).toFixed(2)} is still refundable on this payment.` }, 400);
  }

  const res = await rzpInvoiceApi(`/payments/${paymentId}/refund`, {
    amount: amountPaise,
    speed,
    ...(reason ? { notes: { comment: reason, reason, refunded_by: user.email || 'owner' } } : {}),
  });
  if (!res.ok || !res.data?.id) {
    const msg = res.data?.error?.description || `Razorpay error ${res.status}`;
    console.error('[owner-refund] Razorpay refund failed:', res.status, msg);
    return json({ error: msg }, 502);
  }

  const newRefunded = alreadyRefunded + amountPaise;
  const fullyRefunded = newRefunded >= total;

  // Keep our invoice status in sync; the refund webhook updates everything else.
  await applyPaymentToInvoice(supabase, {
    ...payment,
    amount_refunded: newRefunded,
    status: fullyRefunded ? 'refunded' : payment.status,
  }).catch(() => {});

  return json({
    success: true,
    refund: { id: res.data.id, amount: amountPaise / 100, status: res.data.status, speed: res.data.speed || speed },
    payment: { id: paymentId, status: fullyRefunded ? 'refunded' : payment.status, amount_refunded: newRefunded },
  });
}

// Refund comment is what the owner typed; staff identity notes are never shown as the comment.
function refundNoteComment(notes: any): string {
  for (const k of ['comment', 'reason']) if (typeof notes?.[k] === 'string' && notes[k].trim()) return notes[k].trim();
  return '';
}

// Read payment attempts from Razorpay, never infer a success or failure from a local order.
/** Maps a webhook-verified paypal_payments row to the shared history shape (INR amounts). */
function paypalHistoryRow(r: any) {
  const usd = Number(r.amount_usd || 0), inr = Number(r.amount_inr || 0);
  const toInr = (v: number) => usd > 0 ? Math.round((inr * v / usd) * 100) / 100 : 0;
  const refunds = (Array.isArray(r.refunds) ? r.refunds : []).map((rf: any) => {
    const events = [{ type: 'refund.created', at: rf.created_at, speed: null },
      ...(rf.status === 'processed' ? [{ type: 'refund.processed', at: rf.processed_at || rf.created_at, speed: null }] : []),
      ...(rf.status === 'failed' ? [{ type: 'refund.failed', at: rf.processed_at || rf.created_at, speed: null }] : [])];
    return { id: rf.id, amount: toInr(Number(rf.amount_usd || 0)), status: rf.status, speed: null, created_at: rf.created_at,
      ...refundDisplay({ status: rf.status, processed_at: rf.processed_at, events }), events,
      currency: 'INR', comment: rf.note || null, description: rf.reversal ? 'PayPal reversal' : 'PayPal refund',
      customer_id: r.payer_id || null, upi_transaction_id: null, amount_usd: Number(rf.amount_usd || 0) };
  });
  return {
    id: r.capture_id || r.paypal_order_id, order_id: r.rzp_order_id, label: r.label, provider: 'paypal',
    amount: inr, refunded_amount: toInr(Number(r.refunded_usd || 0)), status: r.status,
    created_at: r.captured_at || r.created_at, currency: 'INR', description: 'Paid via PayPal',
    customer_id: r.payer_id || null, transaction_id: r.capture_id || null, rrn: null, method: 'paypal', wallet: 'PayPal',
    email: r.payer_email || null, contact: null, payer_name: r.payer_name || null,
    paypal_order_id: r.paypal_order_id, paypal_capture_id: r.capture_id || null, amount_usd: usd,
    event_id: r.last_event_id || null, webhook_verified: !!r.webhook_verified,
    error_description: r.error_description || null, refunds,
  };
}

async function handleEmployeePaymentHistory(supabase: any, req: Request, params: any) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return json({ error: 'Sign in required' }, 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Invalid session' }, 401);

  const days = [1, 7, 30].includes(Number(params?.days)) ? Number(params.days) : 30;
  const offset = Math.max(0, Number(params?.offset) || 0);
  const limit = Math.min(50, Math.max(1, Number(params?.limit) || 20));
  const now = new Date();
  const start = new Date(now);
  if (days === 1) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    start.setTime(new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00+05:30`).getTime());
  }
  else {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    start.setTime(new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00+05:30`).getTime() - (days - 1) * 86400000); // today + previous days-1 (IST)
  }

  const sources = [
    { table: 'transactions', amount: 'amount', details: [], label: () => 'Previous Service Purchase' },
    { table: 'pending_payments', amount: 'amount_inr', details: ['purpose'], label: (row: any) => paymentPurposeLabel(row.purpose) },
    { table: 'job_boosts', amount: 'amount_paid', details: [], label: () => 'Job Visibility Plan' },
    { table: 'verification_purchases', amount: 'amount_paid', details: [], label: () => 'Profile Verification' },
    { table: 'donations', amount: 'amount', details: [], label: () => 'Donation' },
    { table: 'ai_chat_subscriptions', amount: null, details: [], label: () => 'AI Chat Subscription' },
  ];
  const results = await Promise.all(sources.map(async (source) => {
    const columns = ['razorpay_order_id', 'created_at', ...(source.amount ? [source.amount] : []), ...source.details].join(',');
    const { data, error } = await supabase.from(source.table).select(columns)
      .eq('user_id', user.id).not('razorpay_order_id', 'is', null)
      .gte('created_at', start.toISOString()).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).map((row: any) => ({ orderId: row.razorpay_order_id,
      label: source.label(row), amount: source.amount ? Number(row[source.amount]) : null }));
  }));
  const orders = new Map<string, { label: string; amount: number | null }>();
  for (const row of results.flat()) if (row.orderId) orders.set(row.orderId, { label: row.label, amount: row.amount });

  // Developer API payments: QR / checkout purchases, auto-top-ups and subscriptions (incl. auto-pay renewals).
  const directPayments = new Map<string, string>(); // payment_id -> label
  const subscriptionIds = new Map<string, string>(); // sub_ id -> label
  const subscriptionIdByPayment = new Map<string, string>(); // payment_id -> sub_ id
  const sourceLabel: Record<string, string> = { purchase: 'Increase API Calls', topup: 'API Auto-Top-Up' };
  const [{ data: callRows }, { data: subRows }] = await Promise.all([
    supabase.from('api_call_purchases').select('payment_id,source,created_at').eq('user_id', user.id)
      .gte('created_at', start.toISOString()).order('created_at', { ascending: false }).limit(200),
    supabase.from('api_subscriptions').select('payment_id,subscription_id,payment_mode,created_at').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50),
  ]);
  for (const row of callRows || []) if (typeof row.payment_id === 'string' && row.payment_id.startsWith('pay_'))
    directPayments.set(row.payment_id, sourceLabel[row.source] || 'Increase API Calls');
  for (const row of subRows || []) {
    if (typeof row.payment_id === 'string' && row.payment_id.startsWith('pay_')) {
      directPayments.set(row.payment_id, 'API Subscription');
      if (typeof row.subscription_id === 'string' && row.subscription_id.startsWith('sub_')) {
        subscriptionIdByPayment.set(row.payment_id, row.subscription_id);
      }
    }
    if (typeof row.subscription_id === 'string' && row.subscription_id.startsWith('sub_')) subscriptionIds.set(row.subscription_id, 'API Subscription (Auto-pay)');
  }
  // Payment-link / QR payments: the user may close the page before the credit step
  // runs, so pick them up from verified webhook events tagged with this user.
  const productLabel = (product?: string) => product === 'developer_api_calls' ? 'Increase API Calls' : 'API Subscription';
  const sinceIso = start.toISOString();
  const [{ data: linkEvents }, { data: payEvents }, { data: closedLinkEvents }] = await Promise.all([
    supabase.from('razorpay_events').select('payload')
      .in('event_type', ['payment_link.paid', 'payment_link.partially_paid'])
      .eq('payload->payload->payment_link->entity->notes->>user_id', user.id)
      .gte('event_created_at', sinceIso).limit(200),
    supabase.from('razorpay_events').select('payload')
      .in('event_type', ['payment.captured', 'payment.failed'])
      .eq('payload->payload->payment->entity->notes->>user_id', user.id)
      .gte('event_created_at', sinceIso).limit(200),
    supabase.from('razorpay_events').select('event_id,event_type,payload,event_created_at')
      .in('event_type', ['payment_link.expired', 'payment_link.cancelled'])
      .eq('payload->payload->payment_link->entity->notes->>user_id', user.id)
      .gte('event_created_at', sinceIso).limit(200),
  ]);
  const paidLinkIds = new Set<string>();
  for (const row of [...(linkEvents || []), ...(payEvents || [])] as any[]) {
    const pay = row?.payload?.payload?.payment?.entity;
    const link = row?.payload?.payload?.payment_link?.entity;
    if (link?.id) paidLinkIds.add(link.id);
    const notes = link?.notes || pay?.notes || {};
    if (typeof pay?.id === 'string' && pay.id.startsWith('pay_') && !directPayments.has(pay.id))
      directPayments.set(pay.id, productLabel(notes.product));
  }
  // Expired / cancelled payment links never create a payment, so list them from their events.
  const closedLinks = new Map<string, any>();
  for (const row of (closedLinkEvents || []) as any[]) {
    const link = row?.payload?.payload?.payment_link?.entity;
    if (!link?.id || paidLinkIds.has(link.id) || closedLinks.has(link.id)) continue;
    closedLinks.set(link.id, {
      id: link.id, order_id: link.order_id || '', label: productLabel(link.notes?.product),
      amount: Number(link.amount || 0) / 100, refunded_amount: 0,
      status: row.event_type === 'payment_link.cancelled' ? 'cancelled' : 'expired',
      created_at: link.created_at ? new Date(Number(link.created_at) * 1000).toISOString() : row.event_created_at,
      currency: link.currency || 'INR', description: link.description || null,
      customer_id: link.customer?.id || null, email: link.customer?.email || null, contact: link.customer?.contact || null,
      reference_id: link.reference_id || null, billing_address: link.notes?.billing_address || null, payment_link_id: link.id, short_url: link.short_url || null,
      event_id: row.event_id || null, error_description: row.event_type === 'payment_link.cancelled' ? 'Payment link cancelled' : 'Payment link expired before payment',
    });
  }
  // PayPal payments: status/refunds come only from verified paypal-webhook events.
  const { data: ppRows } = await supabase.from('paypal_payments')
    .select('*').eq('user_id', user.id).in('status', ['captured', 'refunded', 'partially_refunded', 'failed', 'expired'])
    .gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(200);
  const paypalPayments = (ppRows || []).map(paypalHistoryRow);
  if (!orders.size && !directPayments.size && !subscriptionIds.size && !closedLinks.size && !paypalPayments.length)
    return json({ payments: [], nextOffset: null, total: 0, counts: { success: 0, failed: 0, refund: 0, history: 0 }, amounts: { success: 0, failed: 0, refund: 0, history: 0 } });

  const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keyId || !secret) return json({ error: 'Payment history unavailable' }, 503);
  const authorization = `Basic ${btoa(`${keyId}:${secret}`)}`;
  const rzp = async (path: string) => {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, { headers: { Authorization: authorization } });
    if (!response.ok) { console.warn('Razorpay lookup failed', path, response.status); return null; }
    return response.json();
  };
  const toRow = (payment: any, label: string) => {
    const refunded = Number(payment.amount_refunded || 0);
    const status = payment.status === 'refunded' || (refunded > 0 && refunded >= Number(payment.amount)) ? 'refunded'
      : refunded > 0 ? 'partially_refunded' : payment.status;
    return {
      id: payment.id, order_id: payment.order_id || '', label,
      amount: Number(payment.amount) / 100, refunded_amount: refunded / 100, status,
      created_at: new Date(Number(payment.created_at) * 1000).toISOString(),
      currency: payment.currency || 'INR',
      description: payment.description || null,
      customer_id: payment.customer_id || null,
      transaction_id: payment.acquirer_data?.upi_transaction_id || payment.acquirer_data?.bank_transaction_id || payment.acquirer_data?.transaction_id || payment.acquirer_data?.auth_code || null,
      rrn: payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || null,
      method: payment.method || null,
      vpa: payment.vpa || null,
      bank_name: payment.bank_name || payment.bank || payment.card?.bank_name || null,
      card_network: payment.card?.network || null,
      card_last4: payment.card?.last4 || null,
      card_type: payment.card?.type || null,
      wallet: payment.wallet || null,
      email: payment.email || null,
      contact: payment.contact || null,
      error_code: payment.error_code || null,
      error_description: payment.error_description || null,
      error_reason: payment.error_reason || null,
    };
  };
  const inRange = (payment: any) => ['captured', 'failed', 'refunded'].includes(payment?.status) &&
    Number(payment.created_at) * 1000 >= start.getTime();

  const seen = new Map<string, any>();
  const tasks: Array<() => Promise<void>> = [];
  for (const [orderId, source] of orders) tasks.push(async () => {
    const body = await rzp(`orders/${encodeURIComponent(orderId)}/payments`);
    for (const p of body?.items || []) if (p.order_id === orderId && inRange(p)) seen.set(p.id, toRow(p, source.label));
  });
  for (const [subId, label] of subscriptionIds) tasks.push(async () => {
    const body = await rzp(`invoices?subscription_id=${encodeURIComponent(subId)}&count=100`);
    for (const inv of body?.items || []) if (inv.payment_id) {
      subscriptionIdByPayment.set(inv.payment_id, subId);
      if (!directPayments.has(inv.payment_id)) directPayments.set(inv.payment_id, label);
    }
  });
  // Bounded concurrency; Razorpay (not local rows) decides status, refunds included.
  const run = async (list: Array<() => Promise<void>>) => {
    for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(t => t()));
  };
  await run(tasks);
  await run([...directPayments].filter(([id]) => !seen.has(id)).map(([id, label]) => async () => {
    const p = await rzp(`payments/${encodeURIComponent(id)}`);
    if (p && inRange(p)) seen.set(p.id, toRow(p, label));
  }));

  const payments = [...seen.values()];
  for (const payment of payments) payment.subscription_id = subscriptionIdByPayment.get(payment.id) || null;
  for (const link of closedLinks.values()) if (new Date(link.created_at).getTime() >= start.getTime()) payments.push(link);
  payments.push(...paypalPayments);
  payments.sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Status buckets drive the Success / Failed / Refund / History tabs. Counts are
  // always taken from the whole period so switching tabs never changes the numbers.
  // Amounts total the rupees in each bucket; the refund bucket totals money refunded.
  const statusOf = (payment: any): 'success' | 'failed' | 'refund' =>
    ['failed', 'expired', 'cancelled'].includes(payment.status) ? 'failed'
      : payment.status === 'refunded' || payment.status === 'partially_refunded' ? 'refund' : 'success';
  const counts: { success: number; failed: number; refund: number; history: number } =
    { success: 0, failed: 0, refund: 0, history: payments.length };
  const amounts: { success: number; failed: number; refund: number; history: number } =
    { success: 0, failed: 0, refund: 0, history: 0 };
  for (const payment of payments) {
    counts[statusOf(payment)]++;
    const bucket = statusOf(payment);
    amounts[bucket] += bucket === 'refund' ? Number(payment.refunded_amount || 0) : Number(payment.amount || 0);
    amounts.history += Number(payment.amount || 0);
  }
  const filter = ['success', 'failed', 'refund'].includes(String(params?.filter)) ? String(params.filter) : 'all';
  const visible = filter === 'all' ? payments : payments.filter(payment => statusOf(payment) === filter);
  const page = visible.slice(offset, offset + limit);
  const nextOffset = offset + page.length < visible.length ? offset + page.length : null;

  // A failed refund can leave the payment captured, so inspect refunds for every displayed payment.
  // Razorpay refunds are authoritative; webhook events provide the dated timeline.
  const paymentIds = page.map((p: any) => p.id);
  if (paymentIds.length) {
    // Workbook events can carry payment, subscription, invoice and customer details together.
    // Some rows use subscription/invoice as entity_id, so match the nested payment too.
    // Targeted lookups (no global date/limit window) so this user's events are never crowded out.
    const orderIds = page.map((p: any) => p.order_id).filter(Boolean);
    const subscriptionIdsForPage = page.map((p: any) => p.subscription_id).filter((id: unknown) => typeof id === 'string' && id.startsWith('sub_'));
    const sel = 'event_id,entity_id,event_type,payload,event_created_at';
    const lookups = await Promise.all([
      supabase.from('razorpay_events').select(sel).in('entity_id', paymentIds).limit(500),
      subscriptionIdsForPage.length ? supabase.from('razorpay_events').select(sel).in('entity_id', subscriptionIdsForPage).limit(500) : Promise.resolve({ data: [] }),
      supabase.from('razorpay_events').select(sel).in('payload->payload->payment->entity->>id', paymentIds).limit(500),
      supabase.from('razorpay_events').select(sel).in('payload->payload->invoice->entity->>payment_id', paymentIds).limit(500),
      orderIds.length ? supabase.from('razorpay_events').select(sel).in('payload->payload->order->entity->>id', orderIds).limit(500) : Promise.resolve({ data: [] }),
    ]);
    const byEventId = new Map<string, any>();
    for (const res of lookups) for (const row of (res as any).data || []) byEventId.set(String(row.event_id ?? Math.random()), row);
    const paymentEventRows = [...byEventId.values()].sort((a, b) => String(b.event_created_at).localeCompare(String(a.event_created_at)));
    const paymentByOrder = new Map<string, string>(page.filter((p: any) => p.order_id).map((p: any) => [p.order_id, p.id]));
    const paymentBySubscription = new Map<string, string>(page.filter((p: any) => p.subscription_id).map((p: any) => [p.subscription_id, p.id]));
    const workbookByPayment = new Map<string, { event_id?: string; customer_id?: string; subscription_id?: string; transaction_id?: string }>();
    for (const row of paymentEventRows) {
      const raw = (row as any).payload || {};
      const payload = raw.payload || raw;
      const payment = payload.payment?.entity || {};
      const subscription = payload.subscription?.entity || {};
      const invoice = payload.invoice?.entity || {};
      const order = payload.order?.entity || {};
      const paymentId = payment.id || invoice.payment_id
        || (paymentIds.includes(row.entity_id) ? row.entity_id : null)
        || paymentBySubscription.get(subscription.id || row.entity_id)
        || paymentByOrder.get(order.id || payment.order_id || invoice.order_id);
      if (!paymentId || !paymentIds.includes(paymentId)) continue;
      const acq = payment.acquirer_data || {};
      const current = workbookByPayment.get(paymentId) || {};
      workbookByPayment.set(paymentId, {
        event_id: current.event_id || row.event_id || raw.id || undefined,
        customer_id: current.customer_id || payment.customer_id || subscription.customer_id || invoice.customer_id || order.customer_id || undefined,
        subscription_id: current.subscription_id || subscription.id || payment.subscription_id || invoice.subscription_id || undefined,
        transaction_id: current.transaction_id || acq.upi_transaction_id || acq.bank_transaction_id || acq.transaction_id || acq.auth_code || acq.arn || undefined,
      });
    }
    for (const p of page) {
      const workbook = workbookByPayment.get(p.id);
      p.event_id = workbook?.event_id || p.event_id || null;
      p.customer_id = p.customer_id || workbook?.customer_id || null;
      p.subscription_id = p.subscription_id || workbook?.subscription_id || null;
      p.transaction_id = p.transaction_id || workbook?.transaction_id || null;
    }
    const { data: eventRows } = await supabase.from('razorpay_events')
      .select('event_type,payload,event_created_at')
      .like('event_type', 'refund.%')
      .in('payload->payload->refund->entity->>payment_id', paymentIds)
      .order('event_created_at', { ascending: false })
      .limit(500);
    const eventsByRefund = new Map<string, Array<{ type: string; at: string | null; speed: string | null }>>();
    const workbookByRefund = new Map<string, { currency?: string; comment?: string; description?: string; customer_id?: string; upi_transaction_id?: string }>();
    for (const row of eventRows || []) {
      const eventPayload = (row as any).payload?.payload || (row as any).payload || {};
      const r = eventPayload.refund?.entity;
      if (!r?.id) continue;
      const list = eventsByRefund.get(r.id) || [];
      list.push({ type: row.event_type, at: row.event_created_at, speed: r.speed_processed || r.speed_requested || null });
      eventsByRefund.set(r.id, list);
      const eventPayment = eventPayload.payment?.entity || {};
      const notes = r.notes && typeof r.notes === 'object' ? r.notes : {};
      const noteComment = refundNoteComment(notes) || undefined;
      const acquirer = eventPayment.acquirer_data || r.acquirer_data || {};
      const current = workbookByRefund.get(r.id) || {};
      workbookByRefund.set(r.id, {
        currency: current.currency || r.currency || eventPayment.currency || undefined,
        comment: current.comment || noteComment,
        description: current.description || r.description || notes.description || eventPayment.description || undefined,
        customer_id: current.customer_id || r.customer_id || eventPayment.customer_id || undefined,
        upi_transaction_id: current.upi_transaction_id || acquirer.upi_transaction_id || undefined,
      });
    }
    await run(page.filter((p: any) => p.provider !== 'paypal').map((p: any) => async () => {
      const body = await rzp(`payments/${encodeURIComponent(p.id)}/refunds?count=100`);
      p.refunds = (body?.items || []).map((r: any) => {
        const createdAt = new Date(Number(r.created_at) * 1000);
        const events = (eventsByRefund.get(r.id) || []).sort((a, b) => String(a.at).localeCompare(String(b.at)));
        const speed = r.speed_processed || r.speed_requested || null;
        const display = refundDisplay({ status: r.status, processed_at: r.processed_at, events });
        const workbook = workbookByRefund.get(r.id);
        const notes = r.notes && typeof r.notes === 'object' ? r.notes : {};
        const comment = refundNoteComment(notes) || null;
        return {
          id: r.id, amount: Number(r.amount) / 100, status: r.status,
          speed,
          created_at: createdAt.toISOString(), ...display, events,
          currency: r.currency || workbook?.currency || p.currency || null,
          comment: comment || workbook?.comment || null,
          description: r.description || notes.description || workbook?.description || null,
          customer_id: r.customer_id || workbook?.customer_id || p.customer_id || null,
          upi_transaction_id: r.acquirer_data?.upi_transaction_id || workbook?.upi_transaction_id || p.transaction_id || null,
        };
      }).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
    }));
  }
  return json({ payments: page, nextOffset, total: visible.length, counts, amounts });
}

// Adds N business days (Mon–Fri) in India time.
function addBusinessDaysIST(from: Date, days: number): Date {
  const IST = 5.5 * 3600_000;
  const d = new Date(from.getTime() + IST);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return new Date(d.getTime() - IST);
}

function paymentPurposeLabel(purpose: unknown): string {
  if (typeof purpose !== 'string' || !purpose.trim()) return 'Service Payment';
  return purpose
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

// =============================================
// VERIFY BOOST PAYMENT
// =============================================

async function handleVerifyBoost(supabase: any, params: any, req: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, jobBoostId } = params;

  // Validate auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing authorization');

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) throw new Error('User not authenticated');

  // Verify signature
  const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!razorpaySecret) throw new Error('Razorpay secret not configured');

  const expectedSignature = await generateSignature(`${razorpay_order_id}|${razorpay_payment_id}`, razorpaySecret);
  const isValid = expectedSignature.length === razorpay_signature.length && timingSafeEqual(expectedSignature, razorpay_signature);

  if (!isValid) {
    await notifyPayment(supabase, {
      userId: user.id,
      success: false,
      method: 'razorpay',
      transactionType: 'boost',
      itemName: 'Job Boost',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      actionUrl: '/employer-portal',
      failureReason: 'Payment verification failed (invalid signature).',
    });
    throw new Error('Invalid payment signature');
  }

  if (!jobBoostId) throw new Error('Missing job boost reference');
  const { data: boostRecord, error: boostLookupError } = await supabase.from('job_boosts')
    .select('id, amount_paid, user_id, status, razorpay_payment_id, razorpay_order_id')
    .eq('id', jobBoostId).eq('user_id', user.id).eq('razorpay_order_id', razorpay_order_id).maybeSingle();
  if (boostLookupError || !boostRecord) throw new Error('Job boost purchase not found');
  if (boostRecord.status === 'completed' && boostRecord.razorpay_payment_id === razorpay_payment_id) {
    return new Response(JSON.stringify({ status: 'success', already: true, message: 'Boost already activated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (boostRecord.status !== 'pending' && boostRecord.status !== 'created') throw new Error('Job boost is not awaiting payment');
  await verifyCapturedRazorpayPayment(razorpay_order_id, razorpay_payment_id, Math.round(Number(boostRecord.amount_paid) * 100), { user_id: user.id });
  const { data: claimedBoost, error: claimError } = await supabase.from('job_boosts').update({
    razorpay_payment_id, razorpay_signature, status: 'completed', updated_at: new Date().toISOString()
  }).eq('id', jobBoostId).eq('user_id', user.id).in('status', ['pending', 'created']).select('id').maybeSingle();
  if (claimError || !claimedBoost) throw new Error('Job boost payment was already processed');

  const { error: activateError } = await supabase.rpc('activate_job_boost', { p_job_boost_id: jobBoostId });
  if (activateError) throw new Error('Failed to activate job boost');

  if (boostRecord) {
    await supabase.rpc('process_referral_commission', {
      p_referred_user_id: boostRecord.user_id, p_payment_amount: boostRecord.amount_paid, p_payment_id: razorpay_payment_id, p_source_type: 'job_boost'
    }).catch((e: any) => console.error('Referral commission error:', e));
  }

  // Send notifications
  await sendEmployerNotifications(supabase, user.id, boostRecord?.amount_paid || 0, 'Job Boost', razorpay_payment_id);

  // Send payment receipt email (best-effort)
  try {
    const { email, name } = await resolveUserEmail(supabase, user.id);
    await sendPaymentReceiptEmail(supabase, email || user.email || null, name || user.user_metadata?.full_name || null, {
      paymentType: 'Job Boost',
      amountInr: Number(boostRecord?.amount_paid) || 0,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      ctaUrl: `${WEBSITE_DOMAIN}/employer-portal`,
      ctaLabel: 'Open Employer Portal',
    });
  } catch (e) { console.error('[verify-boost] receipt email failed:', e); }

  return new Response(JSON.stringify({ status: 'success', message: 'Boost payment verified and activated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// =============================================
// VERIFY VERIFICATION PAYMENT
// =============================================

async function handleVerifyVerification(supabase: any, params: any, req: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, verification_package_id } = params;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing authorization');
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) throw new Error('User not authenticated');
  const user_id = user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !verification_package_id) throw new Error('Missing payment verification parameters');

  // Verify signature
  const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!razorpaySecret) throw new Error('Razorpay secret not configured');

  const expectedSignature = await generateSignature(`${razorpay_order_id}|${razorpay_payment_id}`, razorpaySecret);
  const isValid = expectedSignature.length === razorpay_signature.length && timingSafeEqual(expectedSignature, razorpay_signature);

  if (!isValid) {
    await notifyPayment(supabase, {
      userId: user_id,
      success: false,
      method: 'razorpay',
      transactionType: 'verification',
      itemName: 'Company Verification',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      actionUrl: '/employer-portal',
      failureReason: 'Payment verification failed (invalid signature).',
    });
    throw new Error('Invalid payment signature');
  }

  // Confirm the order belongs to this user and package before activating anything.
  const { data: purchaseRecord, error: purchaseError } = await supabase
    .from('verification_purchases')
    .select('id, amount_paid, user_id, verification_package_id, status, razorpay_payment_id')
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('user_id', user_id)
    .eq('verification_package_id', verification_package_id)
    .maybeSingle();
  if (purchaseError || !purchaseRecord) throw new Error('Matching verification purchase not found');
  if (purchaseRecord.status === 'completed' && purchaseRecord.razorpay_payment_id === razorpay_payment_id) {
    return new Response(JSON.stringify({ status: 'success', already: true, message: 'Verification payment already activated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (purchaseRecord.status !== 'pending') throw new Error('Verification purchase is not pending');
  await verifyCapturedRazorpayPayment(razorpay_order_id, razorpay_payment_id, Math.round(Number(purchaseRecord.amount_paid) * 100), { user_id, verification_package_id: String(verification_package_id) });

  const { data: updatedPurchase, error: updateError } = await supabase.from('verification_purchases').update({
    razorpay_payment_id, razorpay_signature, status: 'completed'
  }).eq('id', purchaseRecord.id).eq('status', 'pending').select('id').maybeSingle();
  if (updateError || !updatedPurchase) throw new Error('Verification purchase was already processed');

  const { error: activationError } = await supabase.rpc('activate_company_verification', {
    p_user_id: user_id, p_verification_package_id: verification_package_id
  });
  if (activationError) throw new Error('Failed to activate verification');

  if (purchaseRecord) {
    await supabase.rpc('process_referral_commission', {
      p_referred_user_id: purchaseRecord.user_id, p_payment_amount: purchaseRecord.amount_paid, p_payment_id: razorpay_payment_id, p_source_type: 'verification'
    }).catch((e: any) => console.error('Referral commission error:', e));
  }

  // Send notifications
  await sendEmployerNotifications(supabase, user_id, purchaseRecord?.amount_paid || 0, 'Company Verification', razorpay_payment_id);

  // Send payment receipt email (best-effort)
  try {
    const { email, name } = await resolveUserEmail(supabase, user_id);
    await sendPaymentReceiptEmail(supabase, email, name, {
      paymentType: 'Company Verification',
      amountInr: Number(purchaseRecord?.amount_paid) || 0,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      ctaUrl: `${WEBSITE_DOMAIN}/employer-portal`,
      ctaLabel: 'View Verification',
    });
  } catch (e) { console.error('[verify-verification] receipt email failed:', e); }

  return new Response(JSON.stringify({ status: 'success', message: 'Verification activated successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


async function verifyCapturedRazorpayPayment(orderId: string, paymentId: string, expectedAmountPaise: number, expectedNotes: Record<string, string> = {}) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keyId || !keySecret) throw new Error('Razorpay API credentials are not configured');
  if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise < 1) throw new Error('Invalid expected payment amount');
  const auth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
  const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: auth },
  });
  if (!orderResponse.ok) throw new Error('Unable to confirm Razorpay order');
  const order = await orderResponse.json();
  if (order.id !== orderId || order.status !== 'paid' || Number(order.amount) !== expectedAmountPaise || order.currency !== 'INR') {
    throw new Error('Razorpay order is not paid or does not match the expected amount and currency');
  }
  for (const [key, value] of Object.entries(expectedNotes)) {
    if (String(order.notes?.[key] ?? '') !== String(value)) throw new Error('Razorpay order does not match the expected payer or purchase');
  }
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: auth },
  });
  if (!response.ok) throw new Error('Unable to confirm payment status with Razorpay');
  const payment = await response.json();
  if (payment.order_id !== orderId || payment.status !== 'captured' || Number(payment.amount) !== expectedAmountPaise || payment.currency !== 'INR') {
    throw new Error('Razorpay payment is not captured or does not match the expected order, amount and currency');
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function sendEmployerNotifications(supabase: any, userId: string, amount: number, packageName: string, paymentId: string) {
  try {
    await notifyPayment(supabase, {
      userId,
      success: true,
      method: 'razorpay',
      transactionType: packageName.toLowerCase().includes('boost') ? 'boost' : 'verification',
      itemName: packageName,
      amountInr: Number(amount) || 0,
      paymentId,
      actionUrl: '/employer-portal',
    });

    const { data: company } = await supabase.from('companies').select('company_name').eq('user_id', userId).maybeSingle();
    await notifyEvent(supabase, {
      eventType: 'employer_payment_success',
      userId,
      audience: 'employer',
      name: company?.company_name || undefined,
      variables: {
        amount: `₹${amount}`,
        plan: packageName,
        order_id: paymentId,
        company: company?.company_name,
      },
      fallbackTitle: '✅ Payment Successful',
      fallbackMessage: `Your payment of ₹${amount} for ${packageName} was successful.`,
    });
  } catch (e) { console.error('Notification error:', e); }
}

// =============================================
// VERIFY DONATION PAYMENT (no auth required)
// =============================================
async function handleVerifyDonation(supabase: any, params: any) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, donation_id } = params;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !donation_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keySecret) {
    return new Response(JSON.stringify({ error: 'Razorpay secret not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const expected = await generateSignature(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret);
  if (!timingSafeEqual(expected, razorpay_signature)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: donation, error: dErr } = await supabase
    .from('donations').select('*').eq('id', donation_id)
    .eq('razorpay_order_id', razorpay_order_id).single();
  if (dErr || !donation) {
    return new Response(JSON.stringify({ error: 'Donation record not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (donation.status === 'paid') {
    return new Response(JSON.stringify({ success: true, already_paid: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await verifyCapturedRazorpayPayment(razorpay_order_id, razorpay_payment_id, Math.round(Number(donation.amount) * 100), {
    type: 'donation',
    campaign_id: String(donation.campaign_id),
  });

  const { error: updErr } = await supabase
    .from('donations').update({
      status: 'paid',
      razorpay_payment_id,
      razorpay_signature,
      paid_at: new Date().toISOString(),
    }).eq('id', donation_id);
  if (updErr) {
    return new Response(JSON.stringify({ error: `Update failed: ${updErr.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Send branded thank-you receipt email (best-effort, never block verification)
  try {
    const { data: camp } = await supabase
      .from('donation_campaigns')
      .select('title, image_url, short_description')
      .eq('id', donation.campaign_id).maybeSingle();

    const toEmail: string | null = donation.donor_email || null;
    if (toEmail) {
      const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(donation.amount));
      const displayName = donation.is_anonymous ? 'Anonymous Donor' : (donation.donor_name || 'Friend');
      const campaignTitle = camp?.title || 'Donation Campaign';
      const dt = new Date();
      const istDate = istStampParts(dt).datetime;

      const subject = `🙏 Thank you for your ${inr} donation to ${campaignTitle}`;
      const html = `
        <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          ${camp?.image_url ? `<img src="${camp.image_url}" alt="${campaignTitle}" style="width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:18px;" />` : ''}
          <h2 style="color:#c2410c;margin:0 0 6px 0;">Thank you, ${displayName} 🙏</h2>
          <p style="margin:0 0 14px 0;color:#6b7280;font-size:14px;">Your contribution to <b>${campaignTitle}</b> has been received successfully.</p>

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:18px 20px;margin:18px 0;">
            <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Donation Amount</div>
            <div style="font-size:30px;font-weight:800;color:#c2410c;line-height:1;">${inr}</div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#6b7280;">Receipt No.</td><td style="padding:6px 0;text-align:right;font-weight:600;">${donation.id.slice(0, 8).toUpperCase()}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Payment ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px;">${razorpay_payment_id}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Date &amp; Time</td><td style="padding:6px 0;text-align:right;">${istDate} IST</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Campaign</td><td style="padding:6px 0;text-align:right;">${campaignTitle}</td></tr>
            ${donation.message ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">Your Message</td><td style="padding:6px 0;text-align:right;font-style:italic;">"${String(donation.message).replace(/</g,'&lt;')}"</td></tr>` : ''}
          </table>

          <p style="margin:22px 0 6px 0;font-size:14px;">Your generosity directly supports Gau Seva — food, water, shelter and medical care for rescued cows. Gau Mata blesses you. 🐄</p>
          <p style="margin:18px 0 0 0;font-size:12px;color:#9ca3af;">This is your official donation receipt. Please save this email for your records.</p>
        </div>`;

      await supabase.functions.invoke('email-api/send-email', {
        body: {
          to: toEmail,
          toName: displayName,
          subject,
          htmlContent: html,
          textContent: `Thank you ${displayName}! Your donation of ${inr} to ${campaignTitle} has been received. Payment ID: ${razorpay_payment_id}. Date: ${istDate} IST.`,
        },
      });
    }
  } catch (e) {
    console.error('[verify-donation] Email send failed (non-blocking):', e);
  }

  return new Response(JSON.stringify({ success: true, message: 'Donation recorded. Thank you!' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// =============================================
// VERIFY JOB INDEXING PAYMENT (₹ paywall for Google/Bing submission)
// =============================================
async function handleVerifyJobIndexing(supabase: any, params: any, req: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, job_id } = params;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !job_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: { user }, error: uErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (uErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Signature check
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keySecret) {
    return new Response(JSON.stringify({ error: 'Razorpay secret not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const expected = await generateSignature(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret);
  if (!timingSafeEqual(expected, razorpay_signature)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Verify job ownership (via companies.user_id)
  const { data: job, error: jErr } = await supabase
    .from('jobs')
    .select('id, title, company_id, public_slug, short_id, status, visibility')
    .eq('id', job_id).single();
  if (jErr || !job) {
    return new Response(JSON.stringify({ error: 'Job not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (!job.company_id) {
    return new Response(JSON.stringify({ error: 'Job has no verified company owner' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: company, error: companyError } = await supabase
    .from('companies').select('user_id').eq('id', job.company_id).maybeSingle();
  if (companyError || !company || company.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Not authorized for this job' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Build job URL
  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const baseSlug = job.public_slug || `${slugify(job.title || 'job')}-${job.id}`;
  const job_url = `${WEBSITE_DOMAIN}/job/${baseSlug}`;

  // Fetch price from app_settings (for record)
  const { data: setting } = await supabase
    .from('app_settings').select('setting_value').eq('setting_key', 'search_engine_indexing_price').maybeSingle();
  const price = Math.max(1, parseInt(setting?.setting_value || '100', 10) || 100);
  await verifyCapturedRazorpayPayment(razorpay_order_id, razorpay_payment_id, price * 100, { service: 'search_listing', ref: user.id, job_id: String(job_id) });

  // Upsert job_indexing_status with paid flag
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('job_indexing_status')
    .upsert({
      job_id,
      url: job_url,
      is_paid_for_indexing: true,
      indexing_paid_at: nowIso,
      indexing_payment_id: razorpay_payment_id,
      google_status: 'queued',
      google_queued_at: nowIso,
      bing_status: 'queued',
      bing_queued_at: nowIso,
    }, { onConflict: 'job_id' });
  if (upErr) {
    console.error('[verify-job-indexing] upsert error:', upErr);
    return new Response(JSON.stringify({ error: `DB error: ${upErr.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Queue Google URL_UPDATED
  const { error: gErr } = await supabase
    .from('google_indexing_queue')
    .upsert({
      job_id,
      url: job_url,
      status: 'pending',
      action: 'URL_UPDATED',
      priority: 9,
      source: 'paid_indexing',
      page_type: 'job',
      retry_count: 0,
    }, { onConflict: 'url' });
  if (gErr) console.error('[verify-job-indexing] google queue error:', gErr);

  // Record job payment (best-effort)
  try {
    await supabase.from('job_payments').insert({
      user_id: user.id,
      job_id,
      points_spent: price,
      payment_type: 'search_indexing',
      description: `Paid ₹${price} for Google & Bing indexing (razorpay_payment_id=${razorpay_payment_id})`,
    });
  } catch (e) {
    console.error('[verify-job-indexing] job_payments insert failed (non-blocking):', e);
  }

  await notifyEvent(supabase, {
    eventType: 'google_bing_publish_activated', userId: user.id, audience: 'employer',
    variables: { job_title: job_id ? (await supabase.from('jobs').select('title').eq('id', job_id).maybeSingle()).data?.title ?? '' : '', amount: `₹${price}`, points: '', item: 'Publish on Google & Bing' },
    fallbackTitle: 'Job sent to Google & Bing', fallbackMessage: 'Your job will appear in Google & Bing search soon.',
  }).catch(() => {});

  return new Response(JSON.stringify({
    success: true,
    message: 'Payment verified. Job queued for Google & Bing submission.',
    price_inr: price,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}


// =============================================
// VERIFY JOB POSTING / EXTENSION / INTERVIEW PAYMENT
// =============================================
async function handleVerifyJobPayment(supabase: any, params: any, req: Request) {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json({ error: 'Missing payment fields' }, 400);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing authorization' }, 401);
  const { data: { user }, error: uErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (uErr || !user) return json({ error: 'Invalid session' }, 401);

  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
  if (!keySecret) return json({ error: 'Razorpay secret not configured' }, 500);
  const expected = await generateSignature(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret);
  if (!timingSafeEqual(expected, String(razorpay_signature))) return json({ error: 'Invalid signature' }, 400);

  const { data: pending } = await supabase.from('pending_payments')
    .select('*').eq('razorpay_order_id', razorpay_order_id).eq('user_id', user.id).maybeSingle();
  if (!pending) return json({ error: 'Payment not found' }, 404);
  if (pending.status === 'completed') return json({ success: true, data: pending.result, already: true });
  await verifyCapturedRazorpayPayment(razorpay_order_id, razorpay_payment_id, Math.round(Number(pending.amount_inr) * 100), { ref: user.id });

  // Claim atomically so a double submit cannot fulfil twice
  const { data: claimed } = await supabase.from('pending_payments')
    .update({ status: 'processing', razorpay_payment_id, updated_at: new Date().toISOString() })
    .eq('id', pending.id).eq('status', 'created').select('id');
  if (!claimed?.length) return json({ error: 'Payment is already being processed' }, 409);

  try {
    const result = await fulfillJobPayment(supabase, pending, razorpay_payment_id);
    await supabase.from('pending_payments').update({ status: 'completed', result, updated_at: new Date().toISOString() }).eq('id', pending.id);
    await notifyPayment(supabase, {
      userId: user.id, success: true, method: 'razorpay', transactionType: pending.purpose,
      itemName: pending.purpose.replace('_', ' '), amountInr: pending.amount_inr, paymentId: razorpay_payment_id,
    } as any).catch(() => {});
    return json({ success: true, data: result, amount_inr: pending.amount_inr });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Fulfilment failed';
    console.error('[verify-job-payment] fulfil error:', msg);
    await supabase.from('pending_payments').update({ status: 'failed', result: { error: msg }, updated_at: new Date().toISOString() }).eq('id', pending.id);
    return json({ error: msg }, 500);
  }
}
