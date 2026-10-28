import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ApiSubscriptionSettings() {
  const navigate = useNavigate();
  const [price, setPrice] = useState("500");
  const [trial, setTrial] = useState("30");
  const [freeCalls, setFreeCalls] = useState("5000");
  const [callPrice, setCallPrice] = useState("0.25");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("setting_key,setting_value")
      .in("setting_key", ["api_subscription_price", "api_trial_days", "api_free_calls", "api_call_price"])
      .then(({ data }) => data?.forEach((r) => {
        if (r.setting_key === "api_subscription_price") setPrice(r.setting_value ?? "500");
        if (r.setting_key === "api_trial_days") setTrial(r.setting_value ?? "30");
        if (r.setting_key === "api_free_calls") setFreeCalls(r.setting_value ?? "5000");
        if (r.setting_key === "api_call_price") setCallPrice(r.setting_value ?? "0.25");
      }));
  }, []);

  const save = async () => {
    const p = Math.round(Number(price)), t = Math.round(Number(trial)), f = Math.round(Number(freeCalls));
    const c = Math.round(Number(callPrice) * 100) / 100;
    if (!(p >= 1) || !(t >= 0) || !(f >= 0)) return toast.error("Enter a valid price, trial days and free calls");
    if (!(c >= 0.01)) return toast.error("Enter a valid price per API call (minimum ₹0.01)");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows = [["api_subscription_price", String(p)], ["api_trial_days", String(t)], ["api_free_calls", String(f)], ["api_call_price", String(c)]];
    for (const [k, v] of rows) {
      const { error } = await supabase.from("app_settings").update({ setting_value: v, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("setting_key", k);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success("API pricing saved.");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-lg font-semibold text-foreground">API Subscription Pricing</h1>
      </header>
      <div className="mx-auto max-w-lg p-4">
        <Card>
          <CardHeader><CardTitle>Developer API plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Monthly price (₹)</Label>
              <Input id="price" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial">Free trial for first subscription (days)</Label>
              <Input id="trial" type="number" min={0} value={trial} onChange={(e) => setTrial(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="freeCalls">Free API calls per user each month</Label>
              <Input id="freeCalls" type="number" min={0} value={freeCalls} onChange={(e) => setFreeCalls(e.target.value)} />
              <p className="text-xs text-muted-foreground">Given on the 1st of every month to users with an active subscription.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callPrice">Price per extra API call (₹)</Label>
              <Input id="callPrice" type="number" min={0.01} step={0.01} value={callPrice} onChange={(e) => setCallPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">Users pay this per call when they increase their API limit. 25 paise = 0.25.</p>
            </div>
            <p className="text-xs text-muted-foreground">Changes apply to new subscriptions. Existing subscribers keep their current price.</p>
            <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
