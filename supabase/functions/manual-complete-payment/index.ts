import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // SECURITY: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseService.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Not authenticated');
    }

    console.log(`Manual payment request from user: ${user.id}`);

    // Verify the authenticated user's server-side admin role.
    const { data: adminUser, error: adminError } = await supabaseService
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError || !['owner', 'admin'].includes(adminUser?.role || '')) {
      console.error('Admin verification failed:', adminError);
      throw new Error('Admin access required');
    }

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      throw new Error("Transaction ID is required");
    }

    console.log(`Manually completing transaction: ${transaction_id}`);

    // Get the pending transaction
    const { data: transaction, error: txnError } = await supabaseService
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('status', 'pending')
      .single();

    if (txnError || !transaction) {
      throw new Error('Transaction not found or already processed');
    }

    // NOTE: Points wallet system removed. This admin tool now only marks
    // the transaction as completed; it no longer credits any wallet.

    // Update transaction status
    const { error: updateError } = await supabaseService
      .from('transactions')
      .update({
        razorpay_payment_id: `pay_manual_${Date.now()}`,
        razorpay_signature: 'manual_completion',
        status: 'success',
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id);

    if (updateError) {
      console.error('Transaction update error:', updateError);
      throw new Error('Failed to update transaction status');
    }

    // Audit log for manual completion
    console.log('Transaction completed successfully by admin:', {
      admin_id: user.id,
      transaction_id,
      user_id: transaction.user_id,
      points: transaction.points,
      amount: transaction.amount,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      status: 'success',
      message: 'Payment completed manually',
      transaction_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Manual payment completion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to complete payment";
    
    // Determine appropriate status code
    const statusCode = errorMessage.includes('authenticated') || errorMessage.includes('Admin access') 
      ? 401 
      : errorMessage.includes('not found') 
      ? 404 
      : 400;

    return new Response(JSON.stringify({
      status: 'error',
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    });
  }
});