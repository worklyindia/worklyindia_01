import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { isTurnstileHostAllowed, parseDomains } from "@/lib/turnstileDomain";
import { CANONICAL_DOMAIN_STORAGE_KEY, DEFAULT_CANONICAL_DOMAIN } from "@/config/domainConfig";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
const loadScript = () => {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("turnstile_load_failed")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

export const useTurnstileConfig = () =>
  useQuery({
    queryKey: ["turnstile-config"],
    queryFn: async () => {
      const off = { enabled: false, siteKey: null as string | null };
      const [{ data, error }, saved] = await Promise.all([
        supabase.functions.invoke("unified-2fa", { body: { action: "turnstile-config" } }),
        supabase.from("app_settings").select("setting_value").eq("setting_key", CANONICAL_DOMAIN_STORAGE_KEY).maybeSingle(),
      ]);
      if (error || !data) return off;
      const cfg = data as { enabled: boolean; siteKey: string | null };
      // Shown only on the domain saved in Owner Portal → Domains → Domain Settings; hidden elsewhere.
      const domains = parseDomains(saved.data?.setting_value || DEFAULT_CANONICAL_DOMAIN);
      if (!isTurnstileHostAllowed(window.location.hostname, domains)) return off;
      return { enabled: cfg.enabled, siteKey: cfg.siteKey };
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

/** Returns ok:true when Turnstile is off or the token passes Cloudflare's server check. */
export const verifyTurnstile = async (token: string | null): Promise<boolean> => {
  const { data, error } = await supabase.functions.invoke("unified-2fa", { body: { action: "turnstile-verify", token } });
  return !error && data?.ok === true;
};

export interface TurnstileHandle { reset: () => void }

interface Props { siteKey: string; onToken: (token: string | null) => void }

const TurnstileWidget = forwardRef<TurnstileHandle, Props>(({ siteKey, onToken }, ref) => {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();

  useImperativeHandle(ref, () => ({
    reset: () => { onToken(null); if (widgetId.current) window.turnstile?.reset(widgetId.current); },
  }));

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: theme === "dark" ? "dark" : theme === "light" ? "light" : "auto",
          size: "flexible",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, theme]);

  return (
    <div className="w-full">
      <div ref={box} className="w-full min-h-[65px]" />
      {failed && <p className="text-xs text-destructive">Security check could not load. Please refresh the page.</p>}
    </div>
  );
});
TurnstileWidget.displayName = "TurnstileWidget";
export default TurnstileWidget;
