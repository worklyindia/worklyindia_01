import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  hashToken,
  generateRawToken,
  json,
  isAuthUserAllowed,
  getAuthAvatarUrl,
  getClientIp,
} from "../_shared/browserToken.ts";

type UserType = "job_seeker" | "employer";

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// ---------------------------------------------------------------- issue
async function handleIssue(req: Request, body: any): Promise<Response> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ issued: false, error: "unauthorized" }, 401);
  }
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(jwt);
  if (claimsErr || !claims?.claims?.sub) {
    return json({ issued: false, error: "unauthorized" }, 401);
  }
  const userId = claims.claims.sub as string;
  const db = admin();

  // NOTE: use limit(1) — maybeSingle() errors out (and silently returns null)
  // when an account has more than one companies/profiles row, which used to
  // stop employer Quick Login tokens from ever being issued.
  const { data: companyRows } = await db
    .from("companies")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);
  const { data: profileRows } = await db
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);
  const companyRow = companyRows?.[0] ?? null;
  const profileRow = profileRows?.[0] ?? null;

  // A single auth user can be BOTH an employer (companies row) and a job
  // seeker (profiles row). Issue a token for every context that exists so the
  // account is recommended on the matching login page.
  const available: UserType[] = [];
  if (companyRow) available.push("employer");
  if (profileRow) available.push("job_seeker");
  if (!available.length) available.push("job_seeker");

  const hint = body?.user_type;
  const types: UserType[] =
    (hint === "employer" || hint === "job_seeker") && available.includes(hint)
      ? [hint]
      : available;

  const issued: Array<{ token: string; user_type: UserType }> = [];
  for (const userType of types) {
    const raw = generateRawToken();
    const { error } = await db.from("browser_login_tokens").insert({
      user_id: userId,
      user_type: userType,
      token_hash: await hashToken(raw),
      user_agent: req.headers.get("user-agent") || null,
      ip: getClientIp(req),
    });
    if (error) {
      console.error("issue insert error:", error);
      continue;
    }
    issued.push({ token: raw, user_type: userType });
  }

  if (!issued.length) return json({ issued: false, error: "insert_failed" }, 500);

  return json({
    issued: true,
    tokens: issued,
    token: issued[0].token,
    user_type: issued[0].user_type,
  });
}

// ---------------------------------------------------------------- verify
async function handleVerify(body: any): Promise<Response> {
  const tokens: unknown = body?.tokens;
  const userType: unknown = body?.user_type;

  if (!Array.isArray(tokens) || tokens.length === 0) return json({ accounts: [] });
  if (userType !== "job_seeker" && userType !== "employer") {
    return json({ error: "invalid user_type" }, 400);
  }

  const cleanTokens = [
    ...new Set(
      tokens.filter(
        (t): t is string => typeof t === "string" && t.length > 10 && t.length < 200,
      ),
    ),
  ].slice(0, 20);
  if (!cleanTokens.length) return json({ accounts: [] });

  const db = admin();
  const hashes = await Promise.all(cleanTokens.map(hashToken));
  const hashToRaw = new Map<string, string>();
  hashes.forEach((h, i) => hashToRaw.set(h, cleanTokens[i]));

  const { data: rows, error } = await db
    .from("browser_login_tokens")
    .select("id, user_id, user_type, token_hash, expires_at, revoked_at")
    .in("token_hash", hashes)
    .eq("user_type", userType);

  if (error) {
    console.error("verify select error:", error);
    return json({ accounts: [] });
  }

  const nowMs = Date.now();
  const validRows = (rows || []).filter((r: any) => {
    if (r.revoked_at) return false;
    if (r.expires_at && new Date(r.expires_at).getTime() < nowMs) return false;
    return true;
  });

  const validHashes = new Set(validRows.map((r: any) => r.token_hash));
  const invalidTokens = hashes
    .filter((h) => !validHashes.has(h))
    .map((h) => hashToRaw.get(h))
    .filter((t): t is string => !!t);

  if (!validRows.length) return json({ accounts: [], invalid_tokens: invalidTokens });

  const userIds = [...new Set(validRows.map((r: any) => r.user_id))];
  const profileTable = userType === "employer" ? "companies" : "profiles";
  const nameCol = userType === "employer" ? "company_name" : "full_name";
  const imgCol = userType === "employer" ? "logo_url" : "profile_image_url";

  const { data: profileRows } = await db
    .from(profileTable)
    .select(`user_id, ${nameCol}, ${imgCol}, account_status`)
    .in("user_id", userIds);

  const profileMap = new Map<string, any>();
  for (const p of profileRows || []) profileMap.set((p as any).user_id, p);

  const accounts: Array<{
    token: string;
    email: string;
    full_name: string;
    image_url: string;
  }> = [];

  for (const row of validRows as any[]) {
    const profile = profileMap.get(row.user_id);
    if (!profile) continue;
    if (String(profile.account_status || "active").toLowerCase() !== "active") continue;

    const { data: authRes } = await db.auth.admin.getUserById(row.user_id);
    if (!authRes?.user || !isAuthUserAllowed(authRes.user) || !authRes.user.email) continue;

    const raw = hashToRaw.get(row.token_hash);
    if (!raw) continue;

    accounts.push({
      token: raw,
      email: authRes.user.email,
      full_name: (profile[nameCol] as string) || "",
      image_url: (profile[imgCol] as string) || getAuthAvatarUrl(authRes.user) || "",
    });
  }

  const byEmail = new Map<string, typeof accounts[number]>();
  for (const a of accounts) byEmail.set(a.email.toLowerCase(), a);

  return json({ accounts: [...byEmail.values()], invalid_tokens: invalidTokens });
}

// ---------------------------------------------------------------- login
async function handleLogin(req: Request, body: any): Promise<Response> {
  const token: unknown = body?.token;
  const userType: unknown = body?.user_type;

  if (typeof token !== "string" || token.length < 10 || token.length > 200) {
    return json({ ok: false, error: "invalid_token" }, 400);
  }
  if (userType !== "job_seeker" && userType !== "employer") {
    return json({ ok: false, error: "invalid_user_type" }, 400);
  }

  const db = admin();
  const token_hash = await hashToken(token);

  const { data: row } = await db
    .from("browser_login_tokens")
    .select("id, user_id, user_type, expires_at, revoked_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (!row) return json({ ok: false, error: "not_found" }, 404);
  if (row.revoked_at) return json({ ok: false, error: "revoked" }, 401);
  if (row.user_type !== userType) return json({ ok: false, error: "user_type_mismatch" }, 401);
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "expired" }, 401);
  }

  const { data: authRes } = await db.auth.admin.getUserById(row.user_id);
  if (!authRes?.user || !isAuthUserAllowed(authRes.user) || !authRes.user.email) {
    return json({ ok: false, error: "user_unavailable" }, 401);
  }

  // Rotate: revoke used token, mint a fresh one for this browser.
  const newRaw = generateRawToken();
  await db
    .from("browser_login_tokens")
    .update({
      revoked_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  await db.from("browser_login_tokens").insert({
    user_id: row.user_id,
    user_type: row.user_type,
    token_hash: await hashToken(newRaw),
    user_agent: req.headers.get("user-agent") || null,
    ip: getClientIp(req),
  });

  const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: authRes.user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("generateLink error:", linkErr);
    return json({ ok: false, error: "link_failed" }, 500);
  }

  return json({
    ok: true,
    email: authRes.user.email,
    token_hash: linkData.properties.hashed_token,
    new_token: newRaw,
  });
}

// ---------------------------------------------------------------- revoke
async function handleRevoke(body: any): Promise<Response> {
  const tokens: unknown = body?.tokens;
  if (!Array.isArray(tokens) || !tokens.length) return json({ revoked: 0 });
  const clean = tokens
    .filter((t): t is string => typeof t === "string" && t.length > 10 && t.length < 200)
    .slice(0, 20);
  if (!clean.length) return json({ revoked: 0 });

  const hashes = await Promise.all(clean.map(hashToken));
  const { error } = await admin()
    .from("browser_login_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .in("token_hash", hashes)
    .is("revoked_at", null);
  if (error) console.error("revoke error:", error);
  return json({ revoked: hashes.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "verify";

  switch (action) {
    case "issue":
      return await handleIssue(req, body);
    case "login":
      return await handleLogin(req, body);
    case "revoke":
      return await handleRevoke(body);
    case "verify":
    default:
      return await handleVerify(body);
  }
});
