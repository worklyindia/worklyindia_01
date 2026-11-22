import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "workly-ai-models";
const PUBLIC_BASE = "https://pub-d7e0943326ee4d9da8045f267a70faac.r2.dev";
const MODELS = new Set(["kokoro", "indic", "itantra"]);
const LANGUAGES = new Set(["hi-IN", "en-IN", "gu-IN"]);

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function ownerSecret(name: string): Promise<string> {
  const response = await fetch(`${PROJECT_URL}/rest/v1/owner_secrets?name=eq.${encodeURIComponent(name)}&select=value`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!response.ok) throw new Error(`Could not read Cloudflare storage configuration (${name}).`);
  const rows = await response.json() as Array<{ value?: string | null }>;
  const value = rows?.[0]?.value?.trim();
  if (!value) throw new Error(`Missing ${name} in Owner Secrets.`);
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sign in to save voice previews." }, 401);
    const userClient = createClient(PROJECT_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Your session expired. Please sign in again." }, 401);

    const body = await req.json();
    const model = String(body.model ?? "");
    const language = String(body.language ?? "");
    const voice = String(body.voice ?? "");
    const dataUrl = String(body.audio ?? "");
    if (!MODELS.has(model) || !LANGUAGES.has(language) || !/^[a-z0-9_-]{1,40}$/i.test(voice)) {
      return json({ error: "Invalid voice preview selection." }, 400);
    }
    const match = dataUrl.match(/^data:audio\/wav;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return json({ error: "Preview must be a WAV audio file." }, 400);
    const binary = atob(match[1]);
    if (binary.length < 44 || binary.length > 5 * 1024 * 1024) return json({ error: "Voice preview audio must be between 44 bytes and 5 MB." }, 400);
    if (binary.slice(0, 4) !== "RIFF" || binary.slice(8, 12) !== "WAVE") return json({ error: "Invalid WAV audio data." }, 400);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const [accountId, accessKeyId, secretAccessKey] = await Promise.all([
      ownerSecret("R2_ACCOUNT_ID"), ownerSecret("R2_ACCESS_KEY_ID"), ownerSecret("R2_SECRET_ACCESS_KEY"),
    ]);
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const key = `voice-previews/${model}/${language}/${voice}.wav`;
    const upload = await client.fetch(new Request(`https://${accountId}.r2.cloudflarestorage.com/${BUCKET}/${key}`, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" },
    }));
    if (!upload.ok) throw new Error(`Cloudflare R2 upload failed (${upload.status}).`);
    return json({ ok: true, key, url: `${PUBLIC_BASE}/${key}` });
  } catch (error) {
    console.error("[voice-preview-cache]", error);
    return json({ error: error instanceof Error ? error.message : "Could not save voice preview." }, 500);
  }
});
