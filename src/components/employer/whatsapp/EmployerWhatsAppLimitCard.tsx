import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NumberRow, type NumLimit } from "@/pages/developers/DeveloperWhatsAppLimits";

/** Same limit row as the WhatsApp limits page, for the selected employer number. */
export default function EmployerWhatsAppLimitCard({ phoneNumberId }: { phoneNumberId: string | null }) {
  const [row, setRow] = useState<NumLimit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.functions.invoke("workly-india", { body: { scope: "sub_manage", action: "limits_overview" } });
      const nums: NumLimit[] = data?.success ? data.account?.numbers || [] : [];
      if (alive) { setRow(nums.find((n) => n.phone_number_id === phoneNumberId) ?? nums[0] ?? null); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [phoneNumberId]);

  return (
    <section className="w-full border-b border-border bg-background">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold sm:px-6">
        <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />WhatsApp limits
      </h2>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : row ? <NumberRow n={row} /> : <p className="px-4 py-5 text-sm text-muted-foreground sm:px-6">No limit details yet.</p>}
    </section>
  );
}
