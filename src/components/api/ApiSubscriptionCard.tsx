import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Activity, ArrowLeft, CalendarDays, CreditCard, History, KeyRound, Loader2, Plus, Receipt, Wallet, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { isOnSavedDomain } from "@/config/domainConfig";
import ConfirmDisconnectDialog from "@/components/social/ConfirmDisconnectDialog";
import ApiCallHistory from "@/components/api/ApiCallHistory";

declare global { interface Window { Razorpay: any } }

const loadScript = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => resolve(true);
  s.onerror = () => resolve(false);
  document.body.appendChild(s);
});

type Sub = { status: string; activated_at: string | null; expires_at: string | null; payment_mode: string | null };

// Quick-pick call amounts (shared by Increase API Calls and Auto-Top-Up)
const CALL_OPTIONS = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
// Hard cap: no box may accept more than 2,00,000 calls
const MAX_CALLS = 200000;
const MIN_CALLS = 1000;
const clampCalls = (v: string) => {
  const digits = v.replace(/[^0-9]/g, "");
  return digits && Number(digits) > MAX_CALLS ? String(MAX_CALLS) : digits;
};

// Full-screen page with a back header; mobile-first, safe-area aware
function FullPage({ open, title, icon, onBack, children }: { open: boolean; title: string; icon?: React.ReactNode; onBack: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background text-foreground">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 pt-[env(safe-area-inset-top)] sm:px-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        <h2 className="flex min-w-0 items-center gap-2 truncate text-lg font-semibold">{icon}{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">{children}</div>
      </div>
    </div>, document.body
  );
}

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
// Single-line horizontally scrollable quick-pick chips
function ChipRow({ value, options, onSelect, disabled }: { value: string; options: number[]; onSelect: (n: string) => void; disabled?: boolean }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((n) => (
        <Button key={n} type="button" size="sm" className="shrink-0" disabled={disabled} variant={Number(value) === n ? "default" : "outline"} onClick={() => onSelect(String(n))}>{n.toLocaleString("en-IN")}</Button>
      ))}
    </div>
  );
}

async function fnError(data: any, error: any, fallback: string) {
  let msg = data?.message || error?.message;
  try { msg = JSON.parse(await error?.context?.text())?.message || msg; } catch { /* ignore */ }
  return new Error(msg || fallback);
}

export default function ApiSubscriptionCard({ onChange }: { onChange?: (active: boolean) => void }) {
  const { user } = useAuth();
  const [price, setPrice] = useState(500);
  const [trialDays, setTrialDays] = useState(30);
  const [freeCalls, setFreeCalls] = useState(5000);
  const [sub, setSub] = useState<Sub | null>(null);
  const [pastDue, setPastDue] = useState(false);
  const [hadBefore, setHadBefore] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [busy, setBusy] = useState<"auto" | "manual" | "cancel" | "calls" | null>(null);
  const [callPrice, setCallPrice] = useState(0.25);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyCalls, setBuyCalls] = useState("1000");
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupThreshold, setTopupThreshold] = useState("500");
  const [topupCalls, setTopupCalls] = useState("1000");
  const [topupEnabled, setTopupEnabled] = useState(false);
  const [topupSaving, setTopupSaving] = useState(false);
  const [mandateStatus, setMandateStatus] = useState<"none" | "active" | "failed">("none");
  const [cancelTarget, setCancelTarget] = useState<"auto" | "topup" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const { data: s } = await supabase.from("app_settings").select("setting_key,setting_value")
      .in("setting_key", ["api_subscription_price", "api_trial_days", "api_free_calls", "api_call_price"]);
    s?.forEach((r) => {
      if (r.setting_key === "api_subscription_price") setPrice(Number(r.setting_value) || 500);
      if (r.setting_key === "api_trial_days") setTrialDays(Number(r.setting_value) || 0);
      if (r.setting_key === "api_free_calls") setFreeCalls(Number(r.setting_value) || 5000);
      if (r.setting_key === "api_call_price") setCallPrice(Number(r.setting_value) || 0.25);
    });
    if (!user) return;
    const { data: q } = await (supabase.rpc as any)("get_my_api_quota");
    if (q) setQuota(q);
    const { data: t } = await (supabase.from("api_auto_topup_settings") as any)
      .select("threshold_calls,topup_calls,enabled,mandate_status").eq("user_id", user.id).maybeSingle();
    if (t) {
      setTopupThreshold(String(t.threshold_calls));
      setTopupCalls(String(t.topup_calls));
      setTopupEnabled(!!t.enabled);
      setMandateStatus(t.mandate_status === "active" ? "active" : t.mandate_status === "failed" ? "failed" : "none");
    } else {
      setTopupEnabled(false);
      setMandateStatus("none");
    }
    const { data } = await (supabase.from("api_subscriptions") as any)
      .select("status,activated_at,created_at,expires_at,payment_mode")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    const now = Date.now();
    const rows = (data || []) as (Sub & { created_at: string })[];
    // Active only while paid: status active AND paid-until date not passed
    const active = rows
      .filter((d) => d.status === "active" && (!d.expires_at || new Date(d.expires_at).getTime() > now))
      .sort((a, b) => new Date(b.expires_at || 0).getTime() - new Date(a.expires_at || 0).getTime())[0] || null;
    setSub(active);
    setPastDue(!active && rows.some((d) => d.status === "past_due" || (d.status === "active" && d.expires_at)));
    setHadBefore(rows.some((d) => d.status !== "created"));
    onChange?.(!!active);
  }, [user, onChange]);

  useEffect(() => { load(); }, [load]);

  const subscribe = async () => {
    if (!user) return toast.error("Please sign in first");
    setBusy("auto");
    try {
      if (!(await loadScript())) throw new Error("Payment window failed to load");
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: {} });
      if (error || !data?.subscription_id) throw await fnError(data, error, "Could not start subscription");
      new window.Razorpay({
        key: data.key,
        subscription_id: data.subscription_id,
        name: BRAND_CONFIG.name,
        description: data.trial ? `₹1 now, then ₹${data.amount}/month after ${data.trial_days} days` : `₹${data.amount}/month`,
        prefill: { email: user.email },
        handler: async (resp: any) => {
          const { data: v, error: ve } = await supabase.functions.invoke("create-api-subscription", { body: { ...resp, action: "verify" } });
          if (ve || v?.status !== "success") toast.error("Payment verification failed");
          else toast.success("API subscription active! Auto-pay is on.");
          setBusy(null);
          load();
        },
        modal: { ondismiss: () => setBusy(null) },
      }).open();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const payManual = async () => {
    if (!user) return toast.error("Please sign in first");
    setBusy("manual");
    try {
      if (!(await loadScript())) throw new Error("Payment window failed to load");
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "manual_order" } });
      if (error || !data?.order_id) throw await fnError(data, error, "Could not start payment");
      new window.Razorpay({
        key: data.key,
        order_id: data.order_id,
        amount: data.amount * 100,
        currency: "INR",
        name: BRAND_CONFIG.name,
        description: `API access for 1 month — ₹${data.amount} (no auto-pay)`,
        prefill: { email: user.email },
        handler: async (resp: any) => {
          const { data: v, error: ve } = await supabase.functions.invoke("create-api-subscription", { body: { ...resp, action: "manual_verify" } });
          if (ve || v?.status !== "success") toast.error("Payment verification failed");
          else toast.success("Payment received! API access active for 30 days.");
          setBusy(null);
          load();
        },
        modal: { ondismiss: () => setBusy(null) },
      }).open();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const cancelSub = async () => {
    setBusy("cancel");
    try {
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "cancel" } });
      if (error || data?.status !== "success") throw await fnError(data, error, "Could not cancel subscription");
      toast.success("API subscription cancelled. Auto-pay is off.");
      await load();
    } catch (e: any) { toast.error(e.message); throw e; }
    finally { setBusy(null); }
  };

  const callsNum = Math.max(0, Math.floor(Number(buyCalls) || 0));
  const totalInr = Math.round(callsNum * callPrice * 100) / 100;

  const buyExtraCalls = async () => {
    if (!user) return toast.error("Please sign in first");
    if (callsNum < MIN_CALLS || callsNum > MAX_CALLS) return toast.error("Enter between 1,000 and 2,00,000 calls.");
    setBusy("calls");
    try {
      if (!(await loadScript())) throw new Error("Payment window failed to load");
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "calls_order", calls: callsNum } });
      if (error || !data?.order_id) throw await fnError(data, error, "Could not start payment");
      setBuyOpen(false);
      new window.Razorpay({
        key: data.key,
        order_id: data.order_id,
        amount: data.amount_paise,
        currency: "INR",
        name: BRAND_CONFIG.name,
        description: `${Number(data.calls).toLocaleString("en-IN")} extra API calls`,
        prefill: { email: user.email },
        handler: async (resp: any) => {
          const { data: v, error: ve } = await supabase.functions.invoke("create-api-subscription", { body: { ...resp, action: "calls_verify" } });
          if (ve || v?.status !== "success") toast.error("Payment verification failed");
          else toast.success(`${Number(v.calls).toLocaleString("en-IN")} API calls added!`);
          setBusy(null);
          load();
        },
        modal: { ondismiss: () => setBusy(null) },
      }).open();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const topupThresholdNum = Math.max(0, Math.floor(Number(topupThreshold) || 0));
  const topupCallsNum = Math.max(0, Math.floor(Number(topupCalls) || 0));
  const topupCostInr = Math.round(topupCallsNum * callPrice * 100) / 100;

  const disableTopup = async () => {
    if (!user) return;
    setTopupSaving(true);
    try {
      // Also cancels the Razorpay auto-debit authorization server-side
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "topup_mandate_cancel" } });
      if (error || data?.status !== "success") throw await fnError(data, error, "Could not turn off Auto-Top-Up");
      setTopupEnabled(false);
      setMandateStatus("none");
      toast.success("Auto-debit cancelled. Future top-ups are off.");
    } catch (e: any) {
      toast.error(e.message || "Could not update Auto-Top-Up");
      throw e;
    } finally { setTopupSaving(false); }
  };

  // One-time Razorpay authorization: charges the first top-up now and saves
  // the payment method so later top-ups are auto-debited (like a subscription).
  const authorizeTopup = async () => {
    if (!user) return toast.error("Please sign in first");
    if (topupCallsNum < MIN_CALLS || topupCostInr < 1 || topupThresholdNum > MAX_CALLS || topupCallsNum > MAX_CALLS) return toast.error("Enter valid top-up settings (1,000 to 2,00,000 calls) before authorizing.");
    setBusy("calls");
    try {
      if (!(await loadScript())) throw new Error("Payment window failed to load");
      const { data: saved, error: saveError } = await supabase.functions.invoke("create-api-subscription", {
        body: { action: "topup_save", threshold_calls: topupThresholdNum, topup_calls: topupCallsNum },
      });
      if (saveError || saved?.status !== "success") throw await fnError(saved, saveError, "Could not save Auto-Top-Up");
      setTopupEnabled(true);
      const { data, error } = await supabase.functions.invoke("create-api-subscription", { body: { action: "topup_mandate_order" } });
      if (error || !data?.order_id) throw await fnError(data, error, "Could not start authorization");
      setTopupOpen(false);
      new window.Razorpay({
        key: data.key,
        order_id: data.order_id,
        customer_id: data.customer_id,
        recurring: "1",
        amount: data.amount_paise,
        currency: "INR",
        name: BRAND_CONFIG.name,
        description: `Authorize auto-debit — ${Number(data.calls).toLocaleString("en-IN")} API calls now, then automatic`,
        prefill: { email: user.email },
        handler: async (resp: any) => {
          const { data: v, error: ve } = await supabase.functions.invoke("create-api-subscription", { body: { ...resp, action: "topup_mandate_verify" } });
          if (ve || v?.status !== "success") toast.error(v?.message || "Auto-debit authorization failed");
          else toast.success(`Auto-debit authorized! ${Number(v.calls).toLocaleString("en-IN")} API calls added.`);
          setBusy(null);
          load();
        },
        modal: { ondismiss: () => setBusy(null) },
      }).open();
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const trial = !hadBefore && trialDays > 0;
  const manual = sub?.payment_mode === "manual";

  return (
    <section className="space-y-6">
      <div className="space-y-5 border-b border-border pb-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-foreground"><CreditCard className="h-5 w-5 shrink-0 text-primary" /> API Subscription</h2>
          <Badge variant={sub ? "default" : pastDue ? "destructive" : "secondary"}>
            {sub ? "Active" : pastDue ? "Payment due" : "Not subscribed"}
          </Badge>
        </div>
        <p className="text-3xl font-bold text-foreground">₹{price}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        <p className="text-sm text-muted-foreground">
          {sub
            ? manual
              ? "Monthly subscription: paid manually. Auto-pay is off. Pay manually again to renew."
              : `Monthly subscription Auto-pay is on.${sub.expires_at ? ` Next monthly charge is expected around ${fmt(sub.expires_at)}.` : " Next monthly charge date is not available yet."} If renewal payment fails, API access is paused until payment is completed.`
            : pastDue
              ? "Your last monthly payment did not go through, so API access is paused. Pay now to turn it back on."
              : trial
                ? `Pay just ₹1 for the first ${trialDays} days, then ₹${price} is auto-charged every month. Includes free API calls every month. Cancel anytime.`
                : `₹${price} is auto-charged every month via Razorpay. Includes free API calls every month. Cancel anytime.`}
        </p>
        {sub && manual && sub.expires_at && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Access ends: {fmt(sub.expires_at)}</p>
              <p className="text-xs text-muted-foreground">
                {Math.max(0, Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000))} days left. Pay again on or before this date to keep your API access active.
              </p>
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {topupEnabled && mandateStatus === "active"
            ? `API call Auto-Top-Up is on separately: ${Number(topupCalls).toLocaleString("en-IN")} calls are purchased when your balance falls below ${Number(topupThreshold).toLocaleString("en-IN")}. It does not renew your monthly subscription.`
            : topupEnabled
              ? "API call Auto-Top-Up is not active: payment authorization is pending or failed. Extra calls can be purchased manually."
              : "API call Auto-Top-Up is off. Extra calls can be purchased manually; this is separate from your monthly subscription payment."}
        </p>
        {!sub && isOnSavedDomain() && (
          <Button className="h-11 w-full" onClick={subscribe} disabled={!!busy}>
            {busy === "auto" ? <Loader2 className="h-4 w-4 animate-spin" /> : trial ? "Pay ₹1 & start Auto-pay" : `Pay ₹${price} & set up Auto-pay`}
          </Button>
        )}
        {sub && !manual && (
          <Button variant="destructive" className="h-11 w-full" onClick={() => setCancelTarget("auto")} disabled={!!busy}>
            {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Auto-pay"}
          </Button>
        )}
        {(!sub || manual) && (
          <>
            <Button variant="outline" className="h-11 w-full whitespace-normal text-center" onClick={payManual} disabled={!!busy}>
              {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet className="h-4 w-4" /> {manual ? `Renew 1 month — ₹${price}` : `Pay ₹${price} for 1 month`}</>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Manual payment gives 30 days of access. Pay again every month to continue.</p>
          </>
        )}
      </div>
      {quota && (() => {
          const remainingPct = quota.limit > 0 ? Math.max(0, Math.min(100, (quota.remaining / quota.limit) * 100)) : 0;
          const usedPct = 100 - remainingPct;
          // Colour follows the usage % shown in the ring: 0% = nothing used (green) → 100% = limit exhausted (red)
          const usageColorClass = usedPct <= 25 ? "bg-success" : usedPct <= 50 ? "bg-primary" : usedPct <= 75 ? "bg-warning" : "bg-destructive";
          const usageStrokeClass = usedPct <= 25 ? "stroke-success" : usedPct <= 50 ? "stroke-primary" : usedPct <= 75 ? "stroke-warning" : "stroke-destructive";

          return (
            <div className="space-y-5 sm:flex sm:items-center sm:gap-8 sm:space-y-0">
            <div className="flex items-center justify-center sm:justify-start">
              <div className="flex items-center justify-center" role="img" aria-label={`${quota.used.toLocaleString("en-IN")} of ${quota.limit.toLocaleString("en-IN")} API calls used`}>
                <div className="relative h-40 w-40 sm:h-48 sm:w-48">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-muted" />
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(usedPct / 100) * 276.46} 276.46`} className={`${usageStrokeClass} transition-all`} />
                  </svg>
                   <p className="absolute inset-5 flex items-center justify-center whitespace-nowrap text-center text-4xl font-bold leading-none text-foreground sm:inset-6 sm:text-5xl">{usedPct > 0 && usedPct < 1 ? usedPct.toFixed(2) : Math.round(usedPct)}%</p>
                </div>
              </div>
            </div>
              <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><KeyRound className="h-4 w-4 shrink-0 text-primary" /> API Call Limit</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{quota.used.toLocaleString("en-IN")} Used · {quota.remaining.toLocaleString("en-IN")} Calls Left</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={quota.remaining} aria-valuemin={0} aria-valuemax={quota.limit} aria-label="API calls remaining">
                  <div className={`h-full rounded-full ${usageColorClass} transition-all`} style={{ width: `${remainingPct}%` }} />
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>{freeCalls.toLocaleString("en-IN")} free API calls included every month</p>
                  <p>Quota renews automatically on the 1st</p>
                </div>
                <Button className="mt-2 h-11 w-full" onClick={() => setBuyOpen(true)} disabled={!!busy}>
                  <Plus className="h-4 w-4" /> Increase API Calls
                </Button>
                {(isOnSavedDomain() || (topupEnabled && mandateStatus === "active")) && <Button variant="outline" className="h-11 w-full" onClick={() => setTopupOpen(true)} disabled={!!busy}>
                  <Zap className="h-4 w-4" /> {topupEnabled ? "Auto-Top-Up for API Calls" : "Enable Auto-Top-Up for API Calls"}
                  {topupEnabled && mandateStatus === "active" && <Badge variant="secondary" className="ml-auto">On</Badge>}
                  {topupEnabled && mandateStatus !== "active" && <Badge variant="destructive" className="ml-auto">Setup pending</Badge>}
                </Button>}
              </div>
            </div>
          );
      })()}
      <Button variant="outline" className="h-11 w-full" onClick={() => setHistoryOpen(true)}>
        <History className="h-4 w-4" /> API Call History
      </Button>
      <Button variant="outline" className="h-11 w-full" onClick={() => navigate("/developers/logs")}>
        <Activity className="h-4 w-4" /> API Call Logs
      </Button>
      <Button variant="outline" className="h-11 w-full" onClick={() => navigate("/payment-history")}>
        <Receipt className="h-4 w-4" /> Payment History
      </Button>
      {historyOpen && user && <ApiCallHistory userId={user.id} onBack={() => setHistoryOpen(false)} />}
      <FullPage open={buyOpen} title="Increase API Calls" onBack={() => busy !== "calls" && setBuyOpen(false)}>
          {quota && (
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Available API calls</span>
              <span className="font-semibold text-foreground">{quota.remaining.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="mt-4 space-y-3">
            <Label htmlFor="buyCalls">How many API calls?</Label>
            <Input id="buyCalls" type="number" inputMode="numeric" min={MIN_CALLS} max={MAX_CALLS} value={buyCalls} onChange={(e) => setBuyCalls(clampCalls(e.target.value))} />
            <ChipRow value={buyCalls} options={CALL_OPTIONS} onSelect={setBuyCalls} />
            {callsNum > 0 && callsNum < MIN_CALLS && <p className="text-xs text-destructive">Minimum 1,000 API calls.</p>}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBuyOpen(false)} disabled={busy === "calls"}>Cancel</Button>
              <Button className="flex-1" onClick={buyExtraCalls} disabled={!!busy || callsNum < MIN_CALLS || totalInr < 1}>
                {busy === "calls" ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ₹${totalInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
              </Button>
            </div>
          </div>
      </FullPage>
      <FullPage open={topupOpen} title="Auto-Top-Up" icon={<Zap className="h-5 w-5 shrink-0 text-primary" />} onBack={() => !topupSaving && setTopupOpen(false)}>
          <p className="text-sm text-muted-foreground">When your balance runs low, calls are added automatically — you don't have to do anything.</p>
          <div className="mt-4 space-y-4">
            {quota && (
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Available API calls</span>
                <span className="font-semibold text-foreground">{quota.remaining.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="topupThreshold">Auto top-up when balance falls below</Label>
               <Input id="topupThreshold" type="number" inputMode="numeric" min={0} max={MAX_CALLS} disabled={mandateStatus === "active"} value={topupThreshold} onChange={(e) => setTopupThreshold(clampCalls(e.target.value))} />
              <ChipRow value={topupThreshold} options={CALL_OPTIONS} onSelect={setTopupThreshold} disabled={mandateStatus === "active"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topupCalls">Calls to add each time</Label>
               <Input id="topupCalls" type="number" inputMode="numeric" min={MIN_CALLS} max={MAX_CALLS} disabled={mandateStatus === "active"} value={topupCalls} onChange={(e) => setTopupCalls(clampCalls(e.target.value))} />
              <ChipRow value={topupCalls} options={CALL_OPTIONS} onSelect={setTopupCalls} disabled={mandateStatus === "active"} />
              {topupCallsNum > 0 && topupCallsNum < MIN_CALLS && <p className="text-xs text-destructive">Minimum 1,000 API calls.</p>}
            </div>
            {topupEnabled && mandateStatus === "active" && (
              <div className="flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Auto-debit</span>
                <span className="font-semibold text-success">Authorized</span>
              </div>
            )}
            {topupEnabled && mandateStatus === "failed" && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">Last auto-debit failed. Please authorize again with a working payment method.</p>
            )}
             {mandateStatus !== "active" && (
              <Button className="h-11 w-full" onClick={authorizeTopup} disabled={!!busy || topupSaving}>
                 {busy === "calls" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4" /> Authorize Auto-Debit — Pay ₹{topupCostInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })} now</>}
              </Button>
            )}
             {mandateStatus !== "active" && (
              <p className="text-center text-xs text-muted-foreground">One-time authorization via Razorpay (UPI Autopay / card). After this, top-ups are charged automatically — you don't have to do anything.</p>
            )}
             {mandateStatus === "active" && (
               <Button variant="destructive" className="h-11 w-full" onClick={() => setCancelTarget("topup")} disabled={topupSaving || !!busy}>
                 {topupSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Auto-Top-Up"}
               </Button>
             )}
          </div>
      </FullPage>
      <ConfirmDisconnectDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        platform={cancelTarget === "topup" ? "Auto-Top-Up" : "Auto-pay"}
        action="cancel"
        description={cancelTarget === "topup"
          ? "Automatic purchases of extra API calls will stop. Your existing call balance and monthly subscription payment mode will not change."
          : "Your monthly Auto-pay subscription will be cancelled immediately. API access from this subscription will stop until you subscribe again. This does not cancel your separate API call Auto-Top-Up authorization."}
        onConfirm={cancelTarget === "topup" ? disableTopup : cancelSub}
      />
    </section>
  );
}
