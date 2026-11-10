import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Navigation, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationDetection } from "@/hooks/useLocationDetection";
import { usePaymentProfile } from "./PaymentProfile";

const db = supabase as any;

export default function ShippingAddress() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = usePaymentProfile();
  const [loc, setLoc] = useState({ address: "", city: "", state: "", country: "India", postal_code: "" });
  const setL = (k: keyof typeof loc) => (e: React.ChangeEvent<HTMLInputElement>) => setLoc((o) => ({ ...o, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const hasSaved = !!data?.shipping_address?.address;
  const { state: locState, detectExactLocation } = useLocationDetection({
    onLocationDetected: (l) => {
      setLoc((o) => ({
        ...o,
        address: l.fullAddress || o.address,
        city: l.city || o.city,
        state: l.state || o.state,
        country: l.country || o.country,
        postal_code: l.postcode || o.postal_code,
      }));
      toast.success("Location detected — check the fields and save");
    },
  });
  const detecting = locState === "detecting-geo" || locState === "detecting-ip";

  useEffect(() => {
    const s = data?.shipping_address;
    if (s?.address) setLoc({ address: s.address || "", city: s.city || "", state: s.state || "", country: s.country || "India", postal_code: s.postal_code || "" });
  }, [data]);

  const save = async () => {
    const t = Object.fromEntries(Object.entries(loc).map(([k, v]) => [k, String(v).trim()])) as typeof loc;
    if (t.address.length < 5) return toast.error("Enter the full shipping address");
    if (!t.city) return toast.error("Enter the city");
    if (!t.state) return toast.error("Enter the state");
    if (!t.country) return toast.error("Enter the country");
    if (!/^[A-Za-z0-9 -]{4,10}$/.test(t.postal_code)) return toast.error("Enter a valid pincode");
    if (!user?.id) return;
    setSaving(true);
    const { error } = await db.from("payment_profiles").upsert({ user_id: user.id, shipping_address: t }, { onConflict: "user_id" });
    if (!error) await supabase.functions.invoke("create-api-subscription", { body: { action: "payment_customer_sync" } }).catch(() => null);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Shipping address saved");
    qc.invalidateQueries({ queryKey: ["payment-profile"] });
  };

  const remove = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await db.from("payment_profiles").upsert({ user_id: user.id, shipping_address: null }, { onConflict: "user_id" });
    if (!error) await supabase.functions.invoke("create-api-subscription", { body: { action: "payment_customer_sync" } }).catch(() => null);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Shipping address removed");
    setLoc({ address: "", city: "", state: "", country: "India", postal_code: "" });
    qc.invalidateQueries({ queryKey: ["payment-profile"] });
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-3">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="flex-1 text-lg font-semibold">Shipping Address</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4 p-4">
            <Button type="button" variant="outline" className="w-full" onClick={detectExactLocation} disabled={detecting}>
              {detecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              {detecting ? "Detecting location..." : "Auto Location"}
            </Button>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Full address</span><Input value={loc.address} onChange={setL("address")} maxLength={300} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">City</span><Input value={loc.city} onChange={setL("city")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">State</span><Input value={loc.state} onChange={setL("state")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Country</span><Input value={loc.country} onChange={setL("country")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Pincode</span><Input inputMode="numeric" value={loc.postal_code} onChange={setL("postal_code")} maxLength={10} /></label>
            <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            {hasSaved && (
              <Button variant="outline" className="w-full text-destructive" onClick={remove} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" />Remove shipping address
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
