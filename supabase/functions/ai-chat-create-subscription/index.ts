import { ensureRazorpayCustomer, linkRazorpayOrder } from "../_shared/razorpayCustomer.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 AI Chat Subscription - Starting request');
    
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

    if (!user?.email) {
      console.error('❌ User not authenticated');
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    const { plan_id } = await req.json();
    console.log('📋 Plan ID requested:', plan_id);

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from('ai_chat_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      console.error('❌ Plan not found:', planError);
      throw new Error('Invalid plan');
    }

    console.log('💰 Plan details:', plan.name, 'Price:', plan.price_inr);

    // Create service client for database operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already has this exact plan active
    const { data: existingActiveSub } = await serviceClient
      .from('ai_chat_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_id', plan.id)
      .eq('status', 'active')
      .gte('ends_at', new Date().toISOString())
      .maybeSingle();

    if (existingActiveSub) {
      console.log('✅ User already has this plan active, returning existing subscription');
      return new Response(
        JSON.stringify({ 
          success: true, 
          subscription: existingActiveSub, 
          message: 'Plan already active' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If free plan, just create subscription without payment
    if (plan.price_inr === 0) {
      console.log('🆓 Free plan selected - Creating subscription directly');

      // Cancel any existing active subscription
      await serviceClient
        .from('ai_chat_subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Create new free subscription
      const { data: subscription, error: subError } = await serviceClient
        .from('ai_chat_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (subError) {
        console.error('❌ Error creating free subscription:', subError);
        throw subError;
      }

      console.log('✅ Free subscription created successfully');
      return new Response(
        JSON.stringify({ success: true, subscription }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For paid plans, create Razorpay order
    console.log('💳 Paid plan - Creating Razorpay order');
    
    const rawKeyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
    const rawKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    const razorpayKeyId = rawKeyId.trim();
    const razorpayKeySecret = rawKeySecret.trim();

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials missing', { 
        hasKeyId: !!razorpayKeyId, 
        hasKeySecret: !!razorpayKeySecret 
      });
      throw new Error('Razorpay credentials not configured');
    }

    console.log('🔐 Using Razorpay credentials', { 
      keyIdPreview: razorpayKeyId.substring(0, 8) + '...',
      keyIdLength: razorpayKeyId.length,
      keySecretLength: razorpayKeySecret.length 
    });

    const orderAmount = plan.price_inr * 100; // Convert to paise
    const rzpCustomerId = await ensureRazorpayCustomer(user);
    const orderPayload = {
      ...(rzpCustomerId ? { customer_id: rzpCustomerId } : {}),
      amount: orderAmount,
      currency: 'INR',
      notes: {
        user_id: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        type: 'ai_chat_subscription'
      }
    };

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    console.log('🔐 Basic auth preview (first 12 chars):', basicAuth.substring(0, 12) + '...', 'len:', basicAuth.length);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ Razorpay API error:', errorText);
      throw new Error(`Razorpay order creation failed: ${errorText}`);
    }

    const razorpayOrder = await razorpayResponse.json();
    await linkRazorpayOrder({ userId: user.id, customerId: rzpCustomerId, orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, purpose: 'ai_chat_subscription' });
    console.log('✅ Razorpay order created:', razorpayOrder.id);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: razorpayKeyId,
        customer_id: rzpCustomerId,
        plan: {
          id: plan.id,
          name: plan.name,
          price_inr: plan.price_inr
        }
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
