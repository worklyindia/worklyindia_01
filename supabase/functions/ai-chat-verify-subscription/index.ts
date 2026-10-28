import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { resolveUserEmail, sendPaymentReceiptEmail } from "../_shared/paymentReceiptEmail.ts";
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';
import { notifyPayment } from '../_shared/paymentNotify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 AI Chat Payment Verification - Starting');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No Authorization header found');
      throw new Error('Unauthorized');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      console.error('❌ User not authenticated');
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id
    } = await req.json();

    console.log('📋 Payment details:', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      plan_id
    });

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!razorpayKeySecret) {
      console.error('❌ Razorpay secret not configured');
      throw new Error('Razorpay secret not configured');
    }

    console.log('🔐 Verifying payment signature...');
    
    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(razorpayKeySecret);
    const algorithm = { name: 'HMAC', hash: 'SHA-256' };

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      algorithm,
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      algorithm.name,
      key,
      encoder.encode(text)
    );

    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Invalid payment signature');
      try {
        const failClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await notifyPayment(failClient, {
          userId: user.id,
          success: false,
          method: 'razorpay',
          transactionType: 'subscription',
          itemName: 'AI Career Chat Subscription',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          actionUrl: '/ai-chat-subscription',
          failureReason: 'Payment verification failed. Any amount deducted will be refunded automatically.',
        });
      } catch (_) { /* best effort */ }
      throw new Error('Invalid payment signature');
    }

    console.log('✅ Payment signature verified');

    // Payment verified, create subscription
    console.log('💾 Creating subscription in database...');
    
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Cancel any existing active subscription
    console.log('🔄 Cancelling existing active subscriptions...');
    await serviceClient
      .from('ai_chat_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Create new subscription
    const { data: subscription, error: subError } = await serviceClient
      .from('ai_chat_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        status: 'active',
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        razorpay_order_id,
        razorpay_payment_id
      })
      .select()
      .single();

    if (subError) {
      console.error('❌ Error creating subscription:', subError);
      throw subError;
    }

    console.log('✅ Subscription created:', subscription.id);

    // Reset usage counts
    console.log('🔄 Resetting usage counts...');
    await serviceClient
      .from('ai_chat_usage')
      .delete()
      .eq('user_id', user.id);

    console.log('✅ Payment verification complete');

    // Payment success notification (in-app + push)
    try {
      const { data: planRow } = await serviceClient
        .from('ai_chat_plans').select('name, price_inr').eq('id', plan_id).maybeSingle();
      await notifyPayment(serviceClient, {
        userId: user.id,
        success: true,
        method: 'razorpay',
        transactionType: 'subscription',
        itemName: `${planRow?.name || 'AI Chat Plan'} (valid till ${new Date(subscription.ends_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })})`,
        amountInr: Number(planRow?.price_inr) || 0,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        actionUrl: '/ai-chat-subscription',
      });
    } catch (e) { console.error('[ai-chat-verify] notification failed:', e); }


    // Send payment receipt email (best-effort)
    try {
      const { data: plan } = await serviceClient
        .from('ai_chat_plans').select('name, price_inr').eq('id', plan_id).maybeSingle();
      const { email, name } = await resolveUserEmail(serviceClient, user.id);
      await sendPaymentReceiptEmail(serviceClient, email || user.email || null, name, {
        paymentType: 'AI Career Chat Subscription',
        planName: plan?.name || 'AI Chat Plan',
        amountInr: Number(plan?.price_inr) || 0,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        extras: [{ label: 'Valid Until', value: new Date(subscription.ends_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) }],
        ctaUrl: `${WEBSITE_DOMAIN}/ai-chat-subscription`,
        ctaLabel: 'Open AI Career Chat',
      });
    } catch (e) { console.error('[ai-chat-verify] receipt email failed:', e); }

    return new Response(
      JSON.stringify({
        status: 'success',
        subscription
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
