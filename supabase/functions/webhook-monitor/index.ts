import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Always return 200 OK for OPTIONS to prevent webhook auto-disable
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'GET') {
      // Webhook health monitoring
      const url = new URL(req.url);
      const action = url.searchParams.get('action') || 'status';

      if (action === 'status') {
        // Get webhook processing statistics
        const { data: recentWebhooks } = await supabase
          .from('transactions')
          .select('status, created_at, updated_at, razorpay_payment_id')
          .order('created_at', { ascending: false })
          .limit(100);

        const { data: recentGuest } = await supabase
          .from('guest_transactions')
          .select('status, created_at, completed_at, razorpay_payment_id')
          .order('created_at', { ascending: false })
          .limit(50);

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const recentSuccess = recentWebhooks?.filter(t => 
          t.status === 'success' && new Date(t.updated_at) > oneHourAgo
        ).length || 0;

        const recentPending = recentWebhooks?.filter(t => 
          t.status === 'pending' && new Date(t.created_at) > oneDayAgo
        ).length || 0;

        const guestSuccess = recentGuest?.filter(t => 
          t.status === 'completed' && t.completed_at && new Date(t.completed_at) > oneHourAgo
        ).length || 0;

        const stats = {
          webhook_health: 'operational',
          timestamp: now.toISOString(),
          last_hour: {
            successful_payments: recentSuccess + guestSuccess,
            pending_payments: recentPending
          },
          webhook_url: 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/razorpay-webhook',
          status_checks: {
            environment_variables: {
              webhook_secret: !!Deno.env.get('RAZORPAY_WEBHOOK_SECRET'),
              supabase_url: !!Deno.env.get('SUPABASE_URL'),
              supabase_key: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            }
          }
        };

        return new Response(JSON.stringify(stats, null, 2), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'test') {
        // Test webhook endpoint connectivity
        try {
          const webhookResponse = await fetch(
            'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/razorpay-webhook',
            { method: 'GET' }
          );
          
          const result = {
            webhook_test: 'success',
            status_code: webhookResponse.status,
            response_ok: webhookResponse.ok,
            timestamp: new Date().toISOString()
          };

          return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          // Return 200 even on error to prevent webhook auto-disable
          return new Response(JSON.stringify({
            webhook_test: 'failed',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    if (req.method === 'POST') {
      // Manual payment completion for failed webhooks
      const { orderId, paymentId, forceComplete } = await req.json();
      
      if (!orderId || !paymentId) {
        return new Response(JSON.stringify({ 
          error: 'Missing orderId or paymentId' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Try to complete the payment manually
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (txnErr) {
        return new Response(JSON.stringify({ 
          error: 'Transaction lookup failed',
          details: txnErr.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (txn && (txn.status === 'pending' || forceComplete)) {
        // Update transaction
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ 
            razorpay_payment_id: paymentId, 
            status: 'success', 
            updated_at: new Date().toISOString(),
            metadata: {
              manually_completed: true,
              completed_at: new Date().toISOString()
            }
          })
          .eq('razorpay_order_id', orderId);

        if (updErr) {
          return new Response(JSON.stringify({ 
            error: 'Transaction update failed',
            details: updErr.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Payment completed manually',
          orderId,
          paymentId,
          userId: txn.user_id
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Return 200 to prevent webhook auto-disable
      return new Response(JSON.stringify({ 
        error: 'Transaction not found or already completed' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return 200 to prevent webhook auto-disable
    return new Response(JSON.stringify({ 
      error: 'Method not allowed' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // CRITICAL: Always return 200 OK to prevent Razorpay from auto-disabling webhook
    // Razorpay disables webhooks after multiple 4xx/5xx responses
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});