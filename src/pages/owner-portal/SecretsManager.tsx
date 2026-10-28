import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Save, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SECRETS = [
  {
    name: "GOOGLE_CUSTOM_SEARCH_API_KEY",
    label: "Custom Search API Key",
    help: "Google API key for Programmable Search (starts with AIza…)",
    group: "search",
  },
  { name: "GOOGLE_CUSTOM_SEARCH_ENGINE_ID", label: "Search Engine ID", help: "Programmable Search engine (cx)", group: "search" },
  {
    name: "GOOGLE_CALENDAR_API_JSON",
    label: "Calendar API JSON",
    help: "Service account JSON for Google Calendar (Indian Holidays festival sync)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "GOOGLE_DRIVE_API_JSON",
    label: "Drive API JSON",
    help: "Service account JSON for Google Drive (invoice uploads)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "GOOGLE_SHEETS_API_JSON",
    label: "Sheets API JSON",
    help: "Service account JSON for Google Sheets (exports & sync)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "GOOGLE_INDEXING_API_JSON",
    label: "Indexing API Bot JSON",
    help: "Service account JSON for Google Indexing API (job URL indexing bot)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "GOOGLE_WEB_SEARCH_INDEXING_API_JSON",
    label: "Web Search Indexing API JSON",
    help: "Service account JSON for web page indexing (site, employer & static pages)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "YOUTUBE_DATA_API_JSON",
    label: "YouTube Data API v3 JSON",
    help: "Service account JSON for YouTube Data API v3 (search, video & channel data)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "YOUTUBE_EMBEDDED_PLAYER_JSON",
    label: "YouTube Embedded Player JSON",
    help: "Service account JSON for YouTube embedded player (embeddable video lookups & playback checks)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "VERTEX_AI_API_JSON",
    label: "Vertex AI API JSON",
    help: "Service account JSON for Vertex AI (fallback for vector search & embeddings)",
    multiline: true,
    group: "cloud",
  },
  {
    name: "GOOGLE_VECTOR_SEARCH_API_JSON",
    label: "Vector Search API JSON",
    help: "Service account JSON for Vertex AI Vector Search (job search embeddings & index)",
    multiline: true,
    group: "cloud",
  },
  { name: "GOOGLE_OAUTH_CLIENT_ID", label: "Google Client ID", help: "Ek hi OAuth 2.0 Client ID sabhi Google connects ke liye (YouTube, Gmail, AdSense, Search Console, Analytics, Drive, Business Profile)", group: "oauth" },
  { name: "GOOGLE_OAUTH_CLIENT_SECRET", label: "Google Client Secret", help: "Ek hi OAuth 2.0 Client Secret sabhi Google connects ke liye (YouTube, Gmail, AdSense, Search Console, Analytics, Drive, Business Profile)", group: "oauth" },
  { name: "INSTAGRAM_APP_ID", label: "Instagram App ID", help: "Meta app → Instagram → API setup with Instagram login → Instagram app ID", group: "oauth" },
  { name: "INSTAGRAM_APP_SECRET", label: "Instagram App Secret", help: "Meta app → Instagram → API setup with Instagram login → Instagram app secret", group: "oauth" },
  { name: "META_APP_ID", label: "Meta App ID", help: "Meta app → App settings → Basic → App ID (used for WhatsApp, Facebook and Instagram connect)", group: "oauth" },
  { name: "META_APP_SECRET", label: "Meta App Secret", help: "Meta app → App settings → Basic → App secret", group: "oauth" },
  { name: "TURNSTILE_SITE_KEY", label: "Cloudflare Turnstile Site Key", help: "Cloudflare → Turnstile → your widget → Site Key (0x… se shuru). Job seeker & Employer login par security check. Dono keys save hone par hi ON hoga", group: "platform" },
  { name: "TURNSTILE_SECRET_KEY", label: "Cloudflare Turnstile Secret Key", help: "Cloudflare → Turnstile → your widget → Secret Key. Apni website domain widget ke Hostnames mai add kare", group: "platform" },
  { name: "VERCEL_CLIENT_ID", label: "Vercel Client ID", help: "Vercel → Team Settings → Integrations → Integration Console → your app → Client ID (oac_… se shuru)", group: "platform" },
  { name: "VERCEL_CLIENT_SECRET", label: "Vercel Client Secret", help: "Vercel Integration Console → your app → Client Secret", group: "platform" },
  { name: "VERCEL_INTEGRATION_SLUG", label: "Vercel Integration URL Slug", help: "Integration Console → your app → URL Slug (jaise my-app). oac_ Client ID ke saath zaroori", group: "platform" },
  { name: "SB_OAUTH_CLIENT_ID", label: "Supabase OAuth Client ID", help: "Supabase dashboard → Organization Settings → OAuth Apps → your app → Client ID (UUID jaisa)", group: "platform" },
  { name: "SB_OAUTH_CLIENT_SECRET", label: "Supabase OAuth Client Secret", help: "Supabase → OAuth Apps → your app → Client Secret (sba_… se shuru, Client ID se alag hota hai)", group: "platform" },
  { name: "R2_ACCOUNT_ID", label: "Cloudflare Account ID", help: "Cloudflare dashboard → R2 → Account details (32-character hex ID)", group: "cdn" },
  { name: "R2_ACCESS_KEY_ID", label: "R2 Access Key ID", help: "Cloudflare R2 → Manage R2 API tokens → Account API token → Access Key ID", group: "cdn" },
  { name: "R2_SECRET_ACCESS_KEY", label: "R2 Secret Access Key", help: "Same R2 API token → Secret Access Key (shown only once)", group: "cdn" },
  { name: "R2_API_TOKEN", label: "R2 Bucket Management API Token", help: "Cloudflare → My Profile → API Tokens → Create Custom Token → Account: Workers R2 Storage: Edit, limited to your account. Paste the API token, not the S3 Access Key. Bucket creation, deletion and public access settings use this token; storage/request charges may apply.", group: "cdn" },
  { name: "R2_BUCKET_NAME", label: "R2 Bucket Name", help: "Cloudflare R2 bucket holding hero banners (e.g. workly-banners)", group: "cdn" },
  { name: "R2_PUBLIC_URL", label: "R2 Public URL", help: "Bucket → Public access → r2.dev URL (https://pub-….r2.dev), no trailing slash", group: "cdn" },
  { name: "PAYPAL_CLIENT_ID", label: "PayPal Client ID", help: "developer.paypal.com → Apps & Credentials → your app → Client ID", group: "payments" },
  { name: "PAYPAL_CLIENT_SECRET", label: "PayPal Client Secret", help: "Same PayPal app → Secret (shown with the Client ID)", group: "payments" },
  { name: "PAYPAL_MODE", label: "PayPal Mode", help: "sandbox for testing, live for real payments (default: live)", group: "payments" },
  { name: "PAYPAL_WEBHOOK_ID", label: "PayPal Webhook ID", help: "PayPal app → Webhooks → Add webhook → URL: https://jubwzelupbntbetpajqb.supabase.co/functions/v1/paypal-webhook → save karne par jo Webhook ID milta hai", group: "payments" },
] as const;

type SecretDef = (typeof SECRETS)[number];

const SecretRow = ({
  def,
  saved,
  onSaved,
}: {
  def: SecretDef;
  saved?: string;
  onSaved: (value: string) => void;
}) => {
  const [value, setValue] = useState(saved ?? "");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(saved ?? ""), [saved]);
  const isSaved = !!saved;

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("owner_secrets")
      .upsert({ name: def.name, value, category: "google_cloud" }, { onConflict: "name" });
    setSaving(false);
    if (error) return toast.error(`Could not save: ${error.message}`);
    onSaved(value);
    toast.success(`${def.label} ${isSaved ? "updated" : "saved"}`);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{def.label}</p>
          <p className="break-all font-mono text-[11px] text-muted-foreground">{def.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{def.help}</p>
        </div>
        {isSaved && (
          <Badge variant="secondary" className="shrink-0 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {"multiline" in def && def.multiline ? (
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder='Paste full service account JSON ({"type":"service_account",...})'
            className="min-h-[120px] min-w-0 font-mono text-xs"
            autoComplete="off"
            aria-label={def.label}
          />
        ) : (
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste value"
            className="min-w-0 font-mono text-xs"
            autoComplete="off"
            aria-label={def.label}
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => setShow((previous) => !previous)}
          aria-label={show ? `Hide ${def.label}` : `Show ${def.label}`}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <Button onClick={save} disabled={value === (saved ?? "") || saving} className="w-full" size="sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isSaved ? "Update" : "Save"}
      </Button>
    </div>
  );
};

const SecretsManager = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("owner_secrets")
        .select("name,value")
        .in("name", SECRETS.map((item) => item.name));
      if (error) toast.error(`Could not load secrets: ${error.message}`);
      const map: Record<string, string> = {};
      (data ?? []).forEach((row: { name: string; value: string }) => { map[row.name] = row.value; });
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const savedCount = SECRETS.filter((item) => values[item.name]).length;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Secrets</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-3 pt-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="text-sm">
          <p className="font-medium text-foreground">Google Secrets</p>
            <p className="text-xs text-muted-foreground">{savedCount} of {SECRETS.length} saved. Only the Owner can view these.</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom Search</h2>
              {SECRETS.filter((def) => def.group === "search").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Google Cloud</h2>
              {SECRETS.filter((def) => def.group === "cloud").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">OAuth 2.0 Client IDs</h2>
              {SECRETS.filter((def) => def.group === "oauth").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vercel & Supabase Connect</h2>
              {SECRETS.filter((def) => def.group === "platform").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cloudflare CDN (R2)</h2>
              {SECRETS.filter((def) => def.group === "cdn").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</h2>
              {SECRETS.filter((def) => def.group === "payments").map((def) => (
                <SecretRow
                  key={def.name}
                  def={def}
                  saved={values[def.name]}
                  onSaved={(value) => setValues((previous) => ({ ...previous, [def.name]: value }))}
                />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SecretsManager;
