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

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { job_id, boost_package_id } = await req.json();

    console.log(`Creating boost order for job ${job_id} with package ${boost_package_id}`);

    // Get boost package details
    const { data: boostPackage, error: packageError } = await supabaseClient
      .from('boost_packages')
      .select('*')
      .eq('id', boost_package_id)
      .single();

    if (packageError || !boostPackage) {
      throw new Error("Boost package not found");
    }

    // Check if job exists and user owns it
    console.log(`Checking job ownership for job ${job_id} and user ${user.id}`);
    
    // Use service role to bypass RLS for job lookup
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // First check if job exists
    const { data: jobCheck, error: jobCheckError } = await supabaseService
      .from('jobs')
      .select('id, title, company_id, is_boosted, boost_end_date, status')
      .eq('id', job_id)
      .single();
      
    if (jobCheckError || !jobCheck) {
      console.error("Job not found:", jobCheckError);
      throw new Error("Job not found");
    }
    
    console.log(`Job exists: ${jobCheck.title}, company_id: ${jobCheck.company_id}, is_boosted: ${jobCheck.is_boosted}, status: ${jobCheck.status}`);
    
    // Now check company ownership
    const { data: company, error: companyError } = await supabaseService
      .from('companies')
      .select('user_id')
      .eq('id', jobCheck.company_id)
      .single();
      
    if (companyError || !company) {
      console.error("Company not found:", companyError);
      throw new Error("Company not found for this job");
    }
    
    if (company.user_id !== user.id) {
      console.error(`Permission denied: Job company owner is ${company.user_id}, current user is ${user.id}`);
      throw new Error("You don't have permission to boost this job");
    }
    
    console.log(`Permission verified for user ${user.id}`);

    // Check if job is already boosted
    if (jobCheck.is_boosted && jobCheck.boost_end_date && new Date(jobCheck.boost_end_date) > new Date()) {
      throw new Error("This job is already boosted. Please wait for the current boost to expire.");
    }

    // Allow boosting for active and scheduled jobs
    if (!['active', 'scheduled'].includes(jobCheck.status)) {
      throw new Error(`Cannot boost job with status: ${jobCheck.status}. Only active and scheduled jobs can be boosted.`);
    }

    // Create Razorpay order directly using Razorpay API
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay credentials missing", { 
        hasKeyId: !!razorpayKeyId, 
        hasKeySecret: !!razorpayKeySecret 
      });
      throw new Error("Razorpay credentials not configured");
    }

    console.log("Using Razorpay credentials", { 
      keyId: razorpayKeyId?.substring(0, 8) + "...",
      hasSecret: !!razorpayKeySecret 
    });

    const receipt = `subscription_${Date.now()}_${user.id.substring(0, 8)}`;
    const rzpCustomerId = await ensureRazorpayCustomer(user);
    const orderData = {
      ...(rzpCustomerId ? { customer_id: rzpCustomerId } : {}),
      amount: boostPackage.price_inr * 100, // Convert to paise
      currency: "INR",
      receipt,
      payment_capture: 1,
      notes: {
        user_id: user.id,
        plan_type: "premium",
        subscription_type: "monthly_boost",
        service: "premium_subscription"
      }
    };

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      throw new Error(`Razorpay API error: ${errorText}`);
    }

    const order = await razorpayResponse.json();
    await linkRazorpayOrder({ userId: user.id, customerId: rzpCustomerId, orderId: order.id, amount: order.amount, currency: order.currency, purpose: "job_boost" });

    // Create job boost record (service role already initialized above)

    const { data: jobBoost, error: boostError } = await supabaseService
      .from('job_boosts')
      .insert({
        job_id: job_id,
        user_id: user.id,
        boost_package_id: boost_package_id,
        amount_paid: boostPackage.price_inr,
        razorpay_order_id: order.id,
        status: 'pending'
      })
      .select()
      .single();

    if (boostError) {
      console.error("Error creating job boost record:", boostError);
      throw new Error("Failed to create boost record");
    }

    console.log("Boost order created successfully:", {
      orderId: order.id,
      jobBoostId: jobBoost.id,
      amount: boostPackage.price_inr
    });

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: razorpayKeyId,
        customer_id: rzpCustomerId,
        jobBoostId: jobBoost.id,
        package: boostPackage
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in create-boost-order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create boost order' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});