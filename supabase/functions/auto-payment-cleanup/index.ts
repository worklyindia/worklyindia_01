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
    console.log("🔄 Starting automatic payment cleanup...");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));

    // Clean up pending transactions older than 12 hours
    const { data: pendingTransactions, error: fetchError } = await supabaseService
      .from('transactions')
      .select('id, razorpay_order_id, user_id, amount, points, created_at')
      .eq('status', 'pending')
      .lt('created_at', twelveHoursAgo.toISOString());

    if (fetchError) {
      console.error("Error fetching pending transactions:", fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${pendingTransactions?.length || 0} stale pending transactions`);

    if (pendingTransactions && pendingTransactions.length > 0) {
      // Mark stale transactions as failed
      const transactionIds = pendingTransactions.map(t => t.id);
      
      const { error: updateError } = await supabaseService
        .from('transactions')
        .update({
          status: 'failed',
          updated_at: now.toISOString(),
          metadata: {
            auto_cleanup: true,
            cleaned_at: now.toISOString(),
            reason: 'Payment timeout - auto-cleanup after 12 hours'
          }
        })
        .in('id', transactionIds);

      if (updateError) {
        console.error("Error updating stale transactions:", updateError);
        throw updateError;
      }

      console.log(`✅ Marked ${transactionIds.length} transactions as failed`);
    }

    // Clean up pending job boosts older than 12 hours
    const { data: pendingBoosts, error: boostFetchError } = await supabaseService
      .from('job_boosts')
      .select('id, user_id, job_id, amount_paid, created_at')
      .eq('status', 'pending')
      .lt('created_at', twelveHoursAgo.toISOString());

    if (boostFetchError) {
      console.error("Error fetching pending boosts:", boostFetchError);
    } else if (pendingBoosts && pendingBoosts.length > 0) {
      const boostIds = pendingBoosts.map(b => b.id);
      
      const { error: boostUpdateError } = await supabaseService
        .from('job_boosts')
        .update({
          status: 'failed',
          updated_at: now.toISOString()
        })
        .in('id', boostIds);

      if (boostUpdateError) {
        console.error("Error updating stale boosts:", boostUpdateError);
      } else {
        console.log(`✅ Marked ${boostIds.length} job boosts as failed`);
      }
    }

    // Clean up pending verification purchases older than 12 hours
    const { data: pendingVerifications, error: verificationFetchError } = await supabaseService
      .from('verification_purchases')
      .select('id, user_id, amount_paid, created_at')
      .eq('status', 'pending')
      .lt('created_at', twelveHoursAgo.toISOString());

    if (verificationFetchError) {
      console.error("Error fetching pending verifications:", verificationFetchError);
    } else if (pendingVerifications && pendingVerifications.length > 0) {
      const verificationIds = pendingVerifications.map(v => v.id);
      
      const { error: verificationUpdateError } = await supabaseService
        .from('verification_purchases')
        .update({
          status: 'failed',
          updated_at: now.toISOString()
        })
        .in('id', verificationIds);

      if (verificationUpdateError) {
        console.error("Error updating stale verifications:", verificationUpdateError);
      } else {
        console.log(`✅ Marked ${verificationIds.length} verification purchases as failed`);
      }
    }

    const summary = {
      cleaned_at: now.toISOString(),
      transactions_cleaned: pendingTransactions?.length || 0,
      boosts_cleaned: pendingBoosts?.length || 0,
      verifications_cleaned: pendingVerifications?.length || 0,
      total_cleaned: (pendingTransactions?.length || 0) + (pendingBoosts?.length || 0) + (pendingVerifications?.length || 0)
    };

    console.log("🎯 Cleanup completed:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment cleanup completed successfully",
        summary
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Error in auto-payment-cleanup:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Auto cleanup failed' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});