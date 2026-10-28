import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";


interface Settings {
  sales_enabled: boolean;
  default_markup_fixed: number;
  renewal_markup_fixed: number;
  protection_price_per_year?: number | null;
  currency: string;
  affiliate_url?: string | null;
  fx_mode?: "live" | "manual" | "ai";
  fx_manual_rate?: number | null;
}

interface FxInfo {
  rate: number;
  day: string;
  source: string;
}

const CHARGE_OPTIONS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

const nearestOption = (value: number) =>
  CHARGE_OPTIONS.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best), CHARGE_OPTIONS[0]);

const formatFxCheckStamp = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("day")}/${value("month")}/${value("year")} • ${value("hour")} : ${value("minute")} : ${value("second")} ${value("dayPeriod").toUpperCase()}`;
};

const DomainPricingSettings = () => {
  const [sales, setSales] = useState(false);
  const [domainCharge, setDomainCharge] = useState(100);
  const [renewalCharge, setRenewalCharge] = useState(100);
  const [protectionPrice, setProtectionPrice] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [fxMode, setFxMode] = useState<"live" | "manual" | "ai">("live");
  const [fxRateInput, setFxRateInput] = useState("");
  const [liveFx, setLiveFx] = useState<FxInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingFx, setRefreshingFx] = useState(false);

  const [fxCheckedAt, setFxCheckedAt] = useState<string | null>(null);

  /** Pushes the freshly checked rate into the price list cache so the storefront
   *  and the admin price previews use it immediately, not up to 15 min later. */
  const cacheRateLocally = (rate: number) => {
    try {
      localStorage.setItem(
        "usd_inr_rate_v1",
        JSON.stringify({ rate, day: new Date().toISOString().slice(0, 10), at: Date.now() }),
      );
    } catch {
      /* private mode: the rate is still saved server-side */
    }
  };

  const refreshFx = async () => {
    setRefreshingFx(true);
    try {
      const res = await callDomainMarket<{ fx?: FxInfo }>("admin_refresh_fx");
      const rate = Number(res.fx?.rate);
      if (res.fx && Number.isFinite(rate) && rate > 0) {
        setLiveFx(res.fx);
        setFxCheckedAt(formatFxCheckStamp(new Date()));
        cacheRateLocally(rate);
        // Not using an own rate? Then the freshly checked market rate is the one
        // in use, so keep the field in step with it too.
        if (fxMode !== "manual") setFxRateInput(String(Math.round(rate * 100) / 100));
        if (String(res.fx.source || "").startsWith("stale:")) {
          toast.warning(`Live feeds unreachable. Still using 1 USD = ${rate.toFixed(2)} INR.`);
        } else {
          toast.success(`Google rate checked and saved: 1 USD = ${rate.toFixed(2)} INR`);
        }
      } else {
        toast.error("Could not read today's dollar rate.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not refresh today's dollar rate.");
    } finally {
      setRefreshingFx(false);
    }
  };


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callDomainMarket<{ settings: Settings | null; fx?: FxInfo }>("admin_settings");
      const s = res.settings;
      if (res.fx) setLiveFx(res.fx);
      if (s) {
        setSales(!!s.sales_enabled);
        const rawDomain = Number(s.default_markup_fixed);
        const rawRenewal = Number(s.renewal_markup_fixed);
        setDomainCharge(nearestOption(Number.isFinite(rawDomain) ? rawDomain : 100));
        setRenewalCharge(nearestOption(Number.isFinite(rawRenewal) ? rawRenewal : 100));
        setCurrency(s.currency || "INR");
        setAffiliateUrl(String(s.affiliate_url ?? ""));
        setProtectionPrice(String(Math.max(0, Number(s.protection_price_per_year ?? 0) || 0)));
        setFxMode(s.fx_mode === "manual" ? "manual" : s.fx_mode === "ai" ? "ai" : "live");
        setFxRateInput(
          Number(s.fx_manual_rate) > 0
            ? String(Number(s.fx_manual_rate))
            : res.fx?.rate
              ? String(Math.round(Number(res.fx.rate) * 100) / 100)
              : "",
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not load domain charges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);


  const manualFx = fxMode === "manual";
  const enteredFx = Number(fxRateInput);
  const fxValid = Number.isFinite(enteredFx) && enteredFx > 0;
  const fxBelowMarket = manualFx && fxValid && !!liveFx?.rate && enteredFx < Number(liveFx.rate);

  const save = async () => {
    if (manualFx && !fxValid) {
      toast.error("Enter a valid dollar rate, e.g. 90.");
      return;
    }
    setSaving(true);
    try {
      await callDomainMarket("admin_save_settings", {
        settings: {
          sales_enabled: sales,
          // Sales off = zero charges are persisted.
          default_markup_fixed: sales ? domainCharge : 0,
          renewal_markup_fixed: sales ? renewalCharge : 0,
          protection_price_per_year: Math.max(0, Number(protectionPrice) || 0),
          affiliate_url: affiliateUrl.trim() || null,
          // Dollar conversion: owner's own rate, or the live market rate.
          fx_mode: fxMode,
          fx_manual_rate: manualFx && fxValid ? enteredFx : null,
          // Flat-charge pricing: nothing else may inflate the GoDaddy price.
          default_markup_percent: 0,
          renewal_markup_percent: 0,
          min_profit: 0,
          renewal_min_profit: 0,
          tax_percent: 0,
          payment_fee_percent: 0,
          renewal_fx_buffer_percent: 0,
          promo_allow_below_cost: false,
          promo_max_loss: 0,
          // The old percent/flat storefront discount is replaced by the
          // per-extension term offers below.
          offer_enabled: false,
          offer_discount_value: 0,
        },
      });


      toast.success("Domain charges saved.");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save charges.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Domain Charges | Owner Portal</title>
      </Helmet>
      <main className="mx-auto w-full max-w-2xl space-y-6 px-3 py-6 sm:px-6">
        <header>
          <h1 className="text-xl font-bold sm:text-2xl">Domain Charges</h1>
          <p className="text-sm text-muted-foreground">
            Customer price = live GoDaddy price + your charge. Nothing else is added.
          </p>
        </header>

        {loading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Charges</CardTitle>
                <CardDescription>Pick the flat amount added on top of the GoDaddy price.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Enable domain sales</p>
                    <p className="text-xs text-muted-foreground">Turn the domain store on for visitors.</p>
                  </div>
                  <Switch
                    checked={sales}
                    onCheckedChange={(next) => {
                      setSales(next);
                      if (!next) {
                        // Store off = no charges at all.
                        setDomainCharge(0);
                        setRenewalCharge(0);
                      }
                    }}
                  />
                </div>

                {!sales && (
                  <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
                    <Label htmlFor="affiliate-url">GoDaddy CJ Affiliate link</Label>
                    <Input
                      id="affiliate-url"
                      value={affiliateUrl}
                      onChange={(e) => setAffiliateUrl(e.target.value)}
                      placeholder="https://www.anrdoezrs.net/click-XXXXXXX-YYYYYYY?url="
                    />
                    <p className="text-xs text-muted-foreground">
                      Sales off hone par cart icon par click karte hi visitor is affiliate link se GoDaddy par
                      chala jaata hai, aur aapko CJ commission milti hai. Link me <code>{"{domain}"}</code> likhne
                      par wahan domain naam apne-aap lag jaata hai.
                    </p>
                  </div>
                )}



                <div className="space-y-1">
                  <Label>Domain Charge</Label>
                  <Select value={String(domainCharge)} onValueChange={(v) => setDomainCharge(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHARGE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={String(o)}>
                          {formatMoney(o, currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Example: GoDaddy {formatMoney(1000, currency)} + {formatMoney(domainCharge, currency)} ={" "}
                    <b>{formatMoney(1000 + domainCharge, currency)}</b>
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Renewal Charge</Label>
                  <Select value={String(renewalCharge)} onValueChange={(v) => setRenewalCharge(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHARGE_OPTIONS.map((o) => (
                        <SelectItem key={o} value={String(o)}>
                          {formatMoney(o, currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Example: GoDaddy renewal {formatMoney(4000, currency)} + {formatMoney(renewalCharge, currency)} ={" "}
                    <b>{formatMoney(4000 + renewalCharge, currency)}</b>
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="protection-price">Full Domain Protection price (per year)</Label>
                  <Input
                    id="protection-price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="1"
                    value={protectionPrice}
                    onChange={(e) => setProtectionPrice(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used only when GoDaddy does not return a protection price for a domain. Then this amount is charged
                    per year and shown on checkout. Set <b>0</b> to hide protection when GoDaddy has no price.
                  </p>
                </div>


              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dollar rate (USD → {currency})</CardTitle>
                <CardDescription>
                  If GoDaddy quotes a price in dollars, this rate converts it before your charge is added.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Use my own dollar rate</p>
                    <p className="text-xs text-muted-foreground">
                      Off = live market rate is fetched automatically every day.
                    </p>
                  </div>
                  <Switch
                    checked={fxMode === "manual"}
                    onCheckedChange={(on) => setFxMode(on ? "manual" : "live")}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">AI daily rate check</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground"
                        onClick={refreshFx}
                        disabled={refreshingFx}
                        aria-label="Check today's dollar rate again"
                        title="Check today's dollar rate again"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshingFx ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AI checks today's real USD → {currency} rate every day and saves it automatically, so prices stay
                      correct without any manual work.
                    </p>
                  </div>
                  <Switch
                    checked={fxMode === "ai"}
                    onCheckedChange={(on) => setFxMode(on ? "ai" : "live")}
                  />
                </div>


                {manualFx ? (
                  <div className="space-y-1">
                    <Label htmlFor="fx-rate">1 USD = ? {currency}</Label>
                    <Input
                      id="fx-rate"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="0.01"
                      value={fxRateInput}
                      onChange={(e) => setFxRateInput(e.target.value)}
                      placeholder="90"
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: GoDaddy $10 × {fxValid ? enteredFx : "—"} ={" "}
                      <b>{fxValid ? formatMoney(Math.round(10 * enteredFx), currency) : "—"}</b>, plus your{" "}
                      {formatMoney(domainCharge, currency)} charge ={" "}
                      <b>{fxValid ? formatMoney(Math.round(10 * enteredFx) + domainCharge, currency) : "—"}</b>
                    </p>
                    {fxBelowMarket && (
                      <p className="text-xs font-medium text-destructive">
                        Warning: this is below today's market rate ({Number(liveFx?.rate).toFixed(2)}). Dollar-priced
                        domains would be sold cheaper than they cost you.
                      </p>
                    )}
                  </div>
                ) : null}

                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {fxMode === "manual" && fxValid ? (
                    <>
                      Your dollar rate in use: <b>1 USD = {Number(enteredFx).toFixed(2)} INR</b>
                    </>
                  ) : (
                    <>
                      Google rate checked by AI: <b>1 USD = {liveFx?.rate ? Number(liveFx.rate).toFixed(2) : "—"} INR</b>
                      {fxCheckedAt ? <> · checked at {fxCheckedAt}</> : null}

                    </>
                  )}
                </p>
              </CardContent>
            </Card>



            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </>
        )}
      </main>
    </>
  );
};

export default DomainPricingSettings;
