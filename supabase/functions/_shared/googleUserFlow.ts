/**
 * Per-app-user Google connections (AdSense, Search Console, Analytics, Drive).
 *
 * Both the JSON API and the OAuth redirect target live inside the
 * `unified-google-api` edge function:
 *   POST { service: "user_connect", action: "status" | "start" | ... }
 *   GET  ?code=...&state=...   (Google redirect)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  adminClient,
  callbackUrl,
  encryptToken,
  getAccessTokenForUser,
  GOOGLE_PRODUCTS,
  isGoogleProduct,
  PRODUCT_API_HOSTS,
  isOAuthConfigured,
  requireOAuthClient,
  scopesFor,
  type GoogleProduct,
} from "./googleUserOAuth.ts";
import { askAiChain } from "./aiChain.ts";
import { reserveAiChatMessage } from "./aiChatLimit.ts";
import { withBusinessContext } from "./businessProfile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAllowedOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// ==================== JSON API ====================

export async function handleGoogleUserConnect(
  req: Request,
  params: Record<string, unknown>,
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in required" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sign in required" }, 401);

  const action = String(params.action ?? "");

  if (action === "status") {
    const { data, error } = await adminClient()
      .from("google_user_connections")
      .select("product, google_email, scopes, status, token_expires_at, updated_at")
      .eq("user_id", user.id);
    if (error) throw error;
    return json({
      configured: await isOAuthConfigured(),
      products: GOOGLE_PRODUCTS,
      connections: data ?? [],
    });
  }

  if (action === "start") {
    const { product, origin } = params as { product?: unknown; origin?: unknown };
    if (!isGoogleProduct(product)) return json({ error: "Unknown product" }, 400);
    if (typeof origin !== "string" || !isAllowedOrigin(origin)) {
      return json({ error: "Invalid origin" }, 400);
    }

    const { clientId } = await requireOAuthClient(product);
    const state = crypto.randomUUID();
    const returnTo = new URL("/oauth/google/return", origin).toString();

    const { error } = await adminClient().from("google_oauth_states").insert({
      state,
      user_id: user.id,
      product,
      redirect_uri: returnTo,
    });
    if (error) throw error;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopesFor(product).join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return json({ authorizationUrl: authUrl.toString() });
  }

  if (action === "disconnect") {
    const { product } = params as { product?: unknown };
    if (!isGoogleProduct(product)) return json({ error: "Unknown product" }, 400);
    const { error } = await adminClient()
      .from("google_user_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("product", product);
    if (error) throw error;
    return json({ ok: true });
  }

  const callGoogle = async (
    product: GoogleProduct,
    url: string,
    init?: RequestInit,
  ) => {
    const host = new URL(url).hostname;
    if (!PRODUCT_API_HOSTS[product].includes(host)) {
      return json({ error: `Host ${host} is not allowed for ${product}` }, 400);
    }
    const accessToken = await getAccessTokenForUser(user.id, product);
    if (!accessToken) return json({ connected: false }, 200);

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (init?.body) headers.set("Content-Type", "application/json");
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[google-user] ${product} ${res.status}: ${text}`);
      return json(
        { error: "Google request failed", status: res.status, details: text },
        res.status,
      );
    }
    return json({ connected: true, data: text ? JSON.parse(text) : null });
  };

  if (action === "api") {
    const { product, url, method, payload } = params as Record<string, unknown>;
    if (!isGoogleProduct(product)) return json({ error: "Unknown product" }, 400);
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return json({ error: "Invalid url" }, 400);
    }
    return await callGoogle(product, url, {
      method: typeof method === "string" ? method : "GET",
      body: payload ? JSON.stringify(payload) : undefined,
    });
  }

  if (action === "analytics_accounts") {
    return await callGoogle(
      "analytics",
      "https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=200",
    );
  }

  if (action === "analytics_properties") {
    const account = String(params.account ?? "");
    if (!/^accounts\/\d+$/.test(account)) {
      return json({ error: "account must look like accounts/123456" }, 400);
    }
    return await callGoogle(
      "analytics",
      `https://analyticsadmin.googleapis.com/v1beta/properties?pageSize=200&filter=parent:${account}`,
    );
  }

  if (action === "analytics_report") {
    const propertyId = String(params.propertyId ?? "");
    if (!/^\d+$/.test(propertyId)) {
      return json({ error: "propertyId must be numeric" }, 400);
    }
    const startDate = String(params.startDate ?? "28daysAgo");
    const endDate = String(params.endDate ?? "today");
    const dimensions = Array.isArray(params.dimensions) ? params.dimensions : ["date"];
    const metrics = Array.isArray(params.metrics) && params.metrics.length
      ? params.metrics
      : [
        "activeUsers",
        "sessions",
        "screenPageViews",
        "eventCount",
        "conversions",
        "totalRevenue",
      ];
    return await callGoogle(
      "analytics",
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: (dimensions as string[]).map((name) => ({ name })),
          metrics: (metrics as string[]).map((name) => ({ name })),
          limit: 250,
        }),
      },
    );
  }

  // ---------------- Google Business Profile (reviews + AI auto-reply) ----------------

  if (action === "gbp_accounts") {
    return await callGoogle(
      "business_profile",
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    );
  }

  if (action === "gbp_locations") {
    const account = String(params.account ?? "");
    if (!/^accounts\/\d+$/.test(account)) {
      return json({ error: "account must look like accounts/123456" }, 400);
    }
    return await callGoogle(
      "business_profile",
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title&pageSize=100`,
    );
  }

  if (action === "gbp_reviews") {
    const location = String(params.location ?? "");
    if (!/^accounts\/\d+\/locations\/\d+$/.test(location)) {
      return json({ error: "location must look like accounts/123/locations/456" }, 400);
    }
    return await callGoogle(
      "business_profile",
      `https://mybusiness.googleapis.com/v4/${location}/reviews?pageSize=50`,
    );
  }

  if (action === "gbp_reply") {
    const review = String(params.review ?? "");
    if (!/^accounts\/\d+\/locations\/\d+\/reviews\/[A-Za-z0-9_-]+$/.test(review)) {
      return json({ error: "Invalid review name" }, 400);
    }
    const comment = String(params.comment ?? "").trim();
    if (!comment || comment.length > 4096) {
      return json({ error: "Reply text is required (max 4096 characters)." }, 400);
    }
    return await callGoogle(
      "business_profile",
      `https://mybusiness.googleapis.com/v4/${review}/reply`,
      { method: "PUT", body: JSON.stringify({ comment }) },
    );
  }

  if (action === "gbp_autoreply_get") {
    const accountId = String(params.accountId ?? "");
    const { data } = await adminClient()
      .from("social_autoreply_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", GBP_PLATFORM)
      .eq("account_id", accountId)
      .maybeSingle();
    const { count } = await adminClient()
      .from("social_autoreply_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("platform", GBP_PLATFORM);
    return json({
      settings: { ...GBP_DEFAULTS, ...(data ?? {}) },
      totalReplies: count ?? 0,
    });
  }

  if (action === "gbp_autoreply_save") {
    const accountId = String(params.accountId ?? "");
    const patch = (params.settings ?? {}) as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const key of GBP_SETTING_KEYS) {
      if (key in patch) clean[key] = patch[key];
    }
    const { error } = await adminClient()
      .from("social_autoreply_settings")
      .upsert(
        {
          user_id: user.id,
          platform: GBP_PLATFORM,
          account_id: accountId,
          ...clean,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_id" },
      );
    if (error) throw error;
    return json({ settings: { ...GBP_DEFAULTS, ...clean } });
  }

  if (action === "gbp_autoreply_log") {
    const limit = Math.min(Math.max(Number(params.limit ?? 20) || 20, 1), 100);
    const { data, error } = await adminClient()
      .from("social_autoreply_log")
      .select("id, platform, target_id, post_id, post_text, author_name, comment_text, reply_text, status, error, created_at")
      .eq("user_id", user.id)
      .eq("platform", GBP_PLATFORM)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return json({ items: data ?? [] });
  }

  if (action === "gbp_autoreply_run") {
    return await runGbpAutoReply(user.id, params, json);
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

// ==================== Google Business Profile auto-reply ====================

const GBP_PLATFORM = "google_business";

const GBP_DEFAULTS = {
  enabled: false,
  tone: "friendly",
  language: "auto",
  reply_scope: "all",
  reply_length: "auto",
  max_replies_per_run: 0,
  custom_instructions: "",
  signature: "",
  skip_negative: false,
};

const GBP_SETTING_KEYS = [
  "enabled", "tone", "language", "reply_scope", "reply_length",
  "max_replies_per_run", "custom_instructions", "signature", "skip_negative",
] as const;

interface GbpReview {
  name: string;
  reviewId?: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string };
}

const GBP_STARS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

async function gbpFetch(
  userId: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: any }> {
  const accessToken = await getAccessTokenForUser(userId, "business_profile");
  if (!accessToken) return { ok: false, status: 401, data: null };
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    console.error(`[gbp] ${res.status}: ${text}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function runGbpAutoReply(
  userId: string,
  params: Record<string, unknown>,
  json: (body: unknown, status?: number) => Response,
): Promise<Response> {
  const location = String(params.location ?? "");
  if (!/^accounts\/\d+\/locations\/\d+$/.test(location)) {
    return json({ error: "location must look like accounts/123/locations/456" }, 400);
  }
  const dryRun = !!params.dryRun;

  const { data: settingsRow } = await adminClient()
    .from("social_autoreply_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", GBP_PLATFORM)
    .eq("account_id", location)
    .maybeSingle();
  const settings = { ...GBP_DEFAULTS, ...(settingsRow ?? {}) };

  if (!settings.enabled && !dryRun) {
    return json({ error: "Auto-reply is switched off for this location." }, 400);
  }

  const reviewsRes = await gbpFetch(
    userId,
    `https://mybusiness.googleapis.com/v4/${location}/reviews?pageSize=50`,
  );
  if (reviewsRes.status === 401) return json({ connected: false });
  if (!reviewsRes.ok) {
    return json({ error: "Could not load reviews from Google.", status: reviewsRes.status }, 200);
  }

  const reviews = (reviewsRes.data?.reviews ?? []) as GbpReview[];
  const unanswered = reviews
    .filter((r) => !r.reviewReply?.comment)
    .sort((a, b) => String(b.createTime ?? "").localeCompare(String(a.createTime ?? "")));

  const limit = settings.max_replies_per_run > 0
    ? settings.max_replies_per_run
    : Math.min(Math.max(Number(params.limit ?? 10) || 10, 1), 25);

  const { data: handled } = await adminClient()
    .from("social_autoreply_log")
    .select("target_id")
    .eq("user_id", userId)
    .eq("platform", GBP_PLATFORM)
    .in("target_id", unanswered.map((r) => r.name));
  const done = new Set((handled ?? []).map((h: { target_id: string }) => h.target_id));

  const items: Array<{
    targetId: string; author: string; rating: number; comment: string;
    reply: string; posted: boolean; error?: string;
  }> = [];
  let replied = 0;
  let skipped = 0;

  const system = await withBusinessContext(
    [
      "You are the official customer support voice of this business, replying publicly to Google Business Profile reviews.",
      "Write a short, warm, professional public reply to the review.",
      "Thank positive reviewers by name when available. For negative reviews, apologise sincerely, acknowledge the issue and invite them to contact support — never argue.",
      "Keep it under 80 words. No hashtags, no emojis unless the tone asks for them.",
      settings.language && settings.language !== "auto"
        ? `Reply in ${settings.language}.`
        : "Reply in the same language the reviewer used (Hindi/English/Hinglish as appropriate).",
      settings.tone ? `Tone: ${settings.tone}.` : "",
      settings.custom_instructions ? `Extra instructions: ${settings.custom_instructions}` : "",
      settings.signature ? `End with: ${settings.signature}` : "",
    ].filter(Boolean).join("\n"),
    userId,
    "customer_service",
  );

  for (const review of unanswered) {
    if (items.length >= limit) break;
    if (done.has(review.name)) { skipped++; continue; }
    const stars = GBP_STARS[String(review.starRating ?? "")] ?? 0;
    if (settings.skip_negative && stars > 0 && stars <= 2) { skipped++; continue; }

    const author = review.reviewer?.displayName ?? "Customer";
    const comment = review.comment ?? "";

    const quota = await reserveAiChatMessage(adminClient(), userId, "telegram");
    if (!quota.allowed) {
      items.push({
        targetId: review.name, author, rating: stars, comment,
        reply: "", posted: false,
        error: quota.upgradeMessage || "AI reply limit reached",
      });
      break;
    }

    const reply = await askAiChain(
      system,
      `Review (${stars}/5 stars) by ${author}:\n${comment || "(no written review, rating only)"}`,
      { label: "gbp-autoreply" },
    );

    if (!reply) {
      items.push({ targetId: review.name, author, rating: stars, comment, reply: "", posted: false, error: "AI could not write a reply" });
      continue;
    }

    let posted = false;
    let error: string | undefined;
    if (!dryRun) {
      const put = await gbpFetch(
        userId,
        `https://mybusiness.googleapis.com/v4/${review.name}/reply`,
        { method: "PUT", body: JSON.stringify({ comment: reply }) },
      );
      posted = put.ok;
      if (!put.ok) error = `Google rejected the reply (status ${put.status})`;
    }

    if (!dryRun) {
      await adminClient().from("social_autoreply_log").insert({
        user_id: userId,
        platform: GBP_PLATFORM,
        target_id: review.name,
        post_id: location,
        post_text: null,
        author_name: author,
        comment_text: comment,
        reply_text: reply,
        status: posted ? "replied" : "error",
        error: error ?? null,
      });
    }

    if (posted) replied++;
    items.push({ targetId: review.name, author, rating: stars, comment, reply, posted, error });
  }

  if (!dryRun) {
    await adminClient()
      .from("social_autoreply_settings")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: `scanned ${unanswered.length}, replied ${replied}, skipped ${skipped}`,
      })
      .eq("user_id", userId)
      .eq("platform", GBP_PLATFORM)
      .eq("account_id", location);
  }

  return json({
    scanned: unanswered.length,
    replied,
    skipped,
    items,
  });
}

// ==================== OAuth redirect target ====================

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

function withParams(base: string, extra: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function handleGoogleUserCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  const supabase = adminClient();

  const { data: stateRow } = await supabase
    .from("google_oauth_states")
    .select("state, user_id, product, redirect_uri, created_at")
    .eq("state", state)
    .maybeSingle();

  if (!stateRow) {
    return new Response("Invalid or expired OAuth state.", { status: 400 });
  }

  await supabase.from("google_oauth_states").delete().eq("state", state);

  const returnTo = stateRow.redirect_uri as string;
  const product = stateRow.product as string;

  if (Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000) {
    return redirect(
      withParams(returnTo, { success: "false", error: "State expired, please try again." }),
    );
  }

  if (oauthError || !code) {
    return redirect(
      withParams(returnTo, {
        success: "false",
        product,
        error: oauthError || "Authorization was cancelled.",
      }),
    );
  }

  if (!isGoogleProduct(product)) {
    return redirect(withParams(returnTo, { success: "false", error: "Unknown product." }));
  }

  try {
    const { clientId, clientSecret } = await requireOAuthClient(product);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error(`[google-user-callback] token exchange failed: ${tokenText}`);
      return redirect(
        withParams(returnTo, {
          success: "false",
          product,
          error: "Google rejected the authorization.",
        }),
      );
    }

    const token = JSON.parse(tokenText) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    let email: string | null = null;
    let sub: string | null = null;
    const infoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (infoRes.ok) {
      const info = await infoRes.json();
      email = info.email ?? null;
      sub = info.sub ?? null;
    }

    const record: Record<string, unknown> = {
      user_id: stateRow.user_id,
      product,
      google_email: email,
      google_sub: sub,
      scopes: (token.scope ?? "").split(" ").filter(Boolean),
      access_token_ciphertext: await encryptToken(token.access_token),
      token_expires_at: new Date(
        Date.now() + (token.expires_in ?? 3600) * 1000,
      ).toISOString(),
      status: "connected",
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    if (token.refresh_token) {
      record.refresh_token_ciphertext = await encryptToken(token.refresh_token);
    }

    const { error } = await supabase
      .from("google_user_connections")
      .upsert(record, { onConflict: "user_id,product" });
    if (error) throw error;

    return redirect(withParams(returnTo, { success: "true", product }));
  } catch (err) {
    console.error("[google-user-callback] failed", err);
    return redirect(
      withParams(returnTo, {
        success: "false",
        product,
        error: "Could not save the connection.",
      }),
    );
  }
}
