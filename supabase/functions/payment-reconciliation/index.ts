import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  created_at: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({
        error: 'Razorpay credentials not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      // Get reconciliation report
      const url = new URL(req.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const autoFix = url.searchParams.get('auto_fix') === 'true';
      const markExpired = url.searchParams.get('mark_expired') === 'true';

      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // First, mark expired payments as failed if requested
      let expiredCount = 0;
      if (markExpired) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // Update expired transactions
        const { data: expiredTransactions, error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('status', 'pending')
          .lt('created_at', fiveMinutesAgo)
          .select('id');

        if (!updateError && expiredTransactions) {
          expiredCount += expiredTransactions.length;
        }

        // Update expired job boosts
        const { data: expiredBoosts } = await supabase
          .from('job_boosts')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('status', 'pending')
          .lt('created_at', fiveMinutesAgo)
          .select('id');

        if (expiredBoosts) {
          expiredCount += expiredBoosts.length;
        }

        // Update expired verification purchases
        const { data: expiredVerifications } = await supabase
          .from('verification_purchases')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('status', 'pending')
          .lt('created_at', fiveMinutesAgo)
          .select('id');

        if (expiredVerifications) {
          expiredCount += expiredVerifications.length;
        }

        console.log(`✅ Marked ${expiredCount} expired payments as failed`);
      }

      // Get pending transactions
      const { data: pendingTxns } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .gte('created_at', cutoffTime.toISOString());

      const { data: pendingGuest } = await supabase
        .from('guest_transactions')
        .select('*')
        .eq('status', 'pending')
        .gte('created_at', cutoffTime.toISOString());

  const reconciliationResults: {
    timestamp: string;
    period_hours: number;
    expired_payments_marked_failed: number;
    pending_user_transactions: number;
    pending_guest_transactions: number;
    transactions_checked: Array<{
      order_id: any;
      payment_id?: string;
      status: string;
      amount_match?: boolean;
      payments_found?: number;
      user_id?: any;
      points?: any;
      error?: any;
    }>;
    auto_fixed: Array<{
      order_id: any;
      payment_id: string;
      user_id: any;
    }>;
  } = {
        timestamp: new Date().toISOString(),
        period_hours: hours,
        expired_payments_marked_failed: expiredCount,
        pending_user_transactions: pendingTxns?.length || 0,
        pending_guest_transactions: pendingGuest?.length || 0,
        transactions_checked: [],
        auto_fixed: []
      };

      // Check each pending transaction with Razorpay
      if (pendingTxns && pendingTxns.length > 0) {
        for (const txn of pendingTxns) {
          try {
            // Create basic auth header for Razorpay API
            const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
            
            const response = await fetch(
              `https://api.razorpay.com/v1/orders/${txn.razorpay_order_id}/payments`,
              {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (response.ok) {
              const data = await response.json();
              const payments = data.items as RazorpayPayment[];
              const capturedPayment = payments.find(p => p.status === 'captured');

              if (capturedPayment) {
                reconciliationResults.transactions_checked.push({
                  order_id: txn.razorpay_order_id,
                  payment_id: capturedPayment.id,
                  status: 'payment_found_captured',
                  amount_match: capturedPayment.amount === txn.amount * 100
                });

                // Auto-fix if requested
                if (autoFix) {
                  try {
                    // Update transaction
                    await supabase
                      .from('transactions')
                      .update({
                        razorpay_payment_id: capturedPayment.id,
                        status: 'success',
                        updated_at: new Date().toISOString(),
                        metadata: {
                          auto_reconciled: true,
                          reconciled_at: new Date().toISOString()
                        }
                      })
                      .eq('id', txn.id);

                    reconciliationResults.auto_fixed.push({
                      order_id: txn.razorpay_order_id,
                      payment_id: capturedPayment.id,
                      user_id: txn.user_id
                    });
                  } catch (fixError) {
                    console.error('Auto-fix failed for', txn.razorpay_order_id, fixError);
                  }
                }
              } else {
                reconciliationResults.transactions_checked.push({
                  order_id: txn.razorpay_order_id,
                  status: 'no_captured_payment',
                  payments_found: payments.length
                });
              }
            }
          } catch (apiError) {
            reconciliationResults.transactions_checked.push({
              order_id: txn.razorpay_order_id,
              status: 'api_error',
              error: apiError instanceof Error ? apiError.message : 'Unknown API error'
            });
          }

          // Rate limiting - wait between API calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return new Response(JSON.stringify(reconciliationResults, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Manual reconciliation for specific order
      const { orderId, checkRazorpay } = await req.json();
      
      if (!orderId) {
        return new Response(JSON.stringify({
          error: 'Missing orderId'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let razorpayStatus = null;
      
      if (checkRazorpay) {
        try {
          const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
          const response = await fetch(
            `https://api.razorpay.com/v1/orders/${orderId}/payments`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const payments = data.items as RazorpayPayment[];
            razorpayStatus = {
              total_payments: payments.length,
              captured_payments: payments.filter(p => p.status === 'captured'),
              failed_payments: payments.filter(p => p.status === 'failed')
            };
          }
        } catch (error) {
          razorpayStatus = { error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }

      // Get local transaction status
      const { data: localTxn } = await supabase
        .from('transactions')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      const { data: localGuest } = await supabase
        .from('guest_transactions')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      return new Response(JSON.stringify({
        order_id: orderId,
        local_user_transaction: localTxn,
        local_guest_transaction: localGuest,
        razorpay_status: razorpayStatus,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});