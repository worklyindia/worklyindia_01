import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { employerScope, setSelectedNumber, useSelectedNumber } from "./selectedNumber";

export interface EmployerWhatsAppAccount {
  id?: string;
  company_id: string;
  status: string;
  phone_number_id?: string | null;
  is_default?: boolean;
  display_phone: string | null;
  verified_name: string | null;
  business_name: string | null;
  quality_rating: string | null;
  connected_at: string | null;
  ai_auto_reply?: boolean;
  ai_tone?: string;
  ai_language?: string;
  ai_business_info?: string;
  ai_custom_instructions?: string;
  ai_signature?: string;
  ai_reply_length?: string;
}

export async function employerWhatsAppErr(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text();
    try { const j = JSON.parse(text); return typeof j.error === "string" ? j.error : JSON.stringify(j.error); } catch { return text; }
  }
  return (error as Error)?.message || "Something went wrong";
}

/** Calls the employer-scoped WhatsApp actions; the selected number is used unless the body names one. */
export async function employerWhatsAppAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("workly-india", { body: { ...employerScope(), ...body } });
  if (error) throw new Error(await employerWhatsAppErr(error));
  if (!data?.success) throw new Error(typeof data?.error === "string" ? data.error : "Request failed");
  if (['connect', 'manual_connect', 'disconnect', 'set_default'].includes(String(body.action))) notifyConnectionUpdated();
  return data;
}

export function useEmployerWhatsApp() {
  const [accounts, setAccounts] = useState<EmployerWhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const selected = useSelectedNumber();

  const reload = useCallback(async () => {
    const { data } = await supabase.from("employer_whatsapp_accounts" as any).select("*")
      .eq("status", "connected").order("is_default", { ascending: false }).order("connected_at", { ascending: true });
    const rows = ((data as any[]) ?? []).filter((r) => r.phone_number_id) as EmployerWhatsAppAccount[];
    setAccounts(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useConnectionRefresh(reload);

  const account = accounts.find((a) => a.phone_number_id === selected) ?? accounts[0] ?? null;
  useEffect(() => {
    if (!loading && account?.phone_number_id && account.phone_number_id !== selected) setSelectedNumber(account.phone_number_id);
    if (!loading && !account && selected) setSelectedNumber(null);
  }, [loading, account, selected]);

  return { account, accounts, connected: !!account, loading, reload };
}
