import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_AUDIENCE } from "@/lib/whatsappAudience";

/** Total unread WhatsApp messages for menus. Resets when chats are opened (unread_count → 0). */
export function useWhatsAppUnreadTotal(scope: { companyId?: string | null; owner?: boolean }) {
  const { companyId, owner } = scope;
  const [total, setTotal] = useState(0);
  const enabled = owner || !!companyId;

  const load = useCallback(async () => {
    if (!enabled) return;
    let q = supabase.from("whatsapp_conversations").select("unread_count").gt("unread_count", 0);
    q = owner ? q.eq("audience", CHAT_AUDIENCE).is("company_id", null) : q.eq("company_id", companyId!);
    const { data } = await q;
    setTotal((data || []).reduce((s, r: any) => s + (r.unread_count || 0), 0));
  }, [enabled, owner, companyId]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const ch = supabase
      .channel(`wa-unread-${owner ? "owner" : companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, load, owner, companyId]);

  return total;
}
