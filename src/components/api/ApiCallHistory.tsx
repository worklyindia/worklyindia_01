import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Download, Gift, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { callHistoryDate, callHistoryTime, callHistoryLabels, type CallHistoryRow } from "@/lib/apiCallHistoryPdf";

const pageSize = 30;
const sourceStyles: Record<string, string> = { purchase: "bg-primary/10 text-primary", topup: "bg-warning/10 text-warning", free: "bg-success/10 text-success" };

export default function ApiCallHistory({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [rows, setRows] = useState<CallHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [totals, setTotals] = useState<{ count: number; calls: number } | null>(null);
  const [period] = useState(() => { const end = new Date(); return { start: new Date(end.getTime() - 30 * 86400000), end }; });
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const offsetRef = useRef(0);
  const aliveRef = useRef(true);

  const fetchRows = async (offset: number, size: number) => {
    const { data, error: queryError } = await supabase.from("api_call_purchases")
      .select("id,calls,amount,source,created_at").eq("user_id", userId)
      .gte("created_at", period.start.toISOString()).lte("created_at", period.end.toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + size - 1);
    if (queryError) throw queryError;
    return (data ?? []) as CallHistoryRow[];
  };
  const loadNext = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoadingMore(offsetRef.current > 0);
    try {
      const batch = await fetchRows(offsetRef.current, pageSize);
      if (!aliveRef.current) return;
      offsetRef.current += batch.length;
      setRows(current => [...current, ...batch]);
      setHasMore(batch.length === pageSize);
      setError("");
    } catch {
      if (aliveRef.current) setError("Couldn't load history. Please try again.");
    } finally {
      busyRef.current = false;
      if (aliveRef.current) { setLoading(false); setLoadingMore(false); }
    }
  };
  const loadRef = useRef(loadNext);
  loadRef.current = loadNext;

  useEffect(() => {
    aliveRef.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void loadRef.current();
    void loadTotals();
    return () => { aliveRef.current = false; document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || loadingMore || !hasMore || error) return;
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void loadRef.current(); }, { root: scrollRef.current, rootMargin: "320px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, rows.length, error]);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const allRows: CallHistoryRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const batch = await fetchRows(offset, 500);
        allRows.push(...batch);
        if (batch.length < 500) break;
      }
      const { downloadApiCallHistoryPdf } = await import("@/lib/apiCallHistoryPdf");
      downloadApiCallHistoryPdf(allRows, period.start, period.end);
      toast.success("API Call History PDF downloaded");
    } catch { toast.error("Couldn't download history. Please try again."); }
    finally { if (aliveRef.current) setDownloading(false); }
  };

  const loadTotals = async () => {
    try {
      const filters = supabase.from("api_call_purchases").select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("created_at", period.start.toISOString()).lte("created_at", period.end.toISOString());
      const { count, error: countError } = await filters;
      if (countError) throw countError;
      let calls = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data, error: sumError } = await supabase.from("api_call_purchases").select("calls")
          .eq("user_id", userId).gte("created_at", period.start.toISOString()).lte("created_at", period.end.toISOString())
          .range(offset, offset + 999);
        if (sumError) throw sumError;
        const batch = data ?? [];
        calls += batch.reduce((sum, row) => sum + Number(row.calls || 0), 0);
        if (batch.length < 1000) break;
      }
      if (aliveRef.current) setTotals({ count: count ?? 0, calls });
    } catch { if (aliveRef.current) setTotals(null); }
  };

  return createPortal(<div role="dialog" aria-modal="true" aria-label="API Call History" className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:px-4">
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onBack} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
      <History className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 leading-tight">
        <h2 className="text-lg font-semibold">API Call History</h2>
        <p className="text-xs text-muted-foreground" aria-live="polite">{totals ? `${totals.count.toLocaleString("en-IN")} ${totals.count === 1 ? "entry" : "entries"} · ${totals.calls.toLocaleString("en-IN")} calls added` : "\u00A0"}</p>
      </div>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Download PDF" aria-label="Download API Call History PDF" disabled={loading || downloading} onClick={download}>{downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</Button>
    </header>
    <section ref={scrollRef} aria-label="API call history entries" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {loading ? <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading history</span></div> : !rows.length && !error ? <div className="py-16 text-center"><History className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><p>No calls added in the last 30 days</p></div> : <div className="divide-y divide-border">
          {rows.map(row => <article key={row.id} className="flex items-start justify-between gap-3 py-4">
            <div className="min-w-0 flex-1"><span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${sourceStyles[row.source] ?? sourceStyles.purchase}`}>{row.source === "free" && <Gift className="h-3 w-3" />}{callHistoryLabels[row.source] ?? callHistoryLabels.purchase}</span>
              <p className="mt-2 text-xs text-muted-foreground"><time dateTime={row.created_at}>{callHistoryDate.format(new Date(row.created_at))} · {callHistoryTime.format(new Date(row.created_at)).toUpperCase()}</time></p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-bold">+{Number(row.calls).toLocaleString("en-IN")} calls</p><p className="text-xs text-muted-foreground">{Number(row.amount) > 0 ? `₹${Number(row.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Free"}</p></div>
          </article>)}
        </div>}
        {error && <div role="alert" className="py-4 text-center text-sm text-destructive"><p>{error}</p><Button variant="ghost" onClick={() => { setError(""); void loadRef.current(); }}>Retry</Button></div>}
        {!error && hasMore && <div ref={sentinelRef} className="flex h-12 items-center justify-center" role="status">{loadingMore && <><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="sr-only">Loading older history</span></>}</div>}
      </div>
    </section>
  </div>, document.body);
}
