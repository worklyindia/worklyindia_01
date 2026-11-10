import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyPayment } from "../_shared/paymentNotify.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing authorization');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseService.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseService
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!['owner', 'admin'].includes(adminUser?.role || '')) {
      throw new Error('Admin access required');
    }

    const body = await req.json();
    
    // Support both old and new parameter names
    const action = body.action || 'recover'; // 'check' or 'recover'
    const razorpay_payment_id = body.razorpay_payment_id || body.paymentId;
    const razorpay_order_id = body.razorpay_order_id || body.orderId;
    const transaction_id = body.transaction_id || body.transactionId;

    console.log('Request params:', { action, razorpay_payment_id, razorpay_order_id, transaction_id });

    if (!razorpay_payment_id && !razorpay_order_id && !transaction_id) {
      throw new Error('Provide razorpay_payment_id, razorpay_order_id, or transaction_id');
    }

    // Find the transaction
    let query = supabaseService.from('transactions').select('*');
    
    if (transaction_id) {
      query = query.eq('id', transaction_id);
    } else if (razorpay_order_id) {
      query = query.eq('razorpay_order_id', razorpay_order_id);
    } else if (razorpay_payment_id) {
      query = query.eq('razorpay_payment_id', razorpay_payment_id);
    }

    const { data: transaction, error: txnError } = await query.single();

    if (txnError || !transaction) {
      console.error('Transaction lookup error:', txnError);
      throw new Error('Transaction not found');
    }

    console.log('Found transaction:', {
      id: transaction.id,
      status: transaction.status,
      user_id: transaction.user_id,
      points: transaction.points,
      amount: transaction.amount,
      razorpay_order_id: transaction.razorpay_order_id
    });

    // If already successful, return info
    if (transaction.status === 'success') {
      return new Response(JSON.stringify({
        success: true,
        status: 'already_processed',
        message: 'This transaction has already been processed successfully',
        transaction
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify payment with Razorpay API
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    let paymentStatus = null;
    let paymentData = null;

    // If we have payment_id, verify directly
    if (razorpay_payment_id || transaction.razorpay_payment_id) {
      const paymentIdToCheck = razorpay_payment_id || transaction.razorpay_payment_id;
      
      console.log('Checking payment by ID:', paymentIdToCheck);
      
      const paymentResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${paymentIdToCheck}`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`
          }
        }
      );

      if (paymentResponse.ok) {
        paymentData = await paymentResponse.json();
        paymentStatus = paymentData.status;
        console.log('Razorpay payment status:', paymentStatus);
      } else {
        console.log('Payment lookup failed:', paymentResponse.status);
      }
    }

    // If we have order_id, check order payments
    if (!paymentStatus && transaction.razorpay_order_id) {
      console.log('Checking payments by order ID:', transaction.razorpay_order_id);
      
      const orderResponse = await fetch(
        `https://api.razorpay.com/v1/orders/${transaction.razorpay_order_id}/payments`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`
          }
        }
      );

      if (orderResponse.ok) {
        const orderPayments = await orderResponse.json();
        console.log('Order payments found:', orderPayments.items?.length || 0);
        
        const capturedPayment = orderPayments.items?.find(
          (p: any) => p.status === 'captured'
        );
        
        if (capturedPayment) {
          paymentData = capturedPayment;
          paymentStatus = 'captured';
          console.log('Found captured payment for order:', capturedPayment.id);
        } else {
          // Check for any payment status
          const anyPayment = orderPayments.items?.[0];
          if (anyPayment) {
            paymentData = anyPayment;
            paymentStatus = anyPayment.status;
            console.log('Found payment with status:', paymentStatus);
          }
        }
      } else {
        console.log('Order payments lookup failed:', orderResponse.status);
      }
    }

    // If just checking status, return the result
    if (action === 'check') {
      return new Response(JSON.stringify({
        success: true,
        status: paymentStatus || 'unknown',
        message: paymentStatus === 'captured' 
          ? '✅ Payment is captured! You can recover this payment.'
          : paymentStatus 
            ? `Payment status: ${paymentStatus}`
            : 'No payment found for this order',
        razorpay_status: paymentStatus,
        payment_id: paymentData?.id,
        transaction
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the captured payment belongs to this exact local order and amount.
    if (paymentStatus === 'captured') {
      const expectedPaise = Math.round(Number(transaction.amount) * 100);
      if (!transaction.razorpay_order_id || paymentData.order_id !== transaction.razorpay_order_id ||
          Number(paymentData.amount) !== expectedPaise || paymentData.currency !== 'INR') {
        throw new Error('Captured payment does not match the local order, amount and currency');
      }

      // Update transaction status
      const { error: updateError } = await supabaseService
        .from('transactions')
        .update({
          razorpay_payment_id: paymentData?.id || transaction.razorpay_payment_id,
          status: 'success',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Transaction update error:', updateError);
      }

      // Log admin action
      await supabaseService.from('admin_audit_logs').insert({
        action: 'recover_payment',
        performed_by: user.id,
        target_id: transaction.id,
        target_type: 'transaction',
        details: {
          transaction_id: transaction.id,
          user_id: transaction.user_id,
          amount: transaction.amount,
          razorpay_payment_id: paymentData?.id,
          recovered_at: new Date().toISOString()
        }
      });

      // Send notification to user
      await notifyPayment(supabaseService, {
        userId: transaction.user_id,
        success: true,
        method: 'razorpay',
        transactionType: 'purchase',
        itemName: 'Payment (recovered)',
        amountInr: Number(transaction.amount) || 0,
        paymentId: paymentData?.id || null,
        actionUrl: '/payment-history',
      });

      console.log(`✅ Payment recovered for user ${transaction.user_id}`);

      return new Response(JSON.stringify({
        success: true,
        status: 'recovered',
        message: 'Payment recovered successfully',
        user_id: transaction.user_id,
        razorpay_payment_id: paymentData?.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({
        success: false,
        status: 'not_captured',
        message: `Payment status is "${paymentStatus || 'unknown'}". Cannot recover - payment was not captured in Razorpay.`,
        razorpay_status: paymentStatus,
        transaction
      }), {
        status: 200, // Return 200 so frontend doesn't show generic error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Recovery error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Recovery failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
