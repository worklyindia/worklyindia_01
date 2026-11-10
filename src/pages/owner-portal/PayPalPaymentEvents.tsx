import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Activity, Search, CreditCard, ShoppingCart, FileText, Repeat, Banknote, Undo2, AlertTriangle, ShieldCheck, Copy, Download, Loader2, RefreshCw, Package, Building2, UserRound, KeyRound, Calendar, Eye } from "lucide-react";
import { downloadPaymentEventPdf, downloadPaymentEventsHistoryPdf, flattenPayload } from "@/lib/paymentEventsPdf";
import { normalizePayPalEvent, matchesPayPalEvent, type PayPalEventRow } from "@/lib/paypalEvents";
import { PAYPAL_EVENT_CATALOG } from "@/lib/paypalEventCatalog";
import { collectPayPalEvents, filterPayPalEvents, payPalCategoryCounts, payPalStatBoxes, isPayPalRiskEvent } from "@/lib/paypalEventStats";
import { goBack } from "@/lib/goBack";

type PayPalEvent = ReturnType<typeof normalizePayPalEvent>;
const CATEGORY_ICONS: Record<string, typeof CreditCard> = {
  payment: CreditCard, order: ShoppingCart, subscription: Repeat, plan: Calendar,
  product: Package, invoice: FileText, payout: Banknote, refund: Undo2,
  dispute: AlertTriangle, vault: CreditCard, merchant: Building2, account: UserRound,
  identity: KeyRound, other: Activity,
};
const PAYPAL_EVENT_CATEGORIES = Object.fromEntries(Object.entries(PAYPAL_EVENT_CATALOG).map(([key, config]) => [key, { ...config, icon: CATEGORY_ICONS[key] ?? Activity }]));
const DATE_FILTERS = [["all", "All time"], ["today", "Today"], ["7", "7 Day"], ["30", "30 Day"], ["6m", "6 month"], ["1y", "1 Year"]] as const;
const dateStart = (period: string) => {
  if (period === "all") return null;
  const date = new Date(); date.setHours(0, 0, 0, 0);
  if (period === "7" || period === "30") date.setDate(date.getDate() - Number(period) + 1);
  if (period === "6m") date.setMonth(date.getMonth() - 6);
  if (period === "1y") date.setFullYear(date.getFullYear() - 1);
  return date.toISOString();
};
const compactNumber = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const formatAmount = (amount: number | null, currency: string | null) => {
  if (amount === null || !currency) return "—";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100); }
  catch { return `${amount / 100} ${currency}`; }
};
const formatTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
const failure = isPayPalRiskEvent;

const PayPalPaymentEvents = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<PayPalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(100);
  const [search, setSearch] = useState(""), [category, setCategory] = useState("all"), [eventType, setEventType] = useState("all"), [period, setPeriod] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PayPalEvent | null>(null);
  const [downloading, setDownloading] = useState(false), [historyDownloading, setHistoryDownloading] = useState(false);
  const requestVersion = useRef(0), historyDownloadLock = useRef(false);
  const selectedId = searchParams.get("event");
  const selected = selectedId ? events.find(e => e.id === selectedId) ?? (selectedRecord?.id === selectedId ? selectedRecord : null) : null;
  const setSelected = (event: PayPalEvent | null) => {
    setSelectedRecord(event); const params = new URLSearchParams(searchParams);
    if (event) params.set("event", event.id); else params.delete("event");
    setSearchParams(params);
  };
  const fetchEvents = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadError(null);
    const to = new Date().toISOString(), from = dateStart(period);
    try {
      const all = await collectPayPalEvents(async (offset, size) => {
        let query = supabase.from("payment_events").select("*").eq("provider", "paypal")
          .lte("created_at", to).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + size - 1);
        if (from) query = query.gte("created_at", from);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as PayPalEventRow[];
      }, () => version === requestVersion.current);
      if (all) { setEvents(all); setVisibleCount(100); }
    } catch (error) {
      if (version !== requestVersion.current) return;
      setEvents([]); setLoadError(error instanceof Error ? error.message : "Could not load PayPal events");
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [period]);
  useEffect(() => { void fetchEvents(); return () => { requestVersion.current += 1; }; }, [fetchEvents]);
  useEffect(() => { setVisibleCount(100); }, [category, eventType, search]);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    supabase.from("payment_events").select("*").eq("provider", "paypal").eq("id", selectedId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) toast.error("Could not load event details");
      if (data) setSelectedRecord(normalizePayPalEvent(data as PayPalEventRow));
    });
    return () => { cancelled = true; };
  }, [selectedId]);
  const [wallet, setWallet] = useState<Record<string, { balance: number }> | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("paypal-webhook", { body: { action: "wallet" } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Could not load wallet balance");
      setWallet(data.balances ?? {});
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not load wallet balance"); }
    finally { setWalletLoading(false); }
  }, []);
  useEffect(() => { void fetchWallet(); }, [fetchWallet]);
  // Show one balance like the Razorpay page: USD (PayPal's main currency); other currencies only if they hold money.
  const walletText = (() => {
    if (!wallet) return walletLoading ? "$—" : "$0.00";
    const others = Object.entries(wallet).filter(([cur, b]) => cur !== "USD" && Number(b.balance) !== 0);
    const main = formatAmount(wallet.USD?.balance ?? 0, "USD");
    return main;
  })();
  const [walletOpen, setWalletOpen] = useState(false);
  const walletRows = Object.entries(wallet ?? {}).sort(([a], [b]) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));

  // Refunded amount per capture, from PayPal refund events (resource.links rel "up" points at the capture).
  const refundedByCapture = useMemo(() => {
    const byRefund = new Map<string, { capture: string; cents: number }>();
    for (const e of events) {
      if (e.event_type !== "PAYMENT.CAPTURE.REFUNDED" || e.amount_paise === null) continue;
      const res = (e.payload as any)?.resource ?? {};
      const up = (res.links ?? []).find((l: any) => l?.rel === "up")?.href as string | undefined;
      const capture = up?.split("/captures/")[1]?.split(/[/?]/)[0];
      if (capture) byRefund.set(String(res.id ?? e.event_id), { capture, cents: e.amount_paise });
    }
    const out = new Map<string, number>();
    for (const { capture, cents } of byRefund.values()) out.set(capture, (out.get(capture) ?? 0) + cents);
    return out;
  }, [events]);
  const [submittedRefunds, setSubmittedRefunds] = useState<Set<string>>(new Set());
  const remainingRefund = (e: PayPalEvent) => Math.max(0, ((e.amount_paise ?? 0) - (refundedByCapture.get(e.entity_id ?? "") ?? 0)) / 100);
  const canRefund = (e: PayPalEvent) => {
    if (e.event_type !== "PAYMENT.CAPTURE.COMPLETED" || !e.entity_id || submittedRefunds.has(e.entity_id)) return false;
    const created = Date.parse(e.event_created_at ?? e.created_at);
    if (!created || Date.now() - created > 7 * 86400000) return false;
    return remainingRefund(e) > 0;
  };
  const refundOpen = searchParams.get("view") === "refund" && !!selected;
  const setRefundOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set("view", "refund"); else next.delete("view");
    setSearchParams(next, { replace: !open });
  };
  const [refundAmount, setRefundAmount] = useState(""), [refundReason, setRefundReason] = useState(""), [refunding, setRefunding] = useState(false);
  const submitRefund = async () => {
    if (!selected?.entity_id) return;
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("paypal-webhook", { body: { action: "refund", capture_id: selected.entity_id, amount: Number(refundAmount), reason: refundReason } });
      if (error || data?.error || !data?.success) throw new Error(data?.error || error?.message || "Refund failed");
      setSubmittedRefunds(prev => new Set(prev).add(selected.entity_id as string));
      toast.success(`Refund ${data.refund.id} — ${data.refund.amount} ${data.refund.currency} (${data.refund.status})`);
      setRefundOpen(false);
      setTimeout(() => { void fetchEvents(); void fetchWallet(); }, 4000);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Refund failed"); }
    finally { setRefunding(false); }
  };
  const filtered = useMemo(() => filterPayPalEvents(events, category, eventType, search), [events, category, eventType, search]);
  const visible = filtered.slice(0, visibleCount);
  const categoryCounts = useMemo(() => payPalCategoryCounts(events), [events]);
  const typeOptions = [...new Set([...(category === "all" ? Object.values(PAYPAL_EVENT_CATEGORIES).flatMap(c => c.events) : PAYPAL_EVENT_CATEGORIES[category]?.events ?? []), ...events.filter(e => category === "all" || e.category === category).map(e => e.event_type)])].sort();
  const statBoxes = useMemo(() => payPalStatBoxes(filtered, category), [filtered, category]);
  const statusClass = (e: PayPalEvent) => failure(e.event_type) ? "bg-destructive/10 text-destructive" : e.category === "refund" ? "bg-warning/10 text-warning" : "bg-success/10 text-success";
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success("Copied"); } catch { toast.error("Could not copy"); } };
  const downloadHistory = async () => {
    if (historyDownloadLock.current) return;
    historyDownloadLock.current = true; setHistoryDownloading(true);
    const to = new Date().toISOString(), from = dateStart(period);
    try {
      const all: PayPalEvent[] = []; const seen = new Set<string>();
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from("payment_events").select("*").eq("provider", "paypal").lte("created_at", to)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
        if (eventType !== "all") query = query.eq("event_type", eventType);
        if (from) query = query.gte("created_at", from);
        const { data, error } = await query; if (error) throw error;
        for (const row of (data ?? []) as PayPalEventRow[]) {
          const e = normalizePayPalEvent(row);
          if (!seen.has(e.id) && (category === "all" || e.category === category) && matchesPayPalEvent(e, search.trim())) { all.push(e); seen.add(e.id); }
        }
        if ((data?.length ?? 0) < 500) break;
      }
      if (!all.length) { toast.info("No events match the selected filters."); return; }
      await downloadPaymentEventsHistoryPdf(all, { period: DATE_FILTERS.find(([v]) => v === period)?.[1] ?? "All time", group: `PayPal / ${category === "all" ? "All" : PAYPAL_EVENT_CATEGORIES[category]?.label}`, eventName: eventType, search, from, to });
      toast.success("History PDF downloaded");
    } catch { toast.error("Could not download history PDF"); }
    finally { historyDownloadLock.current = false; setHistoryDownloading(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="shrink-0 bg-background pt-[env(safe-area-inset-top)]">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Go back" onClick={() => goBack(navigate, "/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1">
              <h1 className="truncate text-lg font-semibold tabular-nums" aria-label={`Wallet balance ${walletText}`}>{walletText}</h1>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="View all wallet balances" title="View all balances" onClick={() => setWalletOpen(true)}><Eye className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Wallet balance</p>
          </div>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh payment events and wallet balance" title="Refresh" onClick={() => { void fetchEvents(); void fetchWallet(); }}><RefreshCw className={`h-5 w-5 ${loading || walletLoading ? "animate-spin" : ""}`} /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Download filtered payment history PDF" title="Download filtered payment history PDF" disabled={historyDownloading} onClick={downloadHistory}>
            {historyDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
        </header>
        {walletOpen && (
          <div className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Go back" onClick={() => setWalletOpen(false)}><ArrowLeft className="h-5 w-5" /></Button>
              <h2 className="truncate text-lg font-semibold">PayPal wallet balances</h2>
            </header>
            <div className="flex-1 overflow-y-auto">
              {walletRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">{walletLoading ? "Loading…" : "No balance yet"}</p>
              ) : walletRows.map(([cur, b]) => (
                <div key={cur} className="flex items-center justify-between border-b border-border px-4 py-4">
                  <span className="text-sm font-medium">{cur}</span>
                  <span className="text-base font-semibold tabular-nums">{formatAmount(b.balance, cur)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <nav aria-label="Event groups" className="overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full">
            {[["all", "All", null, events.length] as const, ...Object.entries(PAYPAL_EVENT_CATEGORIES).map(([key, cfg]) => [key, cfg.label, cfg.icon, categoryCounts[key] || 0] as const)].map(([key, label, Icon, count]) => (
              <Button
                variant="ghost"
                key={key}
                type="button"
                aria-current={category === key ? "true" : undefined}
                onClick={() => { setCategory(key); setEventType("all"); }}
                className={`flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none border-b-2 px-4 text-sm font-semibold ${category === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              >
                {Icon && <Icon className="h-4 w-4" />}{label}<span title={count.toLocaleString("en-IN")} className="text-xs tabular-nums opacity-70">{loading || loadError ? "—" : compactNumber(count)}</span>
              </Button>
            ))}
          </div>
        </nav>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <section aria-label="Payment event history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
            {statBoxes.map(box => {
              const values = box.amounts ? Object.entries(box.amounts).sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => formatAmount(amount, currency)) : [compactNumber(box.count ?? 0)];
              const fullValue = box.amounts ? values.join(" / ") || "—" : (box.count ?? 0).toLocaleString("en-IN");
              return (
              <div key={box.label} className="min-w-0 px-1 py-3">
                <p title={fullValue} aria-label={`${box.label}: ${loading || loadError ? "unavailable" : fullValue}`} className={`break-all text-sm font-bold tabular-nums ${box.risk ? "text-destructive" : ""}`}>{loading || loadError ? "—" : values.length ? values.map(value => <span className="block" key={value}>{value}</span>) : "—"}</p>
                <p className="break-words text-[11px] text-muted-foreground">{box.label}</p>
              </div>
            ); })}
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
          ) : loadError ? (
            <div role="alert" className="px-4 py-12 text-center"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" className="mt-3" onClick={() => { void fetchEvents(); }}>Retry</Button></div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center"><p className="font-medium">No events yet</p><p className="mt-1 text-sm text-muted-foreground">Events appear here as soon as PayPal sends them.</p></div>
          ) : (
            <div className="border-t border-border">
              {visible.map((e) => (
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
          {!loading && !loadError && visibleCount < filtered.length && <div className="px-4 py-4 sm:px-6"><Button variant="outline" className="w-full" onClick={() => setVisibleCount(n => n + 100)}>Load more</Button></div>}
        </section>
      </main>

      {selected && (
        <section aria-label="Payment event details" className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
          <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-border px-2">
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Back to payment events" onClick={() => setSelected(null)}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1"><h1 className="text-base font-semibold">Event Details</h1><p className="break-all text-xs text-muted-foreground">{selected.event_type}</p></div>
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
                await downloadPaymentEventPdf(selected, PAYPAL_EVENT_CATEGORIES[selected.category]?.label ?? selected.category, "PayPal");
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
                    ["group", PAYPAL_EVENT_CATEGORIES[selected.category]?.label ?? selected.category],
                    ["received", formatTime(selected.created_at)],
                    ["paypal_time", selected.event_created_at ? formatTime(selected.event_created_at) : "—"],
                    ["entity", selected.entity_type || "—"],
                    ["entity_id", selected.entity_id || "—"],
                    ["status", selected.status || "—"],
                    ["processing", selected.processing_status],
                    ["processed_at", selected.processed_at ? formatTime(selected.processed_at) : "—"],
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
              <Button variant="destructive" className="h-12 w-full text-base" onClick={() => { setRefundAmount(remainingRefund(selected).toFixed(2)); setRefundReason(""); setRefundOpen(true); }}>
                <Undo2 className="mr-2 h-5 w-5" />Refund {formatAmount(Math.round(remainingRefund(selected) * 100), selected.currency)}
              </Button>
            </div>
          )}
        </section>
      )}
      {refundOpen && selected && (
        <section aria-label="Refund payment" className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] text-foreground">
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2">
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to event details" disabled={refunding} onClick={() => setRefundOpen(false)}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-lg font-semibold">Refund Payment</h1>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="break-all font-mono text-xs text-muted-foreground">{selected.entity_id}</div>
              <div className="mt-1 font-semibold">Paid: {formatAmount(selected.amount_paise, selected.currency)}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Refund amount ({selected.currency})</label>
              <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Full remaining amount is filled. Lower it for a partial refund.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note to customer (optional)</label>
              <Input value={refundReason} maxLength={250} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Customer request" />
            </div>
          </div>
          <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="destructive" className="h-12 w-full text-base" disabled={refunding || !(Number(refundAmount) > 0) || Number(refundAmount) > remainingRefund(selected)} onClick={submitRefund}>
              {refunding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Undo2 className="mr-2 h-5 w-5" />}
              Confirm Refund {refundAmount || 0} {selected.currency}
            </Button>
          </div>
        </section>
      )}
    </div>, document.body
  );
};
export default PayPalPaymentEvents;
