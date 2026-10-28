import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Handling subscription webhook");
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const razorpaySignature = req.headers.get("x-razorpay-signature");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    
    if (!razorpayKeySecret) {
      throw new Error("Razorpay secret not configured");
    }

    const payload = await req.text();
    
    // Verify webhook signature using HMAC-SHA256
    if (razorpaySignature) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(razorpayKeySecret);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payload)
      );
      
      const expectedSignatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log("Signature verification:", {
        expectedLength: expectedSignatureHex.length,
        receivedLength: razorpaySignature.length,
        bodyHash: expectedSignatureHex
      });

      if (expectedSignatureHex !== razorpaySignature) {
        console.error("Invalid webhook signature verification", {
          expectedLength: expectedSignatureHex.length,
          receivedLength: razorpaySignature.length,
          bodyHash: expectedSignatureHex
        });
        throw new Error("Invalid webhook signature");
      }
      
      console.log("✅ Webhook signature verified successfully");
    }

    const event = JSON.parse(payload);
    console.log("Webhook event:", event.event);

    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (!subscriptionId) {
      throw new Error("No subscription ID in webhook");
    }

    // Handle different events
    switch (event.event) {
      case "subscription.halted":
      case "subscription.pending":
        await supabaseClient.from('api_subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('subscription_id', subscriptionId);
        break;

      case "subscription.charged":
        console.log("Subscription charged successfully");
        await supabaseClient
          .from('api_subscriptions')
          .update({
            status: 'active',
            expires_at: new Date(((event.payload?.subscription?.entity?.current_end || Date.now() / 1000 + 30 * 86400) * 1000) + 86400000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        break;

      case "subscription.completed":
        console.log("Subscription completed");
        await supabaseClient
          .from('api_subscriptions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        
        // Downgrade API keys to free tier
        const { data: subscription } = await supabaseClient
          .from('api_subscriptions')
          .select('user_id')
          .eq('subscription_id', subscriptionId)
          .single();

        if (subscription) {
          await supabaseClient
            .from('api_keys')
            .update({ rate_limit_tier: 'free' })
            .eq('user_id', subscription.user_id)
            .eq('rate_limit_tier', 'pro');
        }
        break;

      case "subscription.cancelled":
        console.log("Subscription cancelled");
        await supabaseClient
          .from('api_subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        
        // Downgrade API keys
        const { data: cancelledSub } = await supabaseClient
          .from('api_subscriptions')
          .select('user_id')
          .eq('subscription_id', subscriptionId)
          .single();

        if (cancelledSub) {
          await supabaseClient
            .from('api_keys')
            .update({ rate_limit_tier: 'free' })
            .eq('user_id', cancelledSub.user_id)
            .eq('rate_limit_tier', 'pro');
        }
        break;

      case "subscription.paused":
        console.log("Subscription paused");
        await supabaseClient
          .from('api_subscriptions')
          .update({
            status: 'paused',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        break;

      case "subscription.resumed":
        console.log("Subscription resumed");
        await supabaseClient
          .from('api_subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);
        break;

      default:
        console.log("Unhandled webhook event:", event.event);
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new Response(
      JSON.stringify({
        message: "Webhook processing failed",
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
