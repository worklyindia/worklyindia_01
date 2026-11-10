import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APP_ID_FALLBACK, isSdkReady, loadSdk } from "@/components/whatsapp/WhatsAppAudienceConnect";
import { employerWhatsAppAction } from "./useEmployerWhatsApp";
import { consumeDevReturnUrl } from "./selectedNumber";

/** Facebook (Meta embedded signup) connect flow, shared by the employer WhatsApp page and AI Connect. */
export function useEmployerWhatsAppConnect(onConnected: () => void) {
  const [configId, setConfigId] = useState("");
  const [appId, setAppId] = useState(APP_ID_FALLBACK);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  useEffect(() => {
    (async () => {
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
        } else if (d?.type === "WA_EMBEDDED_SIGNUP" && d.event === "ERROR") {
          toast.error(d.data?.error_message || "Meta signup error");
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const waitForSession = async () => {
    for (let i = 0; i < 60; i++) {
      const s = sessionRef.current;
      if (s.waba_id && s.phone_number_id) return s as { waba_id: string; phone_number_id: string };
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Meta signup details were not received. Please try again.");
  };

  const connect = async () => {
    if (!configId.trim()) { toast.error("Meta signup is not available yet."); return; }
    setBusy(true);
    sessionRef.current = {};
    if (!isSdkReady()) {
      try { await loadSdk(appId); } catch (e) { setBusy(false); toast.error((e as Error).message); return; }
    }
    try {
      window.FB.login((response: any) => {
        void (async () => {
          const code = response?.authResponse?.code;
          if (!code) { setBusy(false); toast.error("Facebook login was cancelled"); return; }
          try {
            const s = await waitForSession();
            const data = await employerWhatsAppAction({ action: "connect", code, ...s });
            toast.success(`WhatsApp connected ${data.display_phone || ""}`);
            const returnUrl = consumeDevReturnUrl();
            if (returnUrl) {
              const sep = returnUrl.includes("?") ? "&" : "?";
              window.location.href = `${returnUrl}${sep}connected=1&phone=${encodeURIComponent(data.display_phone || "")}`;
              return;
            }
            onConnected();
          } catch (e) { toast.error((e as Error).message); }
          finally { setBusy(false); }
        })();
      }, {
        config_id: configId.trim(), response_type: "code", override_default_response_type: true,
        extras: { setup: {}, version: "v4", sessionInfoVersion: "3" },
      });
    } catch (e) { setBusy(false); toast.error((e as Error).message || "Could not open Facebook login"); }
  };

  return { connect, busy, setBusy };
}
