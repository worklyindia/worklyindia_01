import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, Loader2, Lock, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Quote {
  order_id: string;
  domain: string;
  period: number;
  privacy: boolean;
  privacy_requested?: boolean;
  privacy_available?: boolean;
  privacy_free?: boolean;
  price_locked: boolean;
  quote_expires_at: string | null;
  price: number;
  registration_price?: number;
  renewal_price: number | null;
  renewal_total?: number | null;
  currency: string;
  protection_fee?: number;
  protection_price?: number;
  protection_fee_source?: "registrar" | "owner" | "free" | "none";
}


interface Agreement {
  agreementKey: string;
  title?: string;
  content?: string;
  url?: string;
}

interface DomainConfig {
  period: string;
  privacy: boolean;
}


type Step = "configure" | "contact" | "status";

const TERM_OPTIONS = ["1", "2", "3", "5", "10"];
const FINAL_STATUSES = ["registered", "failed", "refunded", "cancelled"];

const emptyContact = {
  nameFirst: "",
  nameLast: "",
  organization: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
};

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

/** "August 2027" — the month/year the selected registration term ends. */
const renewsLabel = (periodYears: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + periodYears);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

interface Props {
  domains: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
}

/**
 * GoDaddy-style checkout: per-domain term selector + protection toggle,
 * live locked quotes, one contact form and a single combined Razorpay
 * payment for the whole cart.
 */
const DomainCheckoutDialog = ({ domains, open, onOpenChange, onRegistered }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("configure");
  const [configs, setConfigs] = useState<Record<string, DomainConfig>>({});
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [contact, setContact] = useState(emptyContact);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [agreements, setAgreements] = useState<Record<string, Agreement[]>>({});
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementsAccepted, setAgreementsAccepted] = useState(false);
  const [openAgreement, setOpenAgreement] = useState<string | null>(null);
  // Owner-portal fallback price per year, used whenever the registrar does not
  // publish a protection price so the UI never shows "Not available".
  const [ownerProtectionPerYear, setOwnerProtectionPerYear] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("domain_pricing_settings")
        .select("protection_price_per_year")
        .maybeSingle();
      if (active) setOwnerProtectionPerYear(Math.max(0, Number(data?.protection_price_per_year ?? 0) || 0));
    })();
    return () => {
      active = false;
    };
  }, []);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      const fullName = String(user?.user_metadata?.full_name ?? "").trim();
      setStep("configure");
      setQuotes({});
      setStatuses({});
      setError(null);
      setPayOpen(false);
      setAgreements({});
      setAgreementsAccepted(false);
      setOpenAgreement(null);
      setConfigs(
        Object.fromEntries(domains.map((d) => [d, { period: "1", privacy: false }])),
      );
      setContact({
        ...emptyContact,
        email: user?.email ?? "",
        nameFirst: fullName.split(" ")[0] ?? "",
        nameLast: fullName.split(" ").slice(1).join(" "),
      });
    }
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domains]);


  // Auto-fill registrant details from the saved employer / user profile so the
  // user never has to type them again.
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: company }, { data: profile }] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "company_name, hr_contact_name, founder_name, email, support_email, phone, precise_address, registered_address, city, state, postal_code, country",
            )
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, email, phone, precise_address, city, state, postal_code, country")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const authName = String(user?.user_metadata?.full_name ?? "").trim();
        const name = String(
          (company as any)?.hr_contact_name ||
            (company as any)?.founder_name ||
            (profile as any)?.full_name ||
            authName ||
            "",
        ).trim();
        const pick = (...vals: any[]) =>
          vals.map((v) => (v == null ? "" : String(v).trim())).find((v) => v.length > 0) ?? "";
        const country = pick((company as any)?.country, (profile as any)?.country, "IN");

        setContact((c) => ({
          ...c,
          nameFirst: name.split(" ")[0] || c.nameFirst,
          nameLast: name.split(" ").slice(1).join(" ") || c.nameLast,
          organization: pick((company as any)?.company_name, c.organization),
          email: pick((company as any)?.email, (profile as any)?.email, user.email, (company as any)?.support_email, c.email),
          phone: pick((company as any)?.phone, (profile as any)?.phone, c.phone),
          address1: pick(
            (company as any)?.precise_address,
            (company as any)?.registered_address,
            (profile as any)?.precise_address,
            c.address1,
          ),
          city: pick((company as any)?.city, (profile as any)?.city, c.city),
          state: pick((company as any)?.state, (profile as any)?.state, c.state),
          postalCode: pick((company as any)?.postal_code, (profile as any)?.postal_code, c.postalCode),
          country: (country.length === 2 ? country : "IN").toUpperCase(),
        }));
      } catch {
        /* best effort prefill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);


  const setField = (key: keyof typeof emptyContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact((c) => ({ ...c, [key]: e.target.value }));

  const setConfig = (domain: string, patch: Partial<DomainConfig>) =>
    setConfigs((c) => ({ ...c, [domain]: { ...c[domain], ...patch } }));

  const getQuotes = async (silent = false) => {
    if (!user || !domains.length) return;
    if (!silent) setBusy(true);
    setQuoting(true);
    setError(null);
    try {
      const next: Record<string, Quote> = {};
      const failures: string[] = [];
      for (const domain of domains) {
        const cfg = configs[domain] ?? { period: "1", privacy: false };
        try {
          next[domain] = await callDomainMarket<Quote>("create_quote", {
            domain,
            period: Number(cfg.period),
            privacy: cfg.privacy,
          });
        } catch (e: any) {
          failures.push(`${domain}: ${e?.message || "quote failed"}`);
        }
      }
      if (!Object.keys(next).length) {
        setError(failures[0] || "Could not get a live price quote.");
        return;
      }
      setQuotes(next);
      if (failures.length && !silent) toast.warning(`Some domains could not be quoted — ${failures.join("; ")}`);
    } finally {
      setBusy(false);
      setQuoting(false);
    }
  };

  // GoDaddy-style: prices are shown up front and re-quoted live whenever the
  // term or protection toggle changes.
  useEffect(() => {
    if (!open || !user || step !== "configure") return;
    if (!domains.every((d) => configs[d])) return;
    // Lock the Continue button from the instant the term changes, so it can
    // never be clicked against a stale price while the re-quote is pending.
    setQuoting(true);
    const t = window.setTimeout(() => {
      void getQuotes(true);
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, step, JSON.stringify(configs)]);

  const quoteList = domains.map((d) => quotes[d]).filter(Boolean) as Quote[];
  const total = quoteList.reduce((s, q) => s + q.price, 0);
  const currency = quoteList[0]?.currency || "INR";

  // Only switch the toggle off when protection cannot be priced at all — i.e.
  // the registrar can't sell it AND there is no owner-set fallback price.
  // Otherwise the toggle would flip itself off right after the user turns it on.
  useEffect(() => {
    const off = Object.values(quotes).filter(
      (q) =>
        q &&
        q.privacy_available === false &&
        q.privacy_free !== true &&
        Number(q.protection_price ?? 0) <= 0 &&
        ownerProtectionPerYear <= 0 &&
        configs[q.domain]?.privacy,
    );
    if (!off.length) return;
    setConfigs((c) => {
      const next = { ...c };
      for (const q of off) next[q.domain] = { ...next[q.domain], privacy: false };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, ownerProtectionPerYear]);



  // Registry / registrar agreements must be shown and explicitly accepted
  // before payment (ICANN requirement).
  useEffect(() => {
    if (!open || !user || step !== "contact") return;
    let cancelled = false;
    (async () => {
      setAgreementsLoading(true);
      try {
        const next: Record<string, Agreement[]> = {};
        for (const domain of domains) {
          if (!quotes[domain]) continue;
          try {
            const res = await callDomainMarket<{ agreements: any }>("agreements", {
              domain,
              privacy: configs[domain]?.privacy === true,
            });
            const raw = Array.isArray(res.agreements) ? res.agreements : res.agreements?.agreements ?? [];
            next[domain] = (Array.isArray(raw) ? raw : []).filter((a: any) => a?.agreementKey);
          } catch {
            next[domain] = [];
          }
        }
        if (!cancelled) setAgreements(next);
      } finally {
        if (!cancelled) setAgreementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, step]);

  const agreementList = domains.flatMap((d) => agreements[d] ?? []);
  const uniqueAgreements = agreementList.filter(
    (a, i) => agreementList.findIndex((x) => x.agreementKey === a.agreementKey) === i,
  );


  const startPolling = (orderIds: string[]) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = window.setInterval(async () => {
      tries += 1;
      for (const orderId of orderIds) {
        try {
          const res = await callDomainMarket<{ order: { status: string; domain: string } }>(
            "order_status",
            { order_id: orderId },
          );
          setStatuses((s) => ({ ...s, [res.order.domain]: res.order.status }));
        } catch {
          /* keep polling */
        }
      }
      if (tries > 24 && pollRef.current) window.clearInterval(pollRef.current);
    }, 5000);
  };

  const startPayment = async () => {
    if (!quoteList.length) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load the payment window. Check your connection and retry.");

      const orderIds = quoteList.map((q) => q.order_id);
      const pay =
        orderIds.length === 1
          ? await callDomainMarket<{ razorpay_order_id: string; amount: number; currency: string; key_id: string }>(
              "create_payment",
              { order_id: orderIds[0] },
            )
          : await callDomainMarket<{ razorpay_order_id: string; amount: number; currency: string; key_id: string }>(
              "create_cart_payment",
              { order_ids: orderIds },
            );

      const rzp = new window.Razorpay({
        key: pay.key_id,
        amount: pay.amount,
        currency: pay.currency,
        name: "Workly India",
        description: `Domain registration: ${quoteList.map((q) => q.domain).join(", ")}`.slice(0, 250),
        order_id: pay.razorpay_order_id,
        prefill: {
          name: `${contact.nameFirst} ${contact.nameLast}`.trim(),
          email: contact.email,
          contact: contact.phone,
        },
        modal: {
          backdropclose: false,
          escape: true,
          ondismiss: () => {
            setBusy(false);
            setPayOpen(false);
            toast.info("Payment was not completed. Your quote is saved — you can retry from My orders.");
          },
        },
        handler: async (response: any) => {
          setPayOpen(false);
          try {
            const res = await callDomainMarket<any>("confirm_payment", {
              order_ids: orderIds,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const next: Record<string, string> = {};
            if (Array.isArray(res?.orders)) {
              for (const o of res.orders) if (o?.domain) next[o.domain] = o.status;
            } else if (res?.domain) {
              next[res.domain] = res.status;
            }
            setStatuses(next);
            setStep("status");
            startPolling(orderIds);
            onRegistered?.();
          } catch (e: any) {
            setStatuses(Object.fromEntries(quoteList.map((q) => [q.domain, "failed"])));
            setError(e?.message || "Payment could not be verified.");
            setStep("status");
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.on?.("payment.failed", () => {
        setBusy(false);
        setPayOpen(false);
      });
      // Hide our dialog first so the Razorpay window is fully interactive
      // (no focus trap / scroll lock fighting the checkout iframe).
      setPayOpen(true);
      setTimeout(() => rzp.open(), 50);
    } catch (e: any) {
      setError(e?.message || "Could not start the payment.");
      setBusy(false);
      setPayOpen(false);
    }

  };

  const saveContactAndPay = async () => {
    if (!quoteList.length) return;
    if (!agreementsAccepted) {
      setError("Please read and accept the domain registration agreements to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const q of quoteList) {
        const keys = (agreements[q.domain] ?? []).map((a) => a.agreementKey).filter(Boolean);
        await callDomainMarket("save_contact", {
          order_id: q.order_id,
          contact: {
            ...contact,
            agreementKeys: keys.length ? keys : ["DNRA"],
            agreedAt: new Date().toISOString(),
          },
        });
      }
      await startPayment();
    } catch (e: any) {
      setError(e?.message || "Please review the contact details.");
      setBusy(false);
    }
  };


  const allDone = quoteList.length > 0 && quoteList.every((q) => FINAL_STATUSES.includes(statuses[q.domain] ?? ""));
  const anyFailed = quoteList.some((q) => ["failed", "refunded", "cancelled"].includes(statuses[q.domain] ?? ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={!payOpen}>
      <DialogContent
        hideClose
        className={`h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 left-0 top-0 overflow-y-auto overscroll-contain rounded-none border-0 p-4 pb-6 gap-3 sm:max-w-none sm:rounded-none ${
          payOpen ? "invisible pointer-events-none" : ""
        }`}
      >

        <DialogHeader className="space-y-0 text-left">
          <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="break-all text-left text-base font-bold leading-tight sm:text-xl">
                  {domains.length > 1 ? `Register ${domains.length} domains` : `Register ${domains[0] ?? ""}`}
                </DialogTitle>
                <DialogDescription className="mt-1 text-left text-xs leading-snug sm:text-sm">
                  Live price from the registrar, locked before payment. No estimated pricing.
                </DialogDescription>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                    <ShieldCheck className="h-3 w-3" /> Secure checkout
                  </Badge>
                  <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                    <Lock className="h-3 w-3" /> Price locked
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {!user ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Please sign in to your account to buy a domain.
          </p>
        ) : (
          <>
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            {step === "configure" && (
              <div className="space-y-3">
                <p className="rounded-md bg-muted px-3 py-2 text-[11px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground">
                  The more domain names you own, the more protected your brand is
                </p>

                {domains.map((domain) => {
                  const cfg = configs[domain] ?? { period: "1", privacy: false };
                  const tld = domain.split(".").slice(1).join(".").toUpperCase();
                  const q = quotes[domain];
                  const cur = q?.currency || "INR";
                  const years = Math.max(1, Number(cfg.period) || 1);
                  const protectionFee = Number(q?.protection_fee ?? 0);
                  // Registration price the registrar quoted for the SELECTED term.
                  const registrationPrice = q
                    ? Number(q.registration_price ?? Math.max(0, q.price - protectionFee))
                    : 0;
                  // Real per-year GoDaddy renewal price and the cost of renewing
                  // the same term again.
                  const renewalPerYear = Number(q?.renewal_price ?? 0);
                  const renewalTotal = Number(q?.renewal_total ?? renewalPerYear * years);
                  const privacyFree = q?.privacy_free === true;
                  // Protection price for the selected term: registrar price when
                  // GoDaddy publishes one, otherwise the owner-set price per year.
                  const ownerProtection = Math.round(ownerProtectionPerYear * years);
                  const registrarProtection = Number(q?.protection_price ?? protectionFee ?? 0);
                  const protectionPrice = registrarProtection > 0 ? registrarProtection : ownerProtection;
                  // Protection is offered whenever we can price it at all.
                  const privacyAvailable = privacyFree || protectionPrice > 0;
                  // Compare-at price for protection: mirror the registration
                  // discount when there is one, otherwise show 40% off.
                  const domainOffPct =
                    renewalTotal > registrationPrice && registrationPrice > 0
                      ? Math.round(((renewalTotal - registrationPrice) / renewalTotal) * 100)
                      : 0;
                  const protectionOffPct = domainOffPct > 0 && domainOffPct < 100 ? domainOffPct : 40;
                  const protectionRegular =
                    protectionPrice > 0
                      ? Math.round(protectionPrice / (1 - protectionOffPct / 100))
                      : 0;

                  return (
                    <div key={domain} className="space-y-3 rounded-xl border border-border p-3 sm:p-4">
                      <div>
                        <p className="break-all text-base font-bold leading-tight sm:text-lg">{domain}</p>
                        <p className="text-xs text-muted-foreground">.{tld} Domain Registration</p>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <Select value={cfg.period} onValueChange={(v) => setConfig(domain, { period: v })}>
                          <SelectTrigger className="h-11 w-32 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TERM_OPTIONS.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y} Year{y === "1" ? "" : "s"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="min-w-0 text-right">
                          {q ? (
                            <>
                              <p className="text-lg font-bold leading-tight text-primary sm:text-xl">
                                {formatMoney(registrationPrice, cur)}
                              </p>
                              {renewalTotal > registrationPrice && registrationPrice > 0 ? (
                                <>
                                  <p className="text-xs text-muted-foreground line-through">
                                    {formatMoney(renewalTotal, cur)}
                                  </p>
                                  <p className="text-xs font-semibold text-emerald-600">
                                    {Math.round(((renewalTotal - registrationPrice) / renewalTotal) * 100)}% off
                                  </p>
                                  <p className="text-xs font-semibold text-emerald-600">
                                    🎉 You save {formatMoney(renewalTotal - registrationPrice, cur)}
                                  </p>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <Loader2 className="ml-auto h-5 w-5 animate-spin text-muted-foreground" />
                          )}
                        </div>

                      </div>

                      <p className="text-xs text-muted-foreground">
                        {q && renewalPerYear > 0
                          ? `Renews in ${renewsLabel(years)} at ${formatMoney(renewalTotal, cur)} for ${years} year${
                              years === 1 ? "" : "s"
                            }`
                          : q
                            ? "The registrar has not published a renewal price for this domain yet."
                            : "Loading live registrar price…"}
                      </p>

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Switch
                            className="mt-0.5 shrink-0"
                            checked={cfg.privacy && privacyAvailable}
                            disabled={!privacyAvailable}
                            onCheckedChange={(v) => setConfig(domain, { privacy: v })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex min-w-0 items-center gap-1 text-xs font-semibold leading-none whitespace-nowrap sm:text-sm">
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                                  Full Domain Protection
                                </p>
                                <Badge className="mt-1 h-auto bg-emerald-600 px-1.5 py-0 text-[10px] hover:bg-emerald-600">
                                  Recommended
                                </Badge>
                              </div>
                              {!q ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : privacyFree ? (
                                <span className="text-xs font-bold text-emerald-600">Free</span>
                              ) : (
                                <span className="shrink-0 text-right text-xs leading-tight">
                                  <span className="block font-bold text-primary">
                                    {formatMoney(protectionPrice, cur)}
                                  </span>
                                  {protectionRegular > protectionPrice ? (
                                    <>
                                      <span className="block text-[10px] text-muted-foreground line-through">
                                        {formatMoney(protectionRegular, cur)}
                                      </span>
                                      <span className="block text-[10px] font-semibold text-emerald-600">
                                        {protectionOffPct}% off
                                      </span>
                                      <span className="block text-[10px] font-semibold text-emerald-600">
                                        🎉 You save {formatMoney(protectionRegular - protectionPrice, cur)}
                                      </span>
                                    </>
                                  ) : null}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Benefits start hard-left, no indent gap. */}
                        <ul className="ml-0 list-none space-y-1 pl-0 text-left text-xs text-muted-foreground">
                          <li>Stops anyone from transferring your domain or changing it without your approval.</li>
                          <li>Keeps your name, address, email and phone number out of the public WHOIS record.</li>
                        </ul>

                        {!privacyAvailable && (
                          <p className="text-xs text-muted-foreground">
                            The registrar does not offer protection for .{tld.toLowerCase()} domains, so this
                            domain will be registered without it. Everything else is unaffected.
                          </p>
                        )}
                        {privacyAvailable && privacyFree && cfg.privacy && (
                          <p className="text-xs text-emerald-600">Included free with this domain — no extra charge.</p>
                        )}
                        {privacyAvailable && protectionPrice > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Protection price for {years} year{years === 1 ? "" : "s"} —{" "}
                            {formatMoney(protectionPrice, cur)}
                          </p>
                        )}
                      </div>


                    </div>
                  );
                })}


                <p className="text-[11px] text-muted-foreground">
                  Live registrar prices, locked before payment.
                </p>

                <div className="mt-6 border-t bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">
                      {quoteList.length ? formatMoney(total, currency) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1 text-sm"
                      onClick={() => onOpenChange(false)}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                    <Button
                      className="h-10 flex-1 text-sm"
                      onClick={() => setStep("contact")}
                      disabled={quoting || !quoteList.length}
                      aria-busy={false}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === "contact" && quoteList.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Required by ICANN for domain registration.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="dc-first">First name</Label>
                    <Input id="dc-first" className="h-11" value={contact.nameFirst} onChange={setField("nameFirst")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dc-last">Last name</Label>
                    <Input id="dc-last" className="h-11" value={contact.nameLast} onChange={setField("nameLast")} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dc-org">Organization (optional)</Label>
                  <Input id="dc-org" className="h-11" value={contact.organization} onChange={setField("organization")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dc-email">Email</Label>
                  <Input id="dc-email" type="email" className="h-11" value={contact.email} onChange={setField("email")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dc-phone">Phone (with country code, e.g. +91…)</Label>
                  <Input id="dc-phone" className="h-11" value={contact.phone} onChange={setField("phone")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dc-addr1">Address</Label>
                  <Input id="dc-addr1" className="h-11" value={contact.address1} onChange={setField("address1")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dc-addr2">Address line 2 (optional)</Label>
                  <Input id="dc-addr2" className="h-11" value={contact.address2} onChange={setField("address2")} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="dc-city">City</Label>
                    <Input id="dc-city" className="h-11" value={contact.city} onChange={setField("city")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dc-state">State</Label>
                    <Input id="dc-state" className="h-11" value={contact.state} onChange={setField("state")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="dc-pin">Postal code</Label>
                    <Input id="dc-pin" className="h-11" value={contact.postalCode} onChange={setField("postalCode")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dc-country">Country</Label>
                    <Input id="dc-country" className="h-11" maxLength={2} value={contact.country} onChange={setField("country")} />
                  </div>
                </div>
                <Separator />

                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm font-semibold">Domain registration agreements</p>
                  {agreementsLoading ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the registrar agreements…
                    </p>
                  ) : uniqueAgreements.length ? (
                    <ul className="space-y-2">
                      {uniqueAgreements.map((a) => (
                        <li key={a.agreementKey} className="rounded-md bg-muted/50 p-2">
                          <button
                            type="button"
                            className="w-full text-left text-xs font-medium underline underline-offset-2"
                            onClick={() => setOpenAgreement(openAgreement === a.agreementKey ? null : a.agreementKey)}
                          >
                            {a.title || a.agreementKey}
                          </button>
                          {openAgreement === a.agreementKey && (
                            <div
                              className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-background p-2 text-[11px] leading-relaxed text-muted-foreground [&_a]:underline"
                              dangerouslySetInnerHTML={{
                                __html: a.content || `<a href="${a.url ?? "#"}" target="_blank" rel="noreferrer">Read the full agreement</a>`,
                              }}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The standard Domain Name Registration Agreement (DNRA) applies to this purchase.
                    </p>
                  )}

                  <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs">
                    <Checkbox
                      className="mt-0.5"
                      checked={agreementsAccepted}
                      onCheckedChange={(v) => setAgreementsAccepted(v === true)}
                    />
                    <span>
                      I have read and agree to the domain registration agreement{uniqueAgreements.length > 1 ? "s" : ""}{" "}
                      shown above.
                    </span>
                  </label>
                </div>

                <div className="mt-6 border-t bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">{formatMoney(total, currency)}</span>
                  </div>
                  <div className="flex w-full gap-2">
                    <Button variant="outline" className="h-12" onClick={() => setStep("configure")} disabled={busy}>
                      Back
                    </Button>
                    <Button
                      className="h-12 flex-1 text-base"
                      onClick={saveContactAndPay}
                      disabled={busy || agreementsLoading || !agreementsAccepted}
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Pay {formatMoney(total, currency)}
                    </Button>
                  </div>
                </div>

              </div>
            )}

            {step === "status" && (
              <div className="space-y-4 py-4">
                {quoteList.map((q) => {
                  const st = statuses[q.domain] ?? "registration_pending";
                  const ok = st === "registered";
                  const bad = ["failed", "refunded", "cancelled"].includes(st);
                  return (
                    <div key={q.order_id} className="flex items-center gap-3 rounded-md border border-border p-3">
                      {ok ? (
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                      ) : bad ? (
                        <XCircle className="h-6 w-6 shrink-0 text-destructive" />
                      ) : (
                        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{q.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {ok
                            ? "Registered — manage it under My domains."
                            : bad
                              ? "Could not be completed. Any payment is refunded automatically."
                              : "Payment received — registering…"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!allDone && !anyFailed && (
                  <p className="text-center text-xs text-muted-foreground">
                    This usually finishes within a few minutes. Track anytime under My orders.
                  </p>
                )}
                <Button variant="outline" className="h-11 w-full" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DomainCheckoutDialog;
