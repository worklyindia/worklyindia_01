import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppAudience = "job_seeker" | "employer" | "customer_service";
/** WhatsApp chat, business profile and support openers always use the Customer Service number. */
export const CHAT_AUDIENCE: WhatsAppAudience = "customer_service";
const KEY = "wa_owner_audience";
const EVT = "wa-audience-change";

export function whatsappTemplateName(key: string, audience: WhatsAppAudience): string {
  const base = key.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
  const suffix = `_${audience}`;
  return (base.endsWith(suffix) ? base : `${base}${suffix}`).slice(0, 512);
}

export function isWhatsAppTemplateForAudience(name: string | null | undefined, audience: WhatsAppAudience): boolean {
  const value = String(name || "").toLowerCase();
  return value.endsWith(`_${audience}`);
}

export function getWhatsAppAudience(): WhatsAppAudience {
  return localStorage.getItem(KEY) === "employer" ? "employer" : "job_seeker";
}

export function setWhatsAppAudience(a: WhatsAppAudience) {
  localStorage.setItem(KEY, a);
  window.dispatchEvent(new CustomEvent(EVT, { detail: a }));
}

export function useWhatsAppAudience(): [WhatsAppAudience, (a: WhatsAppAudience) => void] {
  const [a, setA] = useState<WhatsAppAudience>(getWhatsAppAudience);
  useEffect(() => {
    const on = () => setA(getWhatsAppAudience());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [a, setWhatsAppAudience];
}

/** Same as supabase.functions.invoke, but sends the selected WhatsApp number (audience). */
export function waInvoke(name: string, opts: { body?: any; [k: string]: any } = {}) {
  const body = opts.body && typeof opts.body === "object" && !opts.body.audience
    ? { ...opts.body, audience: getWhatsAppAudience() }
    : opts.body;
  return supabase.functions.invoke(name, { ...opts, body });
}
