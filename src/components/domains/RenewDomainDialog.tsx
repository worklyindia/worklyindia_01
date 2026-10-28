import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Globe, RefreshCw, ShieldCheck, X } from "lucide-react";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";

declare const window: Window & { Razorpay?: any };


const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

interface RenewalOption {
  years: number;
  price_per_year: number;
  total: number;
  new_expiry: string;
}

interface QuoteRes {
  domain: string;
  currency: string;
  price_per_year: number;
  expires: string | null;
  status?: string;
  renew_auto?: boolean;
  renewable?: boolean;
  sales_enabled: boolean;
  options: RenewalOption[];
}

interface Props {
  domain: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenewed?: (domain: string, newExpiry: string | null) => void;
}

/**
 * Full-screen, mobile-first renewal flow: live GoDaddy renewal pricing,
 * 1/2/3/5/10 year terms with a running total, the exact new expiry date, and
 * a Razorpay payment button.
 */
const RenewDomainDialog = ({ domain, open, onOpenChange, onRenewed }: Props) => {
  const [quote, setQuote] = useState<QuoteRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState(1);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [done, setDone] = useState<{ expires_after: string | null; total: number; period: number } | null>(null);

  const load = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    setDone(null);
    try {
      const res = await callDomainMarket<QuoteRes>("renewal_quote", { domain });
      setQuote(res);
      setYears(res.options?.[0]?.years ?? 1);
    } catch (e: any) {
      setError(e?.message || "Could not load renewal pricing.");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (open && domain) load();
    if (!open) {
      setQuote(null);
      setDone(null);
      setError(null);
    }
  }, [open, domain, load]);

  const selected = quote?.options?.find((o) => o.years === years) ?? null;

  const pay = async () => {
    if (!quote || !selected || !domain) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load the payment window. Check your connection and retry.");

      const order = await callDomainMarket<{
        renewal_order_id: string;
        razorpay_order_id: string;
        amount: number;
        currency: string;
        key_id: string;
        total: number;
      }>("create_renewal_payment", { domain, period: years });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Workly India",
        description: `Domain renewal: ${domain} (${years} year${years > 1 ? "s" : ""})`,
        order_id: order.razorpay_order_id,
        modal: {
          backdropclose: false,
          escape: true,
          ondismiss: () => {
            setBusy(false);
            setPayOpen(false);
            toast.info("Payment was not completed. You can retry any time.");
          },
        },
        handler: async (response: any) => {
          setPayOpen(false);
          try {
            const res = await callDomainMarket<any>("confirm_renewal_payment", {
              renewal_order_id: order.renewal_order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setDone({ expires_after: res?.expires_after ?? null, total: order.total, period: years });
            toast.success(`${domain} renewed for ${years} year${years > 1 ? "s" : ""}.`);
            onRenewed?.(domain, res?.expires_after ?? null);
          } catch (e: any) {
            setError(e?.message || "Payment could not be verified. Our team will check it.");
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.on?.("payment.failed", () => {
        setBusy(false);
        setPayOpen(false);
      });
      setPayOpen(true);
      setTimeout(() => rzp.open(), 50);
    } catch (e: any) {
      setError(e?.message || "Could not start the payment.");
      setBusy(false);
      setPayOpen(false);
    }
  };

  return (
    <Dialog open={open && !payOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg sm:border"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">Renew domain</h2>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> {domain}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-base font-semibold">Renewal complete</p>
              <p className="text-sm text-muted-foreground">
                {domain} is renewed for {done.period} year{done.period > 1 ? "s" : ""}.
              </p>
              <div className="w-full rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-medium">{formatMoney(done.total, quote?.currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">New expiry date</span>
                  <span className="font-medium">{formatDate(done.expires_after)}</span>
                </div>
              </div>
              <Button className="h-11 w-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : error && !quote ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : quote ? (
            <>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Current expiry</span>
                  <span className="font-medium">{formatDate(quote.expires)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Renewal price</span>
                  <span className="font-medium">{formatMoney(quote.price_per_year, quote.currency)} / year</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    {quote.status || "ACTIVE"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Choose renewal term</p>
                {quote.options.map((o) => {
                  const active = o.years === years;
                  return (
                    <button
                      key={o.years}
                      type="button"
                      onClick={() => setYears(o.years)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {o.years} Year{o.years > 1 ? "s" : ""}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarClock className="h-3 w-3" /> New expiry {formatDate(o.new_expiry)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatMoney(o.total, quote.currency)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatMoney(o.price_per_year, quote.currency)}/yr
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">
                      {selected.years} × {formatMoney(selected.price_per_year, quote.currency)}
                    </span>
                    <span>{formatMoney(selected.total, quote.currency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <span>Total payable</span>
                    <span>{formatMoney(selected.total, quote.currency)}</span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> After payment {domain} will expire on{" "}
                    {formatDate(selected.new_expiry)}.
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          ) : null}
        </div>

        {!done && quote && (
          <footer className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button className="h-12 w-full text-base" disabled={busy || !selected || !quote.sales_enabled} onClick={pay}>
              {busy
                ? "Starting payment…"
                : selected
                  ? `Pay ${formatMoney(selected.total, quote.currency)}`
                  : "Select a term"}
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RenewDomainDialog;
