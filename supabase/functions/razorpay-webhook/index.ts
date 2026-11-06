import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyPayment } from "../_shared/paymentNotify.ts";
import { notifyEvent } from "../_shared/eventNotify.ts";
import { recordRazorpayEvent } from "../_shared/razorpayEvents.ts";
import { creditDeveloperQrPayment, makeRz, QR_PRODUCTS } from "../_shared/developerQrPayment.ts";
import { sendPaymentStatusEmail } from "../_shared/paymentStatusEmail.ts";
import { dispatchPaymentEmail } from "../_shared/paymentEmailDispatch.ts";
import { applyPaymentToCustomerLink } from "../_shared/razorpayCustomer.ts";
import { ensureInvoiceForPayment, applyInvoiceWebhook, applyPaymentToInvoice } from "../_shared/razorpayInvoice.ts";

// Enhanced CORS headers for webhook endpoint
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-razorpay-signature, content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Helpers
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length % 2 !== 0) throw new Error("Invalid hex length");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

// Manual timing-safe comparison for Deno compatibility
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Enhanced logging for debugging
  const logInfo = (message: string, data?: any) => {
    console.log(`[${requestId}] ${message}`, data ? JSON.stringify(data) : '');
  };

  const logError = (message: string, error?: any) => {
    console.error(`[${requestId}] ERROR: ${message}`, error);
  };

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint (GET and HEAD for uptime monitoring)
    if (req.method === 'GET' || req.method === 'HEAD') {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'razorpay-webhook',
        version: '2.0'
      };
      logInfo('Health check request', { method: req.method });
      // HEAD requests should return same headers but no body
      if (req.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(health), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only allow POST for webhook
    if (req.method !== 'POST') {
      logError('Invalid method', { method: req.method });
      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Method not allowed - webhook ignored',
        requestId 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate environment variables
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!webhookSecret || !supabaseUrl || !supabaseKey) {
      logError('Missing required environment variables', {
        hasWebhookSecret: !!webhookSecret,
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey
      });
      return new Response(JSON.stringify({ 
        error: 'Server configuration error',
        requestId 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get and validate request data
    const signature = req.headers.get('x-razorpay-signature') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const body = await req.text();
    
    logInfo('Webhook request received', {
      hasSignature: !!signature,
      userAgent,
      bodyLength: body.length,
      hasSignature: !!signature
    });

    if (!body || body.trim() === '') {
      logError('Empty or invalid payload');
      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Invalid payload - webhook ignored',
        requestId 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enhanced signature verification with better error handling
    // Razorpay sends X-Razorpay-Signature as a HEX string (64 chars) of HMAC-SHA256(body, webhookSecret)
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret.trim()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );

      const sigBytes = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
      );
      const expectedHex = bytesToHex(sigBytes);

      let receivedBytes: Uint8Array;
      try {
        receivedBytes = hexToBytes(signature);
      } catch {
        receivedBytes = new Uint8Array();
      }

      const isValid = timingSafeEqual(receivedBytes, sigBytes);

      if (!isValid) {
        logError("Invalid webhook signature verification", {
          receivedLength: signature.trim().length,
        });
        return new Response(
          JSON.stringify({
            status: "rejected",
            message: "Invalid webhook signature",
            requestId,
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      logInfo("Signature verification successful");
    } catch (sigError) {
      logError("Signature verification error", sigError);
      // Return 200 to prevent webhook auto-disable, but log the issue
      return new Response(
        JSON.stringify({
          status: "acknowledged",
          message: "Signature verification error - webhook ignored",
          requestId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse and validate event data
    let event: any;
    try {
      event = JSON.parse(body);
    } catch (parseError) {
      logError('Failed to parse webhook body', parseError);
      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Invalid JSON payload - webhook ignored',
        requestId 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const type: string = event?.event || '';
    
    // Type guard function to ensure type is string before using string methods
    const isValidStringType = (eventType: any): eventType is string => {
      return typeof eventType === 'string' && eventType.length > 0;
    };
    const payment = event?.payload?.payment?.entity;
    const order = event?.payload?.order?.entity;
    const refund = event?.payload?.refund?.entity;
    const paymentLink = event?.payload?.payment_link?.entity;
    const subscription = event?.payload?.subscription?.entity;

    logInfo('Webhook event received', { 
      type, 
      paymentId: payment?.id, 
      orderId: payment?.order_id || order?.id,
      paymentStatus: payment?.status,
      orderStatus: order?.status,
      refundId: refund?.id,
      paymentLinkId: paymentLink?.id,
      subscriptionId: subscription?.id
    });

    // Record EVERY Razorpay event (all categories) for the admin Payment Events dashboard
    try {
      const auditClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await recordRazorpayEvent(auditClient, event, {
        eventId: req.headers.get('x-razorpay-event-id'),
        signatureVerified: true,
      });
    } catch (auditError) {
      logError('Failed to record razorpay event', auditError);
    }

    // Dispatch before QR/link early returns and order-only validation. Refund
    // webhooks may carry only refund.entity, so resolve their parent payment.
    try {
      const mailClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      await dispatchPaymentEmail(event, async (paymentId) => {
        const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
        if (!keyId || !keySecret) throw new Error('Razorpay credentials missing for refund payment lookup');
        const response = await makeRz(keyId, keySecret)(`/payments/${paymentId}`);
        if (!response.ok) throw new Error(`Refund payment lookup failed [${response.status}]`);
        return await response.json();
      }, (kind, entity, refundEntity) => sendPaymentStatusEmail(mailClient, kind, entity, refundEntity));
    } catch (emailError) {
      logError('Payment email dispatch failed', emailError);
    }

    // Dynamic UPI QR payment (Developer API): credit only after Razorpay confirms capture.
    if (type === 'qr_code.credited') {
      try {
        const qr = event?.payload?.qr_code?.entity;
        const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
        if (qr && payment && keyId && keySecret) {
          const admin = createClient(supabaseUrl!, supabaseKey!, { auth: { persistSession: false } });
          const rz = makeRz(keyId, keySecret);
          const pr = await rz(`/payments/${payment.id}`); // re-fetch, never trust payload status
          const fresh = pr.ok ? await pr.json() : null;
          const ok = fresh ? await creditDeveloperQrPayment(admin, rz, qr, fresh) : false;
          logInfo('QR payment processed', { qrId: qr.id, paymentId: payment.id, credited: ok });
        }
      } catch (e) {
        logError('QR credit failed', e);
      }
      return new Response(JSON.stringify({ status: 'ok', requestId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Developer API payment request (link): credit within 5 minutes, refund late payments,
    // even when the user's page was closed.
    if (type === 'payment_link.paid' && paymentLink && QR_PRODUCTS.includes(paymentLink?.notes?.product) && payment?.id) {
      try {
        const keyId = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();
        if (keyId && keySecret) {
          const admin = createClient(supabaseUrl!, supabaseKey!, { auth: { persistSession: false } });
          const rz = makeRz(keyId, keySecret);
          const pr = await rz(`/payments/${payment.id}`);
          const fresh = pr.ok ? await pr.json() : null;
          const asQr = { id: paymentLink.id, status: 'closed', payment_amount: paymentLink.amount, close_by: Number(paymentLink.notes?.close_by || 0), notes: paymentLink.notes };
          const ok = fresh ? await creditDeveloperQrPayment(admin, rz, asQr, fresh) : false;
          logInfo('Payment link processed', { linkId: paymentLink.id, paymentId: payment.id, credited: ok });
        }
      } catch (e) {
        logError('Payment link credit failed', e);
      }
      return new Response(JSON.stringify({ status: 'ok', requestId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process events that require payment validation
    const paymentEvents = [
      'payment.captured', 'payment.authorized', 'payment.failed',
      'order.paid', 'payment_link.paid', 'payment_link.partially_paid'
    ];
    
    if (paymentEvents.includes(type)) {
      // Validate required payment data for payment events
      if (!payment || (!payment.order_id && !order?.id) || !payment.id) {
        logError('Invalid payment payload structure for payment event', {
          hasPayment: !!payment,
          hasOrderId: !!(payment?.order_id || order?.id),
          hasPaymentId: !!payment?.id,
          eventType: type
        });
        return new Response(JSON.stringify({ 
          status: 'acknowledged',
          message: 'Invalid payment payload structure - webhook ignored',
          requestId 
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Initialize Supabase client for all database operations
    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseKey, { 
        auth: { persistSession: false },
        global: { headers: { 'X-Request-ID': requestId } }
      });
      logInfo('Supabase client initialized');
    } catch (supabaseError) {
      logError('Failed to create Supabase client', supabaseError);
      return new Response(JSON.stringify({ 
        error: 'Database connection failed',
        requestId 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Razorpay invoice record: create once per captured payment (skip payments that came from an invoice),
    // and keep payment/refund status in sync.
    if (type === 'payment.captured' && payment?.id && !payment.invoice_id) await ensureInvoiceForPayment(supabase, payment);
    if (payment?.id && (type.startsWith('refund.') || type.startsWith('payment.'))) {
      try { await applyPaymentToInvoice(supabase, payment); } catch (e) { logError('Invoice payment sync failed', e); }
    }

    // Customer ↔ order ↔ payment link: final status only from signed webhooks.
    if (payment?.id && type.startsWith('payment.')) {
      try { await applyPaymentToCustomerLink(supabase, type, payment); } catch (e) { logError('Customer link sync failed', e); }
    }

    // Process failed payment events — mark the transaction and notify the user
    if (type === 'payment.failed') {
      const failedOrderId: string = payment.order_id || order?.id;
      const failedPaymentId: string = payment.id;
      const failReason: string =
        payment.error_description || payment.error_reason || 'The bank or payment method declined this payment.';

      try {
        const { data: failedTxn } = await supabase
          .from('transactions')
          .select('user_id, amount, points')
          .eq('razorpay_order_id', failedOrderId)
          .maybeSingle();

        if (failedTxn?.user_id) {
          await supabase
            .from('transactions')
            .update({ status: 'failed', razorpay_payment_id: failedPaymentId, updated_at: new Date().toISOString() })
            .eq('razorpay_order_id', failedOrderId)
            .eq('status', 'pending');

          await notifyPayment(supabase, {
            userId: failedTxn.user_id,
            success: false,
            method: 'razorpay',
            transactionType: 'purchase',
            itemName: failedTxn.points ? `${failedTxn.points} Points Package` : 'Payment',
            amountInr: Number(failedTxn.amount) || Number(payment.amount) / 100,
            paymentId: failedPaymentId,
            orderId: failedOrderId,
            actionUrl: '/dashboard',
            failureReason: failReason,
          });
        }
      } catch (e) {
        logError('Failed-payment handling error', e);
      }

      return new Response(JSON.stringify({ status: 'ok', handled: 'payment.failed', requestId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process successful payment events
    if (type === 'payment.captured' || type === 'order.paid' || type === 'payment_link.paid') {
      const orderId: string = payment.order_id || order?.id;
      const paymentId: string = payment.id;
      const amountPaise: number = Number(payment.amount);
      
      logInfo('Processing successful payment', { orderId, paymentId, amountPaise, eventType: type });

      // Enhanced transaction processing with comprehensive error handling
      try {
        logInfo('Looking up user transaction', { orderId });
        
        const { data: txn, error: txnErr } = await supabase
          .from('transactions')
          .select('*')
          .eq('razorpay_order_id', orderId)
          .eq('status', 'pending')
          .maybeSingle();

        if (txnErr) {
          logError('Transaction lookup error', txnErr);
          throw new Error(`Transaction lookup failed: ${txnErr.message}`);
        }

        if (txn) {
          logInfo('User transaction found', { 
            transactionId: txn.id, 
            userId: txn.user_id, 
            amount: txn.amount, 
            points: txn.points 
          });

          // Amount validation with tolerance
          const expected = txn.amount * 100;
          const tolerance = 1; // Allow 1 paisa difference for rounding
          if (Math.abs(amountPaise - expected) > tolerance) {
            logError('Amount mismatch', { 
              expected, 
              received: amountPaise, 
              difference: amountPaise - expected, 
              orderId 
            });
            return new Response(JSON.stringify({ 
              status: 'acknowledged',
              message: 'Payment amount mismatch - webhook ignored',
              expected,
              received: amountPaise,
              requestId 
            }), { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle successful payments (payment.captured, order.paid, payment_link.paid)
    if (type === 'payment.captured' || type === 'order.paid' || type === 'payment_link.paid') {
      const orderId: string = payment.order_id || order?.id;
      const paymentId: string = payment.id;
      const errorCode = payment.error_code;
      const errorDescription = payment.error_description;
      
      logInfo('Payment failed', { 
        orderId, 
        paymentId, 
        errorCode, 
        errorDescription,
        eventType: type 
      });

      // Mark transaction as failed if it exists
      try {
        const { error: failErr } = await supabase
          .from('transactions')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString(),
            metadata: {
              failure_reason: errorDescription,
              error_code: errorCode,
              failed_at: new Date().toISOString(),
              request_id: requestId
            }
          })
          .eq('razorpay_order_id', orderId)
          .eq('status', 'pending');

        if (failErr) {
          logError('Failed to update transaction status to failed', failErr);
        }
      } catch (updateError) {
        logError('Error updating failed payment status', updateError);
      }

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Payment failure recorded',
        orderId,
        paymentId,
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle refund events
    if (isValidStringType(type) && (type as string).startsWith('refund.')) {
      const refundId = refund?.id;
      const refundAmount = refund?.amount;
      const refundStatus = refund?.status;
      const parentPaymentId = refund?.payment_id;
      
      logInfo('Refund event', { 
        refundId, 
        refundAmount, 
        refundStatus, 
        parentPaymentId,
        eventType: type 
      });

      // Log refund for audit purposes
      try {
        // You can add refund tracking table if needed
        logInfo('Refund processed', {
          refundId,
          amount: refundAmount,
          status: refundStatus,
          parentPayment: parentPaymentId
        });
      } catch (refundError) {
        logError('Error processing refund event', refundError);
      }

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Refund event processed',
        refundId,
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Auto-Top-Up mandate cancelled/paused from the UPI app or bank: turn it off on the website.
    if (isValidStringType(type) && ['token.cancelled', 'token.paused', 'token.rejected'].includes(type as string)) {
      const tokenId = (event as any)?.payload?.token?.entity?.id;
      if (tokenId && supabase) {
        await supabase.from('api_auto_topup_settings').update({ mandate_status: 'none', razorpay_token_id: null, enabled: false, updated_at: new Date().toISOString() }).eq('razorpay_token_id', tokenId);
      }
      return new Response(JSON.stringify({ status: 'acknowledged', tokenId, requestId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle subscription events
    if (isValidStringType(type) && (type as string).startsWith('subscription.')) {
      const subscriptionId = subscription?.id;
      const subscriptionStatus = subscription?.status;
      
      logInfo('Subscription event', { 
        subscriptionId, 
        subscriptionStatus,
        eventType: type 
      });

      // Developer API auto-pay: active only while paid; failed/halted renewal turns it off
      try {
        if (subscriptionId && supabase) {
          const t = type as string;
          const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (t === 'subscription.charged' && payment?.status === 'captured') {
            upd.status = 'active';
            upd.payment_id = payment.id;
            const end = subscription?.current_end;
            upd.expires_at = new Date((end ? end * 1000 : Date.now() + 30 * 86400000) + 86400000).toISOString();
          } else if (['subscription.halted', 'subscription.pending'].includes(t)) {
            upd.status = 'past_due';
          } else if (t === 'subscription.cancelled' || t === 'subscription.completed') {
            upd.status = t.split('.')[1];
          } else if (t === 'subscription.paused') {
            upd.status = 'paused';
          }
          if (upd.status) await supabase.from('api_subscriptions').update(upd).eq('subscription_id', subscriptionId).neq('payment_mode', 'manual');
        }
      } catch (e) { logInfo('api_subscriptions update failed', { error: String(e) }); }

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Subscription event processed',
        subscriptionId,
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle dispute events
    if (isValidStringType(type) && (type as string).startsWith('payment.dispute.')) {
      const disputeId = payment?.id;
      
      logInfo('Dispute event', { 
        disputeId,
        eventType: type 
      });

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Dispute event processed',
        disputeId,
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle downtime events
    if (isValidStringType(type) && (type as string).startsWith('payment.downtime.')) {
      logInfo('Downtime event', { eventType: type });

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Downtime event processed',
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle account events
    if (isValidStringType(type) && (type as string).startsWith('account.')) {
      logInfo('Account event', { eventType: type });

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Account event processed',
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle invoice events
    if (isValidStringType(type) && (type as string).startsWith('invoice.')) {
      logInfo('Invoice event', { eventType: type });
      try { await applyInvoiceWebhook(supabase, type, event?.payload?.invoice?.entity, payment); }
      catch (e) { logError('Invoice status update failed', e); }

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Invoice event processed',
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle fund account events
    if (isValidStringType(type) && (type as string).startsWith('fund_account.')) {
      logInfo('Fund account event', { eventType: type });

      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Fund account event processed',
        requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

          // Points wallet system removed — payments are settled directly via Razorpay
          // in their respective verify endpoints. This webhook only records the
          // transaction outcome below.

          // Process referral commission before marking transaction as complete
          try {
            // Check if user has a referrer
            const { data: referralData } = await supabase
              .from('user_referrals')
              .select('referrer_id')
              .eq('referred_user_id', txn.user_id)
              .eq('is_active', true)
              .maybeSingle();

            if (referralData?.referrer_id) {
              // Get referrer info for Telegram notification
              const { data: referrerProfile } = await supabase
                .from('profiles')
                .select('full_name, telegram_chat_id')
                .eq('user_id', referralData.referrer_id)
                .maybeSingle();

              const { data: referrerCompany } = await supabase
                .from('companies')
                .select('company_name, telegram_chat_id')
                .eq('user_id', referralData.referrer_id)
                .maybeSingle();

              const { data: referredProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', txn.user_id)
                .maybeSingle();

              const { data: referredCompany } = await supabase
                .from('companies')
                .select('company_name')
                .eq('user_id', txn.user_id)
                .maybeSingle();

              // Process the commission
              await supabase.rpc('process_referral_commission', {
                p_referred_user_id: txn.user_id,
                p_payment_amount: txn.amount,
                p_payment_id: paymentId,
                p_source_type: 'payment'
              });
              logInfo('Referral commission processed', { userId: txn.user_id, amount: txn.amount });

              // Send Telegram notification to referrer about reward
              const referrerChatId = referrerCompany?.telegram_chat_id || referrerProfile?.telegram_chat_id;
              // The reward belongs to the REFERRER, so the side is decided by who
              // referred — an employer referrer gets employer templates/bot.
              const isReferrerEmployer = !!referrerCompany;
              const referrerName = (isReferrerEmployer ? referrerCompany?.company_name : referrerProfile?.full_name)
                || referrerProfile?.full_name || referrerCompany?.company_name || 'User';
              const referredName = referredProfile?.full_name || referredCompany?.company_name || 'User';
              
              // Fetch actual commission percentage from settings
              const { data: refSettings } = await supabase
                .from('referral_settings')
                .select('commission_percentage')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              const commissionPercentage = refSettings?.commission_percentage || 50;
              const commissionAmount = Math.round(txn.amount * (commissionPercentage / 100));

              {
                try {
                  await notifyEvent(supabase, {
                    eventType: isReferrerEmployer ? 'employer_referral_reward' : 'user_referral_reward',
                    userId: referralData.referrer_id,
                    audience: isReferrerEmployer ? 'employer' : 'job_seeker',
                    name: referrerName,
                    variables: {
                      referral_name: referredName,
                      amount: `₹${commissionAmount}`,
                    },
                    fallbackTitle: '💸 Referral Earning Credited',
                    fallbackMessage: `You earned ₹${commissionAmount} from ${referredName}.`,
                  });
                  logInfo('Referral reward notification sent', { referrerId: referralData.referrer_id });
                } catch (notifError) {
                  logError('Failed to send referral reward notification', notifError);
                }
              }
            } else {
              // No referrer, just process commission (will return early in RPC)
              await supabase.rpc('process_referral_commission', {
                p_referred_user_id: txn.user_id,
                p_payment_amount: txn.amount,
                p_payment_id: paymentId,
                p_source_type: 'payment'
              });
            }
          } catch (commissionError) {
            logError('Referral commission processing failed', commissionError);
            // Don't fail the webhook for commission errors
          }

          // Mark transaction as successful
          const { error: updErr } = await supabase
            .from('transactions')
            .update({ 
              razorpay_payment_id: paymentId, 
              status: 'success', 
              updated_at: new Date().toISOString(),
              metadata: {
                webhook_processed_at: new Date().toISOString(),
                request_id: requestId
              }
            })
            .eq('razorpay_order_id', orderId)
            .eq('status', 'pending');
            
          if (updErr) {
            logError('Transaction update warning', updErr);
            // Don't fail the webhook for this - points already added
          }

          const processingTime = Date.now() - startTime;
          logInfo('User payment processed successfully', { 
            orderId, 
            paymentId, 
            userId: txn.user_id, 
            points: txn.points,
            processingTimeMs: processingTime
          });

          // Payment success → push + email + Telegram (owner templates)
          try {
            // Every user has a profiles row, so ONLY a companies row proves employer.
            const { data: company } = await supabase
              .from('companies').select('company_name').eq('user_id', txn.user_id).maybeSingle();
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', txn.user_id)
              .maybeSingle();

            const isEmployer = !!company;
            const displayName = company?.company_name || profile?.full_name || undefined;

            await notifyEvent(supabase, {
              eventType: isEmployer ? 'employer_payment_success' : 'user_payment_success',
              userId: txn.user_id,
              audience: isEmployer ? 'employer' : 'job_seeker',
              name: displayName,
              variables: {
                amount: `₹${txn.amount}`,
                points: txn.points ?? undefined,
                order_id: paymentId,
                plan: txn.package_name || 'Points Package',
              },
              fallbackTitle: '✅ Payment Successful',
              fallbackMessage: `Your payment of ₹${txn.amount} was successful.`,
            });
            logInfo('📣 Payment success notification sent');
          } catch (notifyError) {
            logError('Error sending payment success notification', notifyError);
          }
          
          return new Response(JSON.stringify({ 
            status: 'success',
            message: 'Payment processed successfully',
            requestId,
            processingTimeMs: processingTime
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (userTxnError) {
        logError('User transaction processing failed', userTxnError);
        // Continue to check guest transactions as fallback
      }

      // Try guest transactions as fallback
      try {
        logInfo('Looking up guest transaction', { orderId });
        
        const { data: guest, error: guestErr } = await supabase
          .from('guest_transactions')
          .select('*')
          .eq('razorpay_order_id', orderId)
          .eq('status', 'pending')
          .maybeSingle();

        if (guestErr) {
          logError('Guest transaction lookup error', guestErr);
          throw new Error(`Guest transaction lookup failed: ${guestErr.message}`);
        }

        if (guest) {
          logInfo('Guest transaction found', { 
            transactionId: guest.id, 
            email: guest.email,
            amount: guest.amount
          });

          const { error: gUpdErr } = await supabase
            .from('guest_transactions')
            .update({ 
              razorpay_payment_id: paymentId, 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              metadata: {
                webhook_processed_at: new Date().toISOString(),
                request_id: requestId
              }
            })
            .eq('razorpay_order_id', orderId)
            .eq('status', 'pending');
            
          if (gUpdErr) {
            logError('Guest transaction update error', gUpdErr);
            throw new Error(`Guest transaction update failed: ${gUpdErr.message}`);
          }

          const processingTime = Date.now() - startTime;
          logInfo('Guest payment processed successfully', { 
            orderId, 
            paymentId, 
            email: guest.email,
            processingTimeMs: processingTime
          });
          
          return new Response(JSON.stringify({ 
            status: 'success',
            message: 'Guest payment processed successfully',
            requestId,
            processingTimeMs: processingTime
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (guestTxnError) {
        logError('Guest transaction processing failed', guestTxnError);
      }

      // No matching transaction found
      logError('No matching transaction found for webhook', { 
        orderId, 
        paymentId, 
        eventType: type 
      });
      
      return new Response(JSON.stringify({ 
        status: 'acknowledged',
        message: 'Transaction not found - webhook ignored',
        orderId,
        paymentId,
        requestId 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle other event types
    logInfo('Non-payment event received', { type });
    
    return new Response(JSON.stringify({ 
      status: 'acknowledged',
      message: `Event ${type} acknowledged but not processed`,
      requestId 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    const processingTime = Date.now() - startTime;
    logError('Webhook processing failed', {
      error: e instanceof Error ? e.message : 'Unknown error',
      stack: e instanceof Error ? e.stack : undefined,
      processingTimeMs: processingTime
    });
    
    // Always return 200 to prevent webhook disable, but log the error
    return new Response(JSON.stringify({ 
      status: 'error_acknowledged',
      error: 'Internal processing error',
      requestId,
      processingTimeMs: processingTime
    }), { 
      status: 200, // Return 200 to prevent Razorpay from disabling webhook
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});