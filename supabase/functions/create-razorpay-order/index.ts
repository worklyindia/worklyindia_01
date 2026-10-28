import { ensureRazorpayCustomer, linkRazorpayOrder } from "../_shared/razorpayCustomer.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { priceForMonths, priceForInterviews, assertJobOwner } from "../_shared/jobPayments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Creating Razorpay order - Starting request processing");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Read body ONCE
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch (_) {
      requestBody = {};
    }
    console.log("📦 Incoming body type:", requestBody?.type);

    // ============= DONATION BRANCH (auth optional) =============
    if (requestBody?.type === "donation") {
      const { campaign_id, amount, donor_name, donor_email, donor_phone, message, is_anonymous } = requestBody;
      if (!campaign_id || !amount || amount < 1 || amount > 1000000) {
        return new Response(JSON.stringify({ error: "Invalid donation data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      const { data: campaign, error: campErr } = await supabaseClient
        .from('donation_campaigns')
        .select('id, status, target_amount, min_amount, title')
        .eq('id', campaign_id).single();
      if (campErr || !campaign) {
        console.error("Campaign fetch error", campErr);
        return new Response(JSON.stringify({ error: "Campaign not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      }
      if (campaign.status !== 'active') {
        return new Response(JSON.stringify({ error: "Campaign not accepting donations" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      if (amount < Number(campaign.min_amount ?? 1)) {
        return new Response(JSON.stringify({ error: `Minimum donation is ₹${campaign.min_amount}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }
      const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
      if (!keyId || !keySecret) {
        return new Response(JSON.stringify({ error: "Razorpay credentials missing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      let userId: string | null = null;
      const authH = req.headers.get("Authorization");
      if (authH) {
        try {
          const { data: ud } = await supabaseClient.auth.getUser(authH.replace("Bearer ", ""));
          userId = ud.user?.id ?? null;
        } catch (_) {}
      }
      const basic = btoa(`${keyId}:${keySecret}`);
      const safeTitle = String(campaign.title || "Donation").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 80) || "Donation";
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(amount * 100), currency: "INR",
          receipt: `don_${Date.now()}`,
          notes: { type: "donation", campaign_id: String(campaign_id), campaign_title: safeTitle },
        }),
      });
      if (!orderRes.ok) {
        const t = await orderRes.text();
        console.error("Razorpay error:", t);
        return new Response(JSON.stringify({ error: `Razorpay error: ${t}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      const order = await orderRes.json();
      const { data: donation, error: dErr } = await supabaseClient
        .from('donations').insert({
          campaign_id, user_id: userId,
          donor_name: is_anonymous ? null : (donor_name || null),
          donor_email: donor_email || null, donor_phone: donor_phone || null,
          amount, message: message || null,
          is_anonymous: !!is_anonymous, status: 'created',
          razorpay_order_id: order.id,
        }).select().single();
      if (dErr) {
        console.error("Donation insert error:", dErr);
        return new Response(JSON.stringify({ error: `DB error: ${dErr.message}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      return new Response(JSON.stringify({
        order_id: order.id, amount: order.amount, currency: order.currency,
        key: keyId, donation_id: donation.id, campaign_title: campaign.title,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
    // ============= END DONATION BRANCH =============

    // ============= JOB POSTING / EXTENSION / INTERVIEW (Razorpay only) =============
    if (requestBody?.type === "job_payment") {
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });
      const authH = req.headers.get("Authorization");
      if (!authH) return json({ error: "Authorization required" }, 401);
      const { data: ud, error: uErr } = await supabaseClient.auth.getUser(authH.replace("Bearer ", ""));
      if (uErr || !ud.user) return json({ error: "Invalid session" }, 401);
      const user = ud.user;
      const purpose = String(requestBody.purpose || "");
      let amount = 0;
      let payload: Record<string, unknown> = {};
      let label = "Payment";
      try {
        if (purpose === "job_posting" || purpose === "job_extension") {
          const months = Math.max(1, Math.min(24, Math.floor(Number(requestBody.months) || 1)));
          const job = await assertJobOwner(supabaseClient, String(requestBody.job_id || ""), user.id);
          amount = await priceForMonths(supabaseClient, months);
          payload = { job_id: job.id, months, target_status: requestBody.target_status === "scheduled" ? "scheduled" : "active" };
          label = purpose === "job_posting" ? `Listing plan - ${months} month${months > 1 ? "s" : ""}` : `Listing renewal - ${months} month${months > 1 ? "s" : ""}`;
        } else if (purpose === "interview") {
          const i = requestBody.interview || {};
          const applicants = Array.isArray(i.applicants) ? i.applicants.slice(0, 200) : [];
          if (!applicants.length || !i.scheduledAt || !i.mode) return json({ error: "Interview details missing" }, 400);
          for (const jobId of new Set(applicants.map((a: any) => String(a.jobId)))) {
            await assertJobOwner(supabaseClient, jobId as string, user.id);
          }
          amount = await priceForInterviews(supabaseClient, applicants.length, i.scheduledAt, i.scheduledEndAt, i.mode);
          payload = {
            applicants: applicants.map((a: any) => ({ applicantId: String(a.applicantId), jobId: String(a.jobId) })),
            scheduledAt: i.scheduledAt, scheduledEndAt: i.scheduledEndAt || null, mode: String(i.mode),
            locationUrl: i.locationUrl || null, notes: i.notes ? String(i.notes).slice(0, 2000) : null,
            videoPlatform: i.videoPlatform || null, youtubeStreamKey: i.youtubeStreamKey || null, youtubeStreamUrl: i.youtubeStreamUrl || null,
          };
          label = `Meeting scheduling - ${applicants.length} slot${applicants.length > 1 ? "s" : ""}`;
        } else {
          return json({ error: "Invalid purpose" }, 400);
        }
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Invalid request" }, 400);
      }

      amount = Math.round(Number(amount) || 0);
      if (amount < 1) return json({ error: "Invalid amount" }, 400);
      const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
      if (!keyId || !keySecret) return json({ error: "Razorpay credentials missing" }, 500);
      // Razorpay must never receive the word "job": use neutral service codes only.
      const serviceCode = purpose === "job_posting" ? "listing_plan" : purpose === "job_extension" ? "listing_renewal" : "meeting_slots";

      const rzpCustomerId = await ensureRazorpayCustomer(user);
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Authorization": `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100, currency: "INR", receipt: `svc_${Date.now()}`,
          ...(rzpCustomerId ? { customer_id: rzpCustomerId } : {}),
          notes: { service: serviceCode, ref: user.id },
        }),
      });
      if (!orderRes.ok) {
        const t = await orderRes.text();
        console.error("Razorpay error (job_payment):", orderRes.status, t);
        return json({ error: "Razorpay order failed", status: orderRes.status, details: t }, 502);
      }
      const order = await orderRes.json();
      const { error: pErr } = await supabaseClient.from("pending_payments").insert({
        user_id: user.id, purpose, amount_inr: amount, payload, razorpay_order_id: order.id,
      });
      if (pErr) return json({ error: `Could not save payment: ${pErr.message}` }, 500);
      await linkRazorpayOrder({ userId: user.id, customerId: rzpCustomerId, orderId: order.id, amount: order.amount, currency: order.currency, purpose });
      return json({ order_id: order.id, amount: order.amount, currency: order.currency, key: keyId, price_inr: amount, label, customer_id: rzpCustomerId });
    }
    // ============= END JOB PAYMENT BRANCH =============

    // ============= JOB INDEXING (SEO) BRANCH =============
    if (requestBody?.type === "job_indexing") {
      const { job_id } = requestBody;
      if (!job_id) {
        return new Response(JSON.stringify({ error: "job_id is required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // Auth required — only job owner can pay
      const authH = req.headers.get("Authorization");
      if (!authH) {
        return new Response(JSON.stringify({ error: "Authorization required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
      }
      const { data: ud, error: uErr } = await supabaseClient.auth.getUser(authH.replace("Bearer ", ""));
      if (uErr || !ud.user) {
        return new Response(JSON.stringify({ error: "Invalid session" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
      }
      const user = ud.user;

      // Verify job ownership (via companies.user_id)
      const { data: job, error: jErr } = await supabaseClient
        .from('jobs').select('id, title, company_id').eq('id', job_id).single();
      if (jErr || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
      }
      if (job.company_id) {
        const { data: company } = await supabaseClient
          .from('companies').select('user_id').eq('id', job.company_id).maybeSingle();
        if (company?.user_id && company.user_id !== user.id) {
          return new Response(JSON.stringify({ error: "Not authorized for this job" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
        }
      }

      // Already paid?
      const { data: idx } = await supabaseClient
        .from('job_indexing_status').select('is_paid_for_indexing').eq('job_id', job_id).maybeSingle();
      if (idx?.is_paid_for_indexing) {
        return new Response(JSON.stringify({ error: "Already paid for indexing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
      }

      // Server-side price from app_settings
      const { data: setting } = await supabaseClient
        .from('app_settings').select('setting_value').eq('setting_key', 'search_engine_indexing_price').maybeSingle();
      const price = Math.max(1, parseInt(setting?.setting_value || '100', 10) || 100);

      const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
      if (!keyId || !keySecret) {
        return new Response(JSON.stringify({ error: "Razorpay credentials missing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }

      const basic = btoa(`${keyId}:${keySecret}`);
      const safeTitle = String(job.title || "Job").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 60) || "Job";
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: price * 100, currency: "INR",
          receipt: `seo_${Date.now()}`,
          notes: { service: "search_listing", ref: user.id },
        }),
      });
      if (!orderRes.ok) {
        const t = await orderRes.text();
        console.error("Razorpay error (job_indexing):", t);
        return new Response(JSON.stringify({ error: `Razorpay error: ${t}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
      }
      const order = await orderRes.json();

      return new Response(JSON.stringify({
        order_id: order.id, amount: order.amount, currency: order.currency,
        key: keyId, price_inr: price, job_id, job_title: safeTitle,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
    // ============= END JOB INDEXING BRANCH =============




    // Get authenticated user
    const supabaseAuthHeader = req.headers.get("Authorization");
    if (!supabaseAuthHeader) {
      console.error("Missing Authorization header");
      throw new Error("Authorization header is required");
    }
    
    const token = supabaseAuthHeader.replace("Bearer ", "");
    console.log("Attempting to authenticate user with token");
    
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error("Authentication error:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    const user = data.user;
    if (!user?.email) {
      console.error("No authenticated user found");
      throw new Error("User not authenticated");
    }

    console.log(`Processing order for user: ${user.id}`);
    console.log("📦 Incoming body:", requestBody);
    

    
    const { plan } = requestBody;

    if (!plan) {
      console.error("No plan data provided in request");
      throw new Error("Plan data is required");
    }
    
    if (!plan.points_amount || !plan.price_inr) {
      console.error("Invalid plan data:", plan);
      throw new Error("Plan must include points_amount and price_inr");
    }

    // Check if it's a custom purchase
    const isCustomPurchase = plan.id === 'custom' || !plan.id;
    
    if (isCustomPurchase) {
      // Fetch custom point price from app_settings
      console.log("Fetching custom point price from database...");
      const { data: settingData, error: settingError } = await supabaseClient
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'custom_point_price_inr')
        .single();
      
      let pricePerPoint = 1; // Default
      if (!settingError && settingData?.setting_value) {
        pricePerPoint = parseFloat(settingData.setting_value) || 1;
      }
      console.log("Custom point price per point:", pricePerPoint);
      
      // Validate that price matches points * pricePerPoint
      const expectedPrice = plan.points_amount * pricePerPoint;
      if (plan.price_inr !== expectedPrice) {
        console.error("Custom purchase price mismatch:", { 
          price: plan.price_inr, 
          points: plan.points_amount, 
          pricePerPoint,
          expectedPrice 
        });
        throw new Error(`Custom purchase: price must equal points × ₹${pricePerPoint} (expected ₹${expectedPrice})`);
      }
    }

    // Validate limits
    if (plan.points_amount < 1 || plan.points_amount > 100000) {
      console.error("Points out of range:", plan.points_amount);
      throw new Error("Points must be between 1 and 100,000");
    }

    if (plan.price_inr < 1 || plan.price_inr > 10000000) {
      console.error("Price out of range:", plan.price_inr);
      throw new Error("Price must be between ₹1 and ₹1,00,00,000");
    }

    console.log("Plan validation successful:", { 
      points: plan.points_amount, 
      price: plan.price_inr,
      isCustom: isCustomPurchase
    });

    // Check and normalize environment variables with detailed validation
    const rawKeyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
    const rawKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
    
    console.log("🔍 Raw Key ID:", rawKeyId ? `${rawKeyId.substring(0, 8)}...` : "Missing");
    console.log("🔍 Key preview:", rawKeyId?.substring(0, 8) + "...", "Secret length:", rawKeySecret?.length);
    console.log("🔍 Expected Key ID should start with 'rzp_live_' or 'rzp_test_'");
    console.log("🔍 Key ID validation:", rawKeyId?.startsWith('rzp_') ? "✅ Valid format" : "❌ Invalid format");
    
    if (!rawKeyId || !rawKeySecret) {
      console.error("❌ Missing credentials:", { hasKeyId: !!rawKeyId, hasSecret: !!rawKeySecret });
      throw new Error("Razorpay credentials missing. Please set env vars in Functions → Environment variables.");
    }

    const basicAuth = btoa(`${rawKeyId}:${rawKeySecret}`);
    console.log("🔐 Basic Auth preview:", basicAuth.substring(0, 12) + "...", "Full length:", basicAuth.length);

    // Build order options
    const options = {
      amount: plan.price_inr * 100, // Convert to paisa
      currency: "INR",
      receipt: `subscription_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan_type: "premium",
        subscription_type: "points_plan",
        service: "premium_subscription"
      }
    };

    console.log("📤 Sending order create request:", options);

    // Create order using direct HTTP call with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("Razorpay API error:", errorText);
      throw new Error(`Razorpay API error: ${errorText}`);
    }

    const order = await orderResponse.json();
    console.log("✅ Razorpay order created:", order);

    // Create transaction record
    console.log("Creating transaction record in database");
    
    const transactionData = {
      user_id: user.id,
      amount: plan.price_inr,
      points: plan.points_amount,
      razorpay_order_id: order.id,
      status: 'pending'
    };

    console.log("Transaction data to insert:", transactionData);

    const { data: insertedTransaction, error: transactionError } = await supabaseClient
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error("Error creating transaction record:", transactionError);
      throw new Error(`Failed to create transaction record: ${transactionError.message}`);
    }

    console.log("Transaction record created successfully:", insertedTransaction);

    return new Response(JSON.stringify({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: rawKeyId,
      plan: plan
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Function error:", err);

    return new Response(
      JSON.stringify({
        message: "Function crashed",
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});