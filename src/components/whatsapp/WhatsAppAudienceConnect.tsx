import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Facebook, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import SupportAccountReplySettings from '@/components/owner/SupportAccountReplySettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Audience = "job_seeker" | "employer" | "customer_service";
const LABEL: Record<Audience, string> = { job_seeker: "Job seekers WhatsApp", employer: "Employers WhatsApp", customer_service: "Customer Service WhatsApp" };
const DESC: Record<Audience, string> = {
  job_seeker: "Messages to job seekers will be sent from this number.",
  employer: "Messages to employers will be sent from this number.",
  customer_service: "All WhatsApp chats and customer support run on this number.",
};
export const APP_ID_FALLBACK = "1092186133267704";
const APP_ID_KEY = "fb_meta_app_id";
const CONFIG_KEY = "fb_whatsapp_es_config_id";

interface Account {
  phone_number_id?: string;
  audience: Audience; status: string; display_phone: string | null; verified_name: string | null;
  business_name: string | null; quality_rating: string | null; connected_at: string | null;
}
interface ConnectionSource {
  source: "audience" | "ai_connect"; source_id: string; phone_number_id: string;
  display_phone: string | null; verified_name: string | null; business_name: string | null;
}

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

let sdkReady = false;
export const isSdkReady = () => sdkReady && !!window.FB;
let sdkPromise: Promise<void> | null = null;
function initFb(appId: string) {
  window.FB.init({ appId: appId || APP_ID_FALLBACK, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
  sdkReady = true;
}
export function loadSdk(appId: string): Promise<void> {
  if (sdkReady && window.FB) return Promise.resolve();
  if (window.FB) { initFb(appId); return Promise.resolve(); }
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const start = Date.now();
    window.fbAsyncInit = () => { if (!sdkReady) initFb(appId); resolve(); };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk"; s.async = true; s.defer = true; s.crossOrigin = "anonymous";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.onerror = () => { sdkPromise = null; reject(new Error("Facebook SDK failed to load (check ad-blocker / network)")); };
      document.body.appendChild(s);
    }
    // Fallback: script already present but fbAsyncInit missed
    const poll = window.setInterval(() => {
      if (window.FB) { window.clearInterval(poll); if (!sdkReady) initFb(appId); resolve(); }
      else if (Date.now() - start > 15000) {
        window.clearInterval(poll); sdkPromise = null;
        reject(new Error("Facebook SDK load timed out. Refresh the page and try again."));
      }
    }, 300);
  });
  return sdkPromise;
}

async function errText(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) return (error as Error)?.message;
  const text = await error.context.text();
  try { const body = JSON.parse(text); return typeof body.error === "string" ? body.error : text; }
  catch { return text; }
}

export default function WhatsAppAudienceConnect({ audiences = ["job_seeker", "employer"] }: { audiences?: Audience[] }) {
  const [accounts, setAccounts] = useState<Record<Audience, Account | null>>({ job_seeker: null, employer: null, customer_service: null });
  const [configId, setConfigId] = useState("");
  const [appId, setAppId] = useState("");
  const [busy, setBusy] = useState<Audience | null>(null);
  const [manualOpen, setManualOpen] = useState<Audience | null>(null);
  const [sources, setSources] = useState<ConnectionSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<Partial<Record<Audience, string>>>({});
  const [manual, setManual] = useState<Record<Audience, { waba_id: string; phone_number_id: string; access_token: string }>>({
    job_seeker: { waba_id: "", phone_number_id: "", access_token: "" },
    employer: { waba_id: "", phone_number_id: "", access_token: "" },
    customer_service: { waba_id: "", phone_number_id: "", access_token: "" },
  });
  const sessionRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});
  const sessionResolverRef = useRef<((value: { waba_id: string; phone_number_id: string }) => void) | null>(null);

  const load = async () => {
    const [{ data }, { data: cfg }, { data: appCfg }, sourceResult] = await Promise.all([
      supabase.from("whatsapp_audience_accounts" as any).select("audience,status,phone_number_id,display_phone,verified_name,business_name,quality_rating,connected_at"),
      supabase.from("app_settings").select("setting_value").eq("setting_key", CONFIG_KEY).maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", APP_ID_KEY).maybeSingle(),
      supabase.functions.invoke("workly-india", { body: { action: "list_notification_sources" } }),
    ]);
    const next: Record<Audience, Account | null> = { job_seeker: null, employer: null, customer_service: null };
    (data as any[] | null)?.forEach((r) => { next[r.audience as Audience] = r; });
    setAccounts(next);
    setSources(sourceResult.data?.success ? sourceResult.data.sources || [] : []);
    setConfigId((cfg?.setting_value as string) || "");
    const id = (appCfg?.setting_value as string) || APP_ID_FALLBACK;
    setAppId(id);
    void loadSdk(id).catch(() => { /* Reuse does not require Facebook login. */ });
  };

  useEffect(() => {
    void load();
    const onMsg = (event: MessageEvent) => {
      if (!String(event.origin).endsWith("facebook.com")) return;
      try {
        const d = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (d?.type === "WA_EMBEDDED_SIGNUP") {
          if (d.event === "FINISH" || d.event === "FINISH_ONLY_WABA") {
            sessionRef.current = { waba_id: d.data?.waba_id, phone_number_id: d.data?.phone_number_id };
            if (d.data?.waba_id && d.data?.phone_number_id) {
              sessionResolverRef.current?.({ waba_id: d.data.waba_id, phone_number_id: d.data.phone_number_id });
              sessionResolverRef.current = null;
            }
          } else if (d.event === "CANCEL") {
            toast.info(`Setup was closed midway${d.data?.current_step ? ` (${d.data.current_step})` : ""}`);
          } else if (d.event === "ERROR") {
            toast.error(d.data?.error_message || "Meta signup error");
          }
        }
      } catch { /* non-JSON message */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useConnectionRefresh(load);

  const connect = async (audience: Audience) => {
    if (!configId.trim()) { toast.error("Meta Configuration ID is not set yet. Please contact the setup team."); return; }
    setBusy(audience);
    sessionRef.current = {};
    // Popup must open synchronously on click; only await if SDK not ready yet
    if (!(sdkReady && window.FB)) {
      try { await loadSdk(appId); }
      catch (e) { setBusy(null); toast.error((e as Error).message); return; }
    }
    // Safety: never leave spinner stuck if popup closed/blocked and FB never calls back
    let settled = false;
    const guard = window.setTimeout(() => {
      if (!settled) { setBusy(null); toast.error("Facebook popup was closed or blocked. Allow popups and try again."); }
    }, 120_000);
    const done = () => { settled = true; window.clearTimeout(guard); };
    const sessionPromise = new Promise<{ waba_id: string; phone_number_id: string }>((resolve, reject) => {
      sessionResolverRef.current = resolve;
      window.setTimeout(() => {
        if (sessionResolverRef.current === resolve) {
          sessionResolverRef.current = null;
          reject(new Error("Meta signup details were not received in time. Please try again."));
        }
      }, 90_000);
    });
    const handle = async (response: any) => {
        done();
        const code = response?.authResponse?.code;
        if (!code) { setBusy(null); toast.error("Facebook login was cancelled"); return; }
        try {
          const current = sessionRef.current;
          const { waba_id, phone_number_id } = current.waba_id && current.phone_number_id
            ? current as { waba_id: string; phone_number_id: string }
            : await sessionPromise;
          const { data, error } = await supabase.functions.invoke("workly-india", {
            body: { action: "connect", audience, code, waba_id, phone_number_id },
          });
          setBusy(null);
          if (error || !data?.success) {
            toast.error(`Connect fail: ${error ? await errText(error) : data?.error}`);
            return;
          }
          notifyConnectionUpdated();
          toast.success(`${LABEL[audience]} connected ${data.display_phone || ""}`);
          if (data.warnings?.length) toast.warning(data.warnings.join(" | "));
          void load();
        } catch (error) {
          setBusy(null);
          toast.error(error instanceof Error ? error.message : "No WhatsApp number was selected");
        }
      };
    try { window.FB.login(
      (response: any) => { void handle(response); },
      {
        config_id: configId.trim(),
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, version: "v4", sessionInfoVersion: "3" },
      },
    ); } catch (e) { done(); setBusy(null); toast.error((e as Error)?.message || "Could not open Facebook login"); }
  };

  const action = async (audience: Audience, act: "disconnect" | "refresh") => {
    setBusy(audience);
    const { data, error } = await supabase.functions.invoke("workly-india", { body: { action: act, audience } });
    setBusy(null);
    if (error || !data?.success) toast.error(error ? await errText(error) : data?.error);
    else { notifyConnectionUpdated(); toast.success(act === "disconnect" ? "Disconnected" : "Refreshed"); }
    void load();
  };

  const manualConnect = async (audience: Audience) => {
    const m = manual[audience];
    if (!m.waba_id.trim() || !m.phone_number_id.trim() || !m.access_token.trim()) {
      toast.error("Please fill in WABA ID, Phone Number ID and Access Token.");
      return;
    }
    setBusy(audience);
    const { data, error } = await supabase.functions.invoke("workly-india", {
      body: {
        action: "manual_connect",
        audience,
        waba_id: m.waba_id.trim(),
        phone_number_id: m.phone_number_id.trim(),
        access_token: m.access_token.trim(),
      },
    });
    setBusy(null);
    if (error || !data?.success) {
      toast.error(`Manual connect fail: ${error ? await errText(error) : data?.error}`);
      return;
    }
    notifyConnectionUpdated();
    toast.success(`${LABEL[audience]} connected ${data.display_phone || ""}`);
    if (data.warnings?.length) toast.warning(data.warnings.join(" | "));
    setManual((prev) => ({ ...prev, [audience]: { waba_id: "", phone_number_id: "", access_token: "" } }));
    setManualOpen(null);
    void load();
  };

  const reuseConnection = async (audience: Audience) => {
    const source = sources.find((item) => `${item.source}:${item.source_id}` === selectedSource[audience]);
    if (!source) return;
    setBusy(audience);
    try {
      const { data, error } = await supabase.functions.invoke("workly-india", {
        body: { action: "reuse_connection", audience, source: source.source, source_id: source.source_id },
      });
      if (error || !data?.success) { toast.error(error ? await errText(error) : data?.error || "Could not link this number"); return; }
      notifyConnectionUpdated();
      toast.success(`${LABEL[audience]} connected ${data.display_phone || ""}`);
      if (data.warnings?.length) toast.warning(data.warnings.join(" | "));
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className={audiences.length > 1 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        {audiences.map((a) => {
          const acc = accounts[a];
          const connected = acc?.status === "connected";
          const availableSources = sources.filter((item) => a !== "customer_service" && !(item.source === "audience" && item.source_id === a));
          return (
            <Card key={a}>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  {LABEL[a]}
                  <Badge variant={connected ? "default" : "secondary"}>{connected ? "Connected" : "Not connected"}</Badge>
                </CardTitle>
                <CardDescription>
                  {DESC[a]}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
                {connected && (
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Number:</span> {acc?.display_phone || "-"}</p>
                    <p><span className="text-muted-foreground">Name:</span> {acc?.verified_name || acc?.business_name || "-"}</p>
                    {acc?.quality_rating && <p><span className="text-muted-foreground">Quality:</span> {acc.quality_rating}</p>}
                  </div>
                )}
                <div className="grid w-full gap-2">
                  {availableSources.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor={`reuse-${a}`}>Use connected number</Label>
                      <Select value={selectedSource[a] || ""} onValueChange={(value) => setSelectedSource((prev) => ({ ...prev, [a]: value }))} disabled={busy !== null}>
                        <SelectTrigger id={`reuse-${a}`} className="w-full"><SelectValue placeholder="Choose a connected number" /></SelectTrigger>
                        <SelectContent>
                          {availableSources.map((item) => (
                            <SelectItem key={`${item.source}:${item.source_id}`} value={`${item.source}:${item.source_id}`}>
                              {item.source === "ai_connect" ? "AI Connect" : LABEL[item.source_id as Audience]} · {item.display_phone || item.verified_name || item.phone_number_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="secondary" className="w-full" onClick={() => reuseConnection(a)} disabled={busy !== null || !availableSources.some((item) => `${item.source}:${item.source_id}` === selectedSource[a])}>
                        {busy === a ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}Link number
                      </Button>
                    </div>
                  )}
                  {!connected && (
                  <Button className="w-full" onClick={() => connect(a)} disabled={busy === a}>
                    {busy === a ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
                    Connect
                  </Button>
                  )}
                  {connected && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => action(a, "refresh")} disabled={busy === a}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button className="w-full" variant="outline" onClick={() => action(a, "disconnect")} disabled={busy === a}>
                        <Unplug className="w-4 h-4 mr-2" />Disconnect
                      </Button>
                    </div>
                  )}
                  {!connected && (<>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setManualOpen(manualOpen === a ? null : a)}
                  >
                    {manualOpen === a ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    Manual setup (without Facebook login)
                  </Button>
                  {manualOpen === a && (
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="space-y-1">
                        <Label htmlFor={`waba-${a}`}>WABA ID</Label>
                        <Input
                          id={`waba-${a}`}
                          placeholder="WhatsApp Business Account ID"
                          value={manual[a].waba_id}
                          onChange={(e) => setManual((p) => ({ ...p, [a]: { ...p[a], waba_id: e.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`phone-${a}`}>Phone Number ID</Label>
                        <Input
                          id={`phone-${a}`}
                          placeholder="Phone number ID"
                          value={manual[a].phone_number_id}
                          onChange={(e) => setManual((p) => ({ ...p, [a]: { ...p[a], phone_number_id: e.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`token-${a}`}>Access Token</Label>
                        <Input
                          id={`token-${a}`}
                          type="password"
                          placeholder="Permanent / system user token"
                          value={manual[a].access_token}
                          onChange={(e) => setManual((p) => ({ ...p, [a]: { ...p[a], access_token: e.target.value } }))}
                        />
                      </div>
                      <Button className="w-full" variant="secondary" onClick={() => manualConnect(a)} disabled={busy === a}>
                        {busy === a ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save & Connect
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Find these details in Meta Developer dashboard → WhatsApp → API Setup. The token is stored only on the server.
                      </p>
                    </div>
                  )}
                  </>)}
                </div>
                {a === 'customer_service' && connected && acc?.phone_number_id && <SupportAccountReplySettings channel="whatsapp" accountId={acc.phone_number_id} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
