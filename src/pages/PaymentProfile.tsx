import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Copy, ChevronRight, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocationDetection } from "@/hooks/useLocationDetection";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidE164, toE164, displayPhone } from "@/lib/phone";
import { confirmedAccountPhone } from "@/lib/onboardingPhone";

const db = supabase as any;

/** Loads the payment profile; first visit seeds name + mobile from the main profile. */
export const usePaymentProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payment-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await db.from("payment_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (!data || !data.name || !data.mobile || !data.city || !data.state || !data.address) {
        const { data: p } = await db.from("profiles").select("full_name,phone,whatsapp_number,precise_address,city,state,country,postal_code").eq("user_id", user!.id).maybeSingle();
        const row = {
          user_id: user!.id, name: data?.name || p?.full_name || null, mobile: data?.mobile || p?.phone || p?.whatsapp_number || null,
          address: data?.address || p?.precise_address || null, city: data?.city || p?.city || null, state: data?.state || p?.state || null,
          country: data?.country || p?.country || null, postal_code: data?.postal_code || p?.postal_code || null,
        };
        const res = await db.from("payment_profiles").upsert(row, { onConflict: "user_id" }).select().maybeSingle();
        data = res.data || { ...row, email: user!.email };
      }
      const { data: c } = await supabase.functions.invoke("create-api-subscription", { body: { action: "payment_customer" } });
      return { ...data, email: user!.email || data.email, customer_id: c?.customer_id || null };
    },
  });
};

const fmtAddr = (a?: any) => (a?.address ? [a.address, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ") : null);

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-all text-sm font-medium">{value || "Not set"}</p>
    </div>
    {value && (
      <Button variant="ghost" size="icon" aria-label={`Copy ${label}`} onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); }}>
        <Copy className="h-4 w-4" />
      </Button>
    )}
  </div>
);

export default function PaymentProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  // Number confirmed on the login account stays read-only here — it can only
  // change when the account's own number changes.
  const authPhone = confirmedAccountPhone(user);
  const { data, isLoading } = usePaymentProfile();
  const [sp, setSp] = useSearchParams();
  const editing = sp.get("edit") === "1";
  const setEditing = (v: boolean) => (v ? setSp({ edit: "1" }, { replace: true }) : navigate({ search: "" }, { replace: true }));
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loc, setLoc] = useState({ address: "", city: "", state: "", country: "", postal_code: "" });
  const setL = (k: keyof typeof loc) => (e: React.ChangeEvent<HTMLInputElement>) => setLoc((o) => ({ ...o, [k]: e.target.value }));
  const [saving, setSaving] = useState(false);
  const [gstin, setGstin] = useState("");
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
  const last10 = (v?: string | null) => String(v || "").replace(/\D/g, "").slice(-10);
  const changed = last10(mobile) !== last10(data?.mobile);
  const [duplicate, setDuplicate] = useState(false);
  useEffect(() => {
    setDuplicate(false);
    if (authPhone) return; // locked to the login account number — no duplicate check needed
    const d = last10(mobile);
    if (!changed || d.length !== 10) return;
    const t = setTimeout(async () => {
      const { data: r } = await supabase.functions.invoke("create-api-subscription", { body: { action: "payment_mobile_taken", mobile: d } });
      setDuplicate(!!r?.taken);
    }, 400);
    return () => clearTimeout(t);
  }, [mobile, changed, authPhone]);

  useEffect(() => { if (data) { setName(data.name || ""); setMobile(data.mobile || ""); setLoc({ address: data.address || "", city: data.city || "", state: data.state || "", country: data.country || "India", postal_code: data.postal_code || "" }); setGstin(data.gstin || ""); } }, [data]);

  const save = async () => {
    const mobileE164 = authPhone || toE164(mobile);
    if (name.trim().length < 2) return toast.error("Enter your full name");
    if (!isValidE164(mobileE164)) return toast.error("Enter a valid mobile number with country code");
    const t = Object.fromEntries(Object.entries(loc).map(([k, v]) => [k, v.trim()])) as typeof loc;
    if (t.address.length < 5) return toast.error("Enter your full address");
    if (!t.city) return toast.error("Enter your city");
    if (!t.state) return toast.error("Enter your state");
    if (!t.country) return toast.error("Enter your country");
    if (!/^[A-Za-z0-9 -]{4,10}$/.test(t.postal_code)) return toast.error("Enter a valid pincode");
    const g = gstin.trim().toUpperCase();
    if (g && !/^[0-9]{2}[A-Z0-9]{13}$/.test(g)) return toast.error("Enter a valid 15-character GSTIN");
    if (!authPhone && duplicate) return toast.error("This mobile number is already used in another payment profile");
    setSaving(true);
    const { error } = await db.from("payment_profiles").upsert({ user_id: user!.id, name: name.trim(), mobile: mobileE164, ...t, gstin: g || null, billing_address_2: null }, { onConflict: "user_id" });
    if (!error) await supabase.functions.invoke("create-api-subscription", { body: { action: "payment_customer_sync" } }).catch(() => null);
    setSaving(false);
    if (error) return toast.error(error.code === "23505" ? "This mobile number is already used in another payment profile" : error.message);
    toast.success("Payment profile saved");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["payment-profile"] });
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-3">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => (editing ? setEditing(false) : navigate(-1))}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="flex-1 text-lg font-semibold">{editing ? "Edit Payment Profile" : "Payment Profile"}</h1>
          {!editing && <Button variant="ghost" size="icon" aria-label="Edit payment profile" onClick={() => setEditing(true)}><Pencil className="h-5 w-5" /></Button>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : editing ? (
          <div className="space-y-4 p-4">
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Full name</span><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
            {authPhone ? (
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">Mobile number</span>
                <Input value={authPhone} disabled />
                <span className="text-xs text-muted-foreground">Number comes from your login account and updates only when that changes.</span>
              </label>
            ) : (
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">Mobile number</span>
                <PhoneInput value={mobile} onChange={setMobile} />
              </label>
            )}
            {duplicate && <p className="text-sm text-destructive">This mobile number is already used in another payment profile.</p>}
            <Button type="button" variant="outline" className="w-full" onClick={detectExactLocation} disabled={detecting}>
              {detecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
              {detecting ? "Detecting location..." : "Auto Location"}
            </Button>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Full address</span><Input value={loc.address} onChange={setL("address")} maxLength={300} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">City</span><Input value={loc.city} onChange={setL("city")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">State</span><Input value={loc.state} onChange={setL("state")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Country</span><Input value={loc.country} onChange={setL("country")} maxLength={80} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Pincode</span><Input inputMode="numeric" value={loc.postal_code} onChange={setL("postal_code")} maxLength={10} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">GSTIN (optional)</span><Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="27ABCDE1234F2Z5" /></label>
            <Button type="button" variant="outline" className="w-full justify-between" onClick={() => navigate("/payment-profile/shipping-address")}>
              <span>Shipping address{data?.shipping_address?.address ? "" : " (not set)"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            <label className="block space-y-1"><span className="text-sm text-muted-foreground">Email ID</span><Input value={data?.email || ""} disabled /><span className="text-xs text-muted-foreground">Email comes from your login account and updates only when that changes.</span></label>
            <Button className="w-full" onClick={save} disabled={saving || duplicate}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </div>
        ) : (
          <>
            <Row label="Name" value={data?.name} />
            <Row label="Mobile Number" value={displayPhone(data?.mobile)} />
            <Row label="Email ID" value={data?.email} />
            <Row label="Address" value={data?.address} />
            <Row label="City" value={data?.city} />
            <Row label="State" value={data?.state} />
            <Row label="Country" value={data?.country} />
            <Row label="Pincode" value={data?.postal_code} />
            <Row label="GSTIN" value={data?.gstin} />
            <Row label="Shipping Address" value={data?.shipping_address?.address ? fmtAddr(data.shipping_address) : null} />
            <Row label="Customer ID" value={data?.customer_id} />
            <Row label="User ID" value={user?.id} />
          </>
        )}
      </main>
    </div>
  );
}
