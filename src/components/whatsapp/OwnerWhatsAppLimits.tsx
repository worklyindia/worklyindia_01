import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_AUDIENCE } from "@/lib/whatsappAudience";
import { NumberRow, type NumLimit } from "@/pages/developers/DeveloperWhatsAppLimits";

export default function OwnerWhatsAppLimits() {
  const [row, setRow] = useState<NumLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data, error: profileError } = await supabase.functions.invoke("whatsapp-cloud-api", {
          body: { action: "get_profile", audience: CHAT_AUDIENCE },
        });
        if (profileError || !data?.success) throw new Error(data?.error || "Could not load WhatsApp limits.");
        const profile = data.profile;
        if (!profile?.phone_number_id) throw new Error("WhatsApp business number is not connected.");
        const now = Date.now();
        const since = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
        const dayAgo = new Date(now - 24 * 3600 * 1000).toISOString();
        const customers = new Set<string>();
        let used = 0;
        for (let offset = 0; ; offset += 1000) {
          const { data: messages, error: messageError } = await supabase.from("whatsapp_messages")
            .select("id,recipient_phone,created_at")
            .is("company_id", null).eq("audience", CHAT_AUDIENCE)
            .eq("whatsapp_phone_number_id", profile.phone_number_id)
            .eq("direction", "outbound").in("status", ["sent", "delivered", "read"])
            .gte("created_at", since).order("created_at").order("id").range(offset, offset + 999);
          if (messageError) throw new Error("Could not load this number's recorded usage.");
          for (const message of messages || []) {
            if (message.recipient_phone) customers.add(message.recipient_phone);
            if (message.created_at && message.created_at >= dayAgo) used += 1;
          }
          if (!alive) return;
          if (!messages || messages.length < 1000) break;
        }
        const tier = String(profile.messaging_limit || "TIER_250").toUpperCase();
        const limits: Record<string, number> = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 1000000, UNTIERED: 250, NOT_APPLICABLE: 250 };
        const limit = limits[tier];
        if (!limit) throw new Error(`Messaging limit: ${profile.messaging_limit || "Not available"}`);
        if (alive) setRow({ phone_number_id: profile.phone_number_id, phone: profile.phone_number,
          verified_name: profile.verified_name, quality_rating: profile.quality_rating,
          tier, limit_24h: limit, used_24h: used, remaining_24h: Math.max(limit - used, 0),
          resets_at: null, unique_customers_7d: customers.size });
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Could not load WhatsApp limits.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, []);
  return (
    <section className="w-full border-b border-border bg-background">
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : error ? <p role="alert" className="px-4 py-5 text-sm text-muted-foreground sm:px-6">{error}</p>
        : row ? <><NumberRow n={row} /><p className="px-4 pb-4 text-xs text-muted-foreground sm:px-6">Recorded website usage · last 24 hours</p></> : null}
    </section>
  );
}
