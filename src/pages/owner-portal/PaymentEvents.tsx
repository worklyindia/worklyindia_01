import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  ArrowLeft,
  CreditCard,
  ShoppingCart,
  FileText,
  Repeat,
  Banknote,
  QrCode,
  Landmark,
  Undo2,
  UserCog,
  Link2,
  Gift,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { downloadPaymentEventPdf, downloadPaymentEventsHistoryPdf, flattenPayload } from "@/lib/paymentEventsPdf";

/** Every Razorpay event Workly listens to, grouped exactly as Razorpay groups them. */
export const RAZORPAY_EVENT_CATEGORIES: Record<
  string,
  { label: string; icon: any; events: string[] }
> = {
  payment: {
    label: "Payment",
    icon: CreditCard,
    events: [
      "payment.authorized",
      "payment.failed",
      "payment.captured",
      "payment.dispute.created",
      "payment.dispute.won",
      "payment.dispute.lost",
      "payment.dispute.closed",
      "payment.dispute.under_review",
      "payment.dispute.action_required",
      "payment.downtime.started",
      "payment.downtime.updated",
      "payment.downtime.resolved",
    ],
  },
  order: {
    label: "Order",
    icon: ShoppingCart,
    events: ["order.paid", "order.notification.delivered", "order.notification.failed"],
  },
  invoice: {
    label: "Invoice",
    icon: FileText,
    events: ["invoice.paid", "invoice.partially_paid", "invoice.expired"],
  },
  subscription: {
    label: "Subscription",
    icon: Repeat,
    events: [
      "subscription.authenticated",
      "subscription.paused",
      "subscription.resumed",
      "subscription.activated",
      "subscription.pending",
      "subscription.halted",
      "subscription.charged",
    ],
  },
  settlement: { label: "Settlement", icon: Banknote, events: ["settlement.processed"] },
  qr_code: {
    label: "QR Code",
    icon: QrCode,
    events: ["qr_code.closed", "qr_code.created", "qr_code.credited"],
  },
  fund_account: {
    label: "Fund Account",
    icon: Landmark,
    events: ["fund_account.validation.completed", "fund_account.validation.failed"],
  },
  refund: {
    label: "Refund",
    icon: Undo2,
    events: ["refund.speed_changed", "refund.processed", "refund.failed", "refund.created"],
  },
  account: {
    label: "Account",
    icon: UserCog,
    events: ["account.instantly_activated", "account.activated_kyc_pending"],
  },
  payment_link: {
    label: "Payment Link",
    icon: Link2,
    events: [
      "payment_link.paid",
      "payment_link.partially_paid",
      "payment_link.expired",
      "payment_link.cancelled",
    ],
  },
  engage: {
    label: "Engage",
    icon: Gift,
    events: [
      "engage.rewards.disabled",
      "engage.rewards.enabled",
      "engage.rewards.denomination_disabled",
      "engage.rewards.denomination_enabled",
      "engage.rewards.denomination_updated",
      "engage.rewards.discount_updated",
      "engage.rewards.termsandconditions_updated",
      "engage.rewards.instructions_updated",
      "engage.inventory.low_stock",
      "engage.balance.low_balance",
    ],
  },
};

interface RazorpayEvent {
  id: string;
  event_id: string | null;
  event_type: string;
  category: string;
  account_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  amount_paise: number | null;
  currency: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  error_code: string | null;
  error_description: string | null;
  payload: any;
  signature_verified: boolean;
  event_created_at: string | null;
  created_at: string;
}

interface WalletBalance {
  balance_paise: number;
  captured_paise: number;
  refunded_paise: number;
  settled_paise: number;
  currency: string;
}

const hostedInvoiceUrl = (link: unknown): string | null => {
  if (typeof link !== "string") return null;
  try {
    const url = new URL(link);
    const trusted = url.hostname === "rzp.io" || url.hostname.endsWith(".rzp.io") || url.hostname === "razorpay.com" || url.hostname.endsWith(".razorpay.com");
    return url.protocol === "https:" && trusted && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};

const FAILURE_HINTS = ["failed", "expired", "cancelled", "halted", "lost", "low_"];

const isFailureEvent = (type: string) =>
  FAILURE_HINTS.some((hint) => type.includes(hint));

const formatAmount = (paise: number | null, currency: string | null) => {
  if (paise === null || paise === undefined) return "—";
  const value = paise / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ""}`.trim();
  }
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

// Refunds are only allowed within 30 days of the payment (enforced in the edge function too).
const REFUND_WINDOW_DAYS = 30;

const DATE_FILTERS = [["all", "All time"], ["today", "Today"], ["7", "7 Day"], ["30", "30 Day"], ["6m", "6 month"], ["1y", "1 Year"]] as const;
const compactNumber = (value: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const compactAmount = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(paise / 100);
const dateStart = (period: string) => {
  if (period === "all") return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "7" || period === "30") start.setDate(start.getDate() - Number(period) + 1);
  if (period === "6m") start.setMonth(start.getMonth() - 6);
  if (period === "1y") start.setFullYear(start.getFullYear() - 1);
  return start.toISOString();
};

const paymentCreatedAtMs = (e: RazorpayEvent): number | null => {
  const p = e.payload?.payload?.payment?.entity ?? e.payload?.payment?.entity;
  if (typeof p?.created_at === "number") return p.created_at * 1000;
  const iso = e.event_created_at || e.created_at;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};


const PaymentEvents = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<RazorpayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const [period, setPeriod] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const requestVersion = useRef(0);
  const [selectedRecord, setSelectedRecord] = useState<RazorpayEvent | null>(null);
  const selectedId = searchParams.get("event");
  const selected = selectedId ? events.find((e) => e.id === selectedId) ?? (selectedRecord?.id === selectedId ? selectedRecord : null) : null;
  const setSelected = (event: RazorpayEvent | null) => {
    setSelectedRecord(event);
    const next = new URLSearchParams(searchParams);
    if (event) next.set("event", event.id); else next.delete("event");
    next.delete("view");
    setSearchParams(next);
  };
  const [downloading, setDownloading] = useState(false);
  const [historyDownloading, setHistoryDownloading] = useState(false);
  const historyDownloadLock = useRef(false);
  const [resolvedInvoice, setResolvedInvoice] = useState<{ eventId: string; url: string } | null>(null);
  const invoiceReference = useMemo(() => {
    if (!selected) return null;
    const payload = selected.payload?.payload ?? selected.payload;
    const invoice = payload?.invoice?.entity;
    return {
      eventId: selected.id,
      paymentId: payload?.payment?.entity?.id ?? invoice?.payment_id ?? payload?.refund?.entity?.payment_id ?? (selected.entity_type === "payment" ? selected.entity_id : null),
      invoiceId: invoice?.id ?? payload?.payment?.entity?.invoice_id ?? (selected.entity_type === "invoice" ? selected.entity_id : null),
      directUrl: ["cancelled", "deleted", "expired", "draft"].includes(invoice?.status) ? null : hostedInvoiceUrl(invoice?.short_url),
    };
  }, [selected]);
  const invoiceUrl = resolvedInvoice?.eventId === selected?.id ? resolvedInvoice?.url : null;
  const [submittedRefunds, setSubmittedRefunds] = useState<Set<string>>(new Set());
  const refundOpen = searchParams.get("view") === "refund" && !!selected;
  const setRefundOpen = (open: boolean, replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set("view", "refund"); else next.delete("view");
    setSearchParams(next, { replace });
  };
  const [refunding, setRefunding] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundSpeed, setRefundSpeed] = useState<"normal" | "optimum">("normal");
  const [refundReason, setRefundReason] = useState("");

  const fetchWalletBalance = useCallback(async (silent = false) => {
    if (!silent) setBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-verify-payment", { body: { action: "owner-wallet-balance" } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Could not load wallet balance");
      setWalletBalance(data as WalletBalance);
    } catch (error) {
      console.error("Error loading Razorpay wallet balance", error);
      if (!silent) toast.error(error instanceof Error ? error.message : "Could not load wallet balance");
    } finally {
      if (!silent) setBalanceLoading(false);
    }
  }, []);

  useEffect(() => { void fetchWalletBalance(); }, [fetchWalletBalance]);




  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    supabase.from("razorpay_events").select("*").eq("id", selectedId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error("Could not load event details");
      if (data) setSelectedRecord(data as unknown as RazorpayEvent);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Resolve availability before showing the control; a payment reference is not an invoice.
  useEffect(() => {
    let cancelled = false;
    setResolvedInvoice(null);
    const reference = invoiceReference;
    if (!reference) return;
    if (reference.directUrl) {
      setResolvedInvoice({ eventId: reference.eventId, url: reference.directUrl });
      return;
    }
    if (!reference.invoiceId && !reference.paymentId) return;
    const resolveInvoice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("unified-verify-payment", {
          body: { action: "owner-invoice", payment_id: reference.paymentId, invoice_id: reference.invoiceId },
        });
        if (cancelled) return;
        if (error) {
          let message = data?.error;
          try { message = message || (await error.context?.json())?.error; } catch { /* Non-JSON response. */ }
          throw new Error(message || "Could not load the invoice. Please try again.");
        }
        if (data?.error) throw new Error(data.error);
        const url = hostedInvoiceUrl(data?.download_url ?? data?.invoice?.download_url);
        if (!cancelled && url) setResolvedInvoice({ eventId: reference.eventId, url });
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load invoice.");
      }
    };
    void resolveInvoice();
    return () => { cancelled = true; };
  }, [invoiceReference]);

  const openInvoice = () => {
    if (!invoiceUrl) return;
    // Lookup is complete, so the hosted URL opens directly inside the user click.
    const tab = window.open(invoiceUrl, "_blank");
    if (tab) tab.opener = null;
    else window.location.assign(invoiceUrl);
  };

  // How much of each payment has been refunded, from Razorpay refund events.
  // Per refund id we keep the highest amount so refund.created + refund.processed
  // for the same refund are not double counted.
  const refundedByPayment = useMemo(() => {
    const byRefund = new Map<string, { pid: string; amount: number }>();
    for (const e of events) {
      if (!e.event_type.startsWith("refund.")) continue;
      const r = e.payload?.payload?.refund?.entity ?? e.payload?.refund?.entity;
      if (!r?.id || !r?.payment_id) continue;
      if (e.event_type === "refund.failed") continue;
      const amt = e.amount_paise ?? (Number(r.amount) || 0);
      const prev = byRefund.get(r.id);
      if (!prev || amt > prev.amount) byRefund.set(r.id, { pid: r.payment_id, amount: amt });
    }
    const totals = new Map<string, number>();
    for (const { pid, amount } of byRefund.values()) {
      totals.set(pid, (totals.get(pid) || 0) + amount);
    }
    return totals;
  }, [events]);

  const canRefund = (e: RazorpayEvent) => {
    if (e.entity_id && submittedRefunds.has(e.entity_id)) return false;
    if (e.entity_type !== "payment" || e.status !== "captured" || !e.entity_id?.startsWith("pay_")) return false;
    // Hide once the payment is older than 30 days (Razorpay-friendly window).
    const createdMs = paymentCreatedAtMs(e);
    if (!createdMs || Date.now() - createdMs > REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000) return false;
    // Hide once the payment is fully refunded (partial refunds keep the button with the remaining amount).
    const total = e.amount_paise || 0;
    const payment = e.payload?.payload?.payment?.entity ?? e.payload?.payment?.entity;
    if (total <= 0 || Math.max(refundedByPayment.get(e.entity_id) || 0, Number(payment?.amount_refunded || 0)) >= total) return false;
    return true;
  };

  const remainingRefundInr = (e: RazorpayEvent) => {
    const total = e.amount_paise || 0;
    const payment = e.payload?.payload?.payment?.entity ?? e.payload?.payment?.entity;
    const refunded = Math.max(refundedByPayment.get(e.entity_id || "") || 0, Number(payment?.amount_refunded || 0));
    return Math.max(0, (total - refunded) / 100);
  };

  const submitRefund = async () => {
    if (!selected?.entity_id) return;
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-verify-payment", {
        body: {
          action: "owner-refund-payment",
          payment_id: selected.entity_id,
          amount_inr: Number(refundAmount),
          speed: refundSpeed,
          reason: refundReason,
        },
      });
      let message = data?.error;
      if (error && !message) {
        try { message = (await (error as any).context?.json())?.error; } catch { /* ignore */ }
        message = message || error.message;
      }
      if (message) throw new Error(message);
      if (!data?.success || !data?.refund?.id || data.refund.status === "failed") throw new Error("Refund was not accepted. Please try again.");
      setSubmittedRefunds((previous) => new Set(previous).add(selected.entity_id as string));
      toast.success(`Refund ${data.refund.id} created — ₹${data.refund.amount} (${data.refund.status})`);
      setRefundOpen(false, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const downloadHistory = async () => {
    if (historyDownloadLock.current) return;
    historyDownloadLock.current = true;
    setHistoryDownloading(true);
    const to = new Date().toISOString();
    const from = dateStart(period);
    const term = search.trim().toLowerCase();
    try {
      const allRows: RazorpayEvent[] = [];
      const seen = new Set<string>();
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("razorpay_events").select("*")
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .lte("created_at", to).range(offset, offset + 499);
        if (category !== "all") query = query.eq("category", category);
        if (eventType !== "all") query = query.eq("event_type", eventType);
        if (from) query = query.gte("created_at", from);
        const { data, error } = await query;
        if (error) throw error;
        const rows = (data ?? []) as unknown as RazorpayEvent[];
        for (const row of rows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          if (!term || [row.event_type, row.entity_id, row.email, row.contact, row.status, row.account_id].some((value) => value?.toLowerCase().includes(term))) allRows.push(row);
        }
        if (rows.length < 500) break;
      }
      if (allRows.length === 0) { toast.info("No events match the selected filters."); return; }
      await downloadPaymentEventsHistoryPdf(allRows, {
        period: DATE_FILTERS.find(([value]) => value === period)?.[1] ?? "All time",
        group: category === "all" ? "All" : RAZORPAY_EVENT_CATEGORIES[category]?.label ?? category,
        eventName: eventType === "all" ? "All event names" : eventType,
        search: search.trim(), from, to,
      });
      toast.success(`History PDF downloaded — ${allRows.length.toLocaleString("en-IN")} events`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download history PDF. Please try again.");
    } finally {
      historyDownloadLock.current = false;
      setHistoryDownloading(false);
    }
  };

  const fetchEvents = useCallback(async (offset = 0) => {
    const version = offset === 0 ? ++requestVersion.current : requestVersion.current;
    try {
      if (offset === 0) setLoading(true); else setLoadingMore(true);
      let query = supabase
        .from("razorpay_events")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 99);

      if (category !== "all") query = query.eq("category", category);
      if (eventType !== "all") query = query.eq("event_type", eventType);
      const start = dateStart(period);
      if (start) query = query.gte("created_at", start);

      const { data, error } = await query;
      if (error) throw error;
      if (version !== requestVersion.current) return;
      const rows = (data as unknown as RazorpayEvent[]) || [];
      setEvents((previous) => offset === 0 ? rows : [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]);
      setHasMore(rows.length === 100);
    } catch (err: any) {
      console.error("Error loading payment events", err);
      toast.error(err?.message || "Could not load payment events");
    } finally {
      if (version === requestVersion.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [category, eventType, period]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Live updates as Razorpay sends new events
  useEffect(() => {
    const channel = supabase
      .channel("razorpay-events-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "razorpay_events" },
        () => fetchEvents(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) =>
      [e.event_type, e.entity_id, e.email, e.contact, e.status, e.account_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [events, search]);

  const statBoxes = useMemo(() => {
    type Box = [string, string, string, string];
    const count = (label: string, test: (t: string) => boolean, tone = ""): Box => {
      const n = events.filter((e) => test(e.event_type)).length;
      return [label, compactNumber(n), tone, n.toLocaleString("en-IN")];
    };
    const amount = (label: string, test: (t: string) => boolean): Box => {
      const sum = events.filter((e) => test(e.event_type)).reduce((s, e) => s + (e.amount_paise || 0), 0);
      return [label, compactAmount(sum), "", formatAmount(sum, "INR")];
    };
    const is = (...names: string[]) => (t: string) => names.includes(t);
    const total = count("Events", () => true);
    const risk = count("Risk", isFailureEvent, "text-destructive");
    const map: Record<string, Box[]> = {
      order: [total, count("Paid", is("order.paid")), count("Delivered", is("order.notification.delivered")), amount("Amount", is("order.paid"))],
      invoice: [total, count("Paid", is("invoice.paid", "invoice.partially_paid")), count("Expired", is("invoice.expired"), "text-destructive"), amount("Amount", is("invoice.paid", "invoice.partially_paid"))],
      subscription: [total, count("Active", is("subscription.activated", "subscription.charged", "subscription.resumed")), count("Cancelled", is("subscription.cancelled", "subscription.halted"), "text-destructive"), amount("Charged", is("subscription.charged"))],
      settlement: [total, count("Processed", is("settlement.processed")), risk, amount("Settled", is("settlement.processed"))],
      qr_code: [total, count("Created", is("qr_code.created")), count("Closed", is("qr_code.closed")), amount("Credited", is("qr_code.credited"))],
      fund_account: [total, count("Validated", is("fund_account.validation.completed")), count("Failed", is("fund_account.validation.failed"), "text-destructive"), count("Pending", (t) => !t.startsWith("fund_account.validation."))],
      refund: [total, count("Created", is("refund.created")), count("Failed", is("refund.failed"), "text-destructive"), amount("Refunded", is("refund.processed"))],
      account: [total, count("Activated", is("account.instantly_activated")), count("KYC pending", is("account.activated_kyc_pending")), risk],
      payment_link: [total, count("Paid", (t) => t.endsWith(".paid")), count("Expired", (t) => t.endsWith(".expired") || t.endsWith(".cancelled"), "text-destructive"), amount("Amount", (t) => t.endsWith(".paid"))],
      engage: [total, count("Sent", (t) => !isFailureEvent(t)), risk, amount("Amount", () => true)],
    };
    return map[category] ?? [total, risk, amount("Captured", is("payment.captured")), amount("Refunded", is("refund.processed"))];
  }, [events, category]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.category] = (counts[e.category] || 0) + 1;
    return counts;
  }, [events]);

  const typeOptions =
    category === "all"
      ? Object.values(RAZORPAY_EVENT_CATEGORIES).flatMap((c) => c.events)
      : RAZORPAY_EVENT_CATEGORIES[category]?.events || [];

  const statusClass = (e: RazorpayEvent) =>
    isFailureEvent(e.event_type) ? "bg-destructive/10 text-destructive" : e.event_type.startsWith("refund") ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

  return createPortal(
    <div className="fixed inset-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="shrink-0 bg-background pt-[env(safe-area-inset-top)]">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Go back" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-lg font-semibold tabular-nums" aria-label={walletBalance ? `Wallet balance ${formatAmount(walletBalance.balance_paise, walletBalance.currency)}` : "Wallet balance loading"}>
              {balanceLoading && !walletBalance ? "₹—" : formatAmount(walletBalance?.balance_paise ?? 0, walletBalance?.currency ?? "INR")}
            </h1>
            <p className="text-[11px] text-muted-foreground">Wallet balance</p>
          </div>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh payment events and wallet balance" onClick={() => { void fetchEvents(); void fetchWalletBalance(); }}>
            <RefreshCw className={`h-5 w-5 ${loading || balanceLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Download filtered payment history PDF" title="Download filtered payment history PDF" disabled={historyDownloading} onClick={downloadHistory}>
            {historyDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
        </header>
        <nav aria-label="Event groups" className="overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full">
            {[["all", "All", null, events.length] as const, ...Object.entries(RAZORPAY_EVENT_CATEGORIES).map(([key, cfg]) => [key, cfg.label, cfg.icon, categoryCounts[key] || 0] as const)].map(([key, label, Icon, count]) => (
              <Button
                variant="ghost"
                key={key}
                type="button"
                aria-current={category === key ? "true" : undefined}
                onClick={() => { setCategory(key); setEventType("all"); }}
                className={`flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none border-b-2 px-4 text-sm font-semibold ${category === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                {Icon && <Icon className="h-4 w-4" />}{label}<span title={count.toLocaleString("en-IN")} className="text-xs tabular-nums opacity-70">{compactNumber(count)}</span>
              </Button>
            ))}
          </div>
        </nav>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <section aria-label="Payment event history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
            {statBoxes.map(([label, value, tone, fullValue]) => (
              <div key={label} className="min-w-0 px-1 py-3">
                <p title={fullValue} aria-label={`${label}: ${fullValue}`} className={`break-all text-sm font-bold tabular-nums ${tone}`}>{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:px-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search payment id, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="sm:w-64"><SelectValue placeholder="All event names" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All event names</SelectItem>
                {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <nav aria-label="Date filters" className="overflow-x-auto px-4 pb-3 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-1">
              {DATE_FILTERS.map(([value, label]) => <Button key={value} size="sm" variant={period === value ? "default" : "outline"} aria-pressed={period === value} onClick={() => setPeriod(value)} className="h-9 shrink-0">{label}</Button>)}
            </div>
          </nav>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading payment events</span></div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center"><p className="font-medium">No events yet</p><p className="mt-1 text-sm text-muted-foreground">Events appear here as soon as Razorpay sends them.</p></div>
          ) : (
            <div className="border-t border-border">
              {filtered.map((e) => (
                <article key={e.id} role="button" tabIndex={0} onClick={() => setSelected(e)} onKeyDown={(k) => { if (k.key === "Enter") setSelected(e); }} className="cursor-pointer border-b border-border px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`min-w-0 break-all rounded-sm px-2 py-0.5 text-xs font-semibold ${statusClass(e)}`}>{e.event_type}</span>
                      {e.signature_verified ? <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-label="Signature verified" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Signature not verified" />}
                    </div>
                    <span className="min-w-0 max-w-full break-all text-sm font-bold tabular-nums">{formatAmount(e.amount_paise, e.currency)}</span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-foreground">{e.entity_id || "—"}</p>
                  {e.error_description && <p className="mt-1 break-words text-xs text-destructive">{e.error_description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={e.created_at}>{formatTime(e.created_at)}</time>
                    {e.status && <span>{e.status}</span>}
                    {(e.email || e.contact) && <span className="break-all">{e.email || e.contact}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && hasMore && <div className="px-4 py-4 sm:px-6"><Button variant="outline" className="w-full" disabled={loadingMore} onClick={() => fetchEvents(events.length)}>{loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more</Button></div>}
        </section>
      </main>

      {selected && (
        <section aria-label="Payment event details" className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
          <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-border px-2">
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Back to payment events" onClick={() => setSelected(null)}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1"><h1 className="text-base font-semibold">Event Details</h1><p className="break-all text-xs text-muted-foreground">{selected.event_type}</p></div>
            {invoiceUrl && <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={openInvoice} aria-label="View Razorpay invoice" title="View Razorpay invoice"><FileText className="h-5 w-5" /></Button>}
          <Button
            variant="ghost"
            size="icon"
            disabled={!selected || downloading}
            aria-label="Download event details PDF"
            title="Download event details PDF"
            className="h-11 w-11 shrink-0"
            onClick={async () => {
              if (!selected) return;
              setDownloading(true);
              try {
                await downloadPaymentEventPdf(selected, RAZORPAY_EVENT_CATEGORIES[selected.category]?.label ?? selected.category);
                toast.success("PDF downloaded");
              } catch (err: any) {
                toast.error(err?.message || "Could not download PDF");
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          </header>
          {selected && (
            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 grid grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <dl className="divide-y divide-border">
                  {([
                    ["event", selected.event_type],
                    ["group", RAZORPAY_EVENT_CATEGORIES[selected.category]?.label ?? selected.category],
                    ["received", formatTime(selected.created_at)],
                    ["razorpay_time", selected.event_created_at ? formatTime(selected.event_created_at) : "—"],
                    ["entity", selected.entity_type || "—"],
                    ["entity_id", selected.entity_id || "—"],
                    ["status", selected.status || "—"],
                    ["amount", formatAmount(selected.amount_paise, selected.currency)],
                    ["currency", selected.currency || "—"],
                    ["email", selected.email || "—"],
                    ["contact", selected.contact || "—"],
                    ["event_id", selected.event_id || "—"],
                    ["account_id", selected.account_id || "—"],
                    ["signature", selected.signature_verified ? "verified" : "not verified"],
                    ["error_code", selected.error_code || "—"],
                    ["error", selected.error_description || "—"],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-3 text-sm">
                      <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className={`min-w-0 flex-1 break-all font-mono text-xs ${(k === "error" || k === "error_code") && v !== "—" ? "text-destructive" : k === "signature" && !selected.signature_verified ? "text-destructive" : "text-foreground"}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {(() => {
                  const payloadRows = flattenPayload(selected.payload);
                  if (payloadRows.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">payload — full data</p>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground" aria-label="Copy full payload details" onClick={() => copy(payloadRows.map(([k, v]) => `${k}: ${v}`).join("\n"))}>
                          <Copy className="h-3.5 w-3.5" />Copy
                        </Button>
                      </div>
                      <dl className="divide-y divide-border">
                        {payloadRows.map(([k, v], i) => (
                          <div key={`${k}-${i}`} className="flex gap-3 py-2.5 text-sm">
                            <dt className="w-40 shrink-0 break-all text-muted-foreground">{k}</dt>
                            <dd className={`min-w-0 flex-1 break-all font-mono text-xs ${k.endsWith("error_description") || k.endsWith("reason") || k.endsWith("error") ? "text-destructive" : "text-foreground"}`}>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })()}
              </TabsContent>
              <TabsContent value="raw" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <div className="rounded-md bg-muted">
                  <div className="flex justify-end px-1 pt-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Copy raw event" onClick={() => copy(JSON.stringify(selected.payload, null, 2))}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs">{JSON.stringify(selected.payload, null, 2)}</pre>
                </div>
              </TabsContent>
            </Tabs>
          )}
          {selected && canRefund(selected) && (
            <div className="shrink-0 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button
                variant="destructive"
                className="h-12 w-full text-base"
                onClick={() => {
                  setRefundAmount(String(Math.max(1, remainingRefundInr(selected))));
                  setRefundSpeed("normal");
                  setRefundReason("");
                  setRefundOpen(true);
                }}
              >
                <Undo2 className="mr-2 h-5 w-5" /> Refund Payment
              </Button>
            </div>
          )}
        </section>
      )}

      {refundOpen && (
        <section aria-label="Refund payment" className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2">
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to event details" disabled={refunding} onClick={() => setRefundOpen(false)}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-lg font-semibold">Refund Payment</h1>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="break-all font-mono text-xs text-muted-foreground">{selected?.entity_id}</div>
              <div className="mt-1 font-semibold">Paid: {selected ? formatAmount(selected.amount_paise, selected.currency) : ""}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Refund amount (₹)</label>
              <Input type="number" inputMode="decimal" min={1} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Full amount is filled. Lower it for a partial refund.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Refund speed</label>
              <Select value={refundSpeed} onValueChange={(v) => setRefundSpeed(v as "normal" | "optimum")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal (5–7 business days, free)</SelectItem>
                  <SelectItem value="optimum">Instant (Razorpay fee applies)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input value={refundReason} maxLength={250} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Customer request" />
            </div>
          </div>
          <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="destructive" className="h-12 w-full text-base" disabled={refunding || !refundAmount} onClick={submitRefund}>
              {refunding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Undo2 className="mr-2 h-5 w-5" />}
              Confirm Refund ₹{refundAmount || 0}
            </Button>
          </div>
        </section>
      )}
    </div>,
    document.body
  );
};

export default PaymentEvents;
