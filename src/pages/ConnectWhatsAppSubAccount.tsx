import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { APP_ID_FALLBACK, isSdkReady, loadSdk } from "@/components/whatsapp/WhatsAppAudienceConnect";

type Info = { developer_name: string | null; user_name: string | null; cancel_url: string };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("workly-india", { body: { scope: "sub_connect", ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const parsed = ctx ? await ctx.json().catch(() => null) : null;
    return parsed ?? { success: false, error: error.message };
  }
  return data;
}

/** Hosted page a developer's user opens to connect their own WhatsApp number (one-time link). */
export default function ConnectWhatsAppSubAccount() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [configId, setConfigId] = useState("");
  const [appId, setAppId] = useState(APP_ID_FALLBACK);
  const sessionRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    document.title = "Connect WhatsApp | Workly India";
    (async () => {
      const res = await call({ action: "session_info", token });
      if (!res?.success) { setError(res?.error || "This link is not valid."); return; }
      setInfo(res);
      const [{ data: cfg }, { data: appCfg }] = await Promise.all([
        supabase.from("app_settings").select("setting_value").eq("setting_key", "fb_whatsapp_es_config_id").maybeSingle(),
        supabase.from("app_settings").select("setting_value").eq("setting_key", "fb_meta_app_id").maybeSingle(),
      ]);
      setConfigId((cfg?.setting_value as string) || "");
      const id = (appCfg?.setting_value as string) || APP_ID_FALLBACK;
      setAppId(id);
      void loadSdk(id).catch(() => {});
    })();
    const onMsg = (event: MessageEvent) => {
      if (!String(event.origin).endsWith("facebook.com")) return;
      try {
        const d = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (d?.type === "WA_EMBEDDED_SIGNUP" && (d.event === "FINISH" || d.event === "FINISH_ONLY_WABA")) {
          sessionRef.current = { waba_id: d.data?.waba_id, phone_number_id: d.data?.phone_number_id };
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [token]);

  const waitForSession = async () => {
    for (let i = 0; i < 60; i++) {
      const s = sessionRef.current;
      if (s.waba_id && s.phone_number_id) return s;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Meta signup details were not received. Please try again.");
  };

  const connect = async () => {
    if (!configId) { setError("WhatsApp connect is not available right now."); return; }
    setBusy(true); setError(""); sessionRef.current = {};
    try { if (!isSdkReady()) await loadSdk(appId); } catch (e) { setBusy(false); setError((e as Error).message); return; }
    window.FB.login((response: any) => {
      void (async () => {
        const code = response?.authResponse?.code;
        if (!code) { setBusy(false); setError("Facebook login was cancelled."); return; }
        try {
          const s = await waitForSession();
          const res = await call({ action: "connect", token, code, ...s });
          if (res?.success) setDone(res.display_phone || "your number");
          else setError(res?.error || "Connection failed");
          if (res?.redirect_url) setTimeout(() => { window.location.href = res.redirect_url; }, 1500);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
      })();
    }, {
      config_id: configId, response_type: "code", override_default_response_type: true,
      extras: { setup: {}, version: "v4", sessionInfoVersion: "3" },
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        {done ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">WhatsApp connected</h1>
            <p className="mt-2 text-sm text-muted-foreground">{done} is connected. Taking you back…</p>
          </>
        ) : !info && !error ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : !info ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Link not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <MessageCircle className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Connect your WhatsApp</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {info.developer_name ? <><b className="text-foreground">{info.developer_name}</b> wants to send WhatsApp messages from your business number.</> : "Connect your WhatsApp Business number to continue."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">You will sign in with Facebook and choose or add a WhatsApp Business number. Powered by Workly India.</p>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={connect}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect with Facebook"}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => { window.location.href = info.cancel_url; }}>Cancel</Button>
          </>
        )}
      </div>
    </main>
  );
}
