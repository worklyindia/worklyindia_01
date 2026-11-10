import { ensureRazorpayCustomer, linkRazorpayOrder } from "../_shared/razorpayCustomer.ts";
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { verification_package_id } = await req.json();

    // Get verification package details
    const { data: packageData, error: packageError } = await supabaseClient
      .from('verification_packages')
      .select('*')
      .eq('id', verification_package_id)
      .eq('is_active', true)
      .single();

    if (packageError || !packageData) {
      throw new Error("Verification package not found");
    }

    // Initialize Razorpay
    const rawKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const rawKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
    const razorpayKeyId = rawKeyId.trim();
    const razorpayKeySecret = rawKeySecret.trim();
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay credentials missing", { 
        hasKeyId: !!razorpayKeyId, 
        hasKeySecret: !!razorpayKeySecret 
      });
      throw new Error("Razorpay credentials not configured");
    }

    console.log("Using Razorpay credentials", { 
      keyIdPreview: razorpayKeyId.substring(0, 8) + "...",
      keyIdLength: razorpayKeyId.length,
      keySecretLength: razorpayKeySecret.length 
    });

    // Prepare Basic auth header safely and create Razorpay order with timeout
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    console.log("🔐 Basic auth preview (first 12 chars):", basicAuth.substring(0, 12) + "...", "len:", basicAuth.length);

    const rzpCustomerId = await ensureRazorpayCustomer(user);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Sanitize package name for Razorpay (remove emojis and special characters)
    const sanitizedPackageName = packageData.name.replace(/[^\w\s-]/gi, '').trim();
    
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: packageData.price_inr * 100, // Convert to paisa
        currency: "INR",
        ...(rzpCustomerId ? { customer_id: rzpCustomerId } : {}),
        receipt: `verification_${Date.now()}`,
        notes: {
          user_id: user.id,
          package_name: sanitizedPackageName,
          original_package_name: packageData.name,
          verification_package_id: verification_package_id,
          service: "verification_badge"
        }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("Razorpay API error:", errorText);
      throw new Error(`Razorpay API error: ${errorText}`);
    }

    const order = await orderResponse.json();
    await linkRazorpayOrder({ userId: user.id, customerId: rzpCustomerId, orderId: order.id, amount: order.amount, currency: order.currency, purpose: "verification_badge" });

    // Create verification purchase record using service role (bypasses RLS safely)
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { error: purchaseError } = await supabaseService
      .from('verification_purchases')
      .insert({
        user_id: user.id,
        verification_package_id: verification_package_id,
        amount_paid: packageData.price_inr,
        razorpay_order_id: order.id,
        status: 'pending'
      });

    if (purchaseError) {
      console.error("Error creating purchase record:", purchaseError);
      throw new Error("Failed to create purchase record");
    }

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: razorpayKeyId,
      customer_id: rzpCustomerId,
      package: packageData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Verification order creation error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to create verification order" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});