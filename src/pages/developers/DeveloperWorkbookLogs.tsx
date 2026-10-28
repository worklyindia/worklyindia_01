import { useCallback, useEffect, useRef, useState } from "react";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, Download, Loader2, RefreshCw, ScrollText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type EndpointDetails = { url: string; description: string | null };
type WorkbookLog = {
  id: string;
  event: string;
  status: string;
  response_status: number | null;
  error_message: string | null;
  created_at: string | null;
  webhook_id?: string | null;
  payload?: unknown;
  delivered_at?: string | null;
  webhook_endpoints: EndpointDetails | null;
};

const pageSize = 30;

function todayStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

export default function DeveloperWorkbookLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<WorkbookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [selected, setSelected] = useState<WorkbookLog | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = useCallback(async (offset: number) => {
    return supabase
      .from("webhook_deliveries")
      .select("id,webhook_id,event,payload,status,response_status,error_message,created_at,delivered_at,webhook_endpoints!inner(url,description)", { count: "exact" })
      .gte("created_at", todayStart())
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setLogs([]);
    setTotal(0);
    fetchLogs(0).then(({ data, count, error: queryError }) => {
      if (!current) return;
      setLoading(false);
      if (queryError) {
        setError("Couldn't load workbook logs. Please try again.");
        return;
      }
      setLogs((data ?? []) as WorkbookLog[]);
      setTotal(count ?? 0);
    });
    return () => { current = false; };
  }, [refreshKey, fetchLogs]);

  const loadMore = async () => {
    if (loadingMore || loading || logs.length >= total) return;
    setLoadingMore(true);
    const { data, error: queryError } = await fetchLogs(logs.length);
    setLoadingMore(false);
    if (queryError) {
      setError("Couldn't load more workbook logs. Please try again.");
      return;
    }
    setError("");
    setLogs((current) => [...current, ...((data ?? []) as WorkbookLog[])]);
  };

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || logs.length >= total) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { root: scrollRef.current, rootMargin: "320px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, loadingMore, logs.length, total, error]);

  // Esc dabane par log details band ho jaye
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const downloadPdf = async () => {
    if (downloading || loading) return;
    setDownloading(true);
    const start = new Date(todayStart());
    const end = new Date();
    const allLogs: WorkbookLog[] = [];
    const batchSize = 500;
    try {
      for (let offset = 0; ; offset += batchSize) {
        const { data, error: queryError } = await supabase
          .from("webhook_deliveries")
          .select("id,webhook_id,event,payload,status,response_status,error_message,created_at,delivered_at,webhook_endpoints!inner(url,description)")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (queryError) throw queryError;
        allLogs.push(...((data ?? []) as WorkbookLog[]));
        if (!data || data.length < batchSize) break;
      }
      const { downloadWebhookLogsPdf } = await import("@/lib/webhookLogsPdf");
      downloadWebhookLogsPdf(
        allLogs.map((log) => ({ ...log, endpoint: log.webhook_endpoints?.url ?? "Unknown endpoint" })),
        "Today",
        start,
        end
      );
      toast.success("Workbook Logs PDF downloaded");
    } catch (downloadError) {
      console.error("Workbook Logs PDF download failed", downloadError);
      toast.error("Couldn't download workbook logs. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="z-40 shrink-0 bg-background">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Back to Developer Portal" onClick={() => goBack(navigate, "/developers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-lg font-semibold">Workbook Logs</h1>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Download today's workbook logs PDF" title="Download PDF" disabled={downloading || loading} onClick={downloadPdf}>
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh workbook logs" onClick={() => setRefreshKey((key) => key + 1)}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </header>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <section ref={scrollRef} aria-label="Workbook delivery history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <p className="text-sm font-medium text-muted-foreground">{loading ? "Loading deliveries…" : `${total.toLocaleString("en-IN")} ${total === 1 ? "delivery" : "deliveries"}`}</p>
            {!loading && total > 0 && <ScrollText className="h-4 w-4 text-primary" aria-hidden="true" />}
          </div>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading workbook logs</span></div>
          ) : error && logs.length === 0 ? (
            <div className="px-4 py-14 text-center sm:px-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" className="mt-4" onClick={() => setRefreshKey((key) => key + 1)}>Try again</Button></div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-16 text-center sm:px-6"><ScrollText className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><p className="font-medium">No workbook deliveries today</p></div>
          ) : (
            <div className="border-t border-border">
              {logs.map((log) => {
                const date = log.created_at ? new Date(log.created_at) : null;
                const delivered = log.status === "delivered";
                return (
                  <article key={log.id} role="button" tabIndex={0} onClick={() => setSelected(log)} onKeyDown={(e) => { if (e.key === "Enter") setSelected(log); }} className="cursor-pointer border-b border-border px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-semibold leading-5">{log.event}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{log.webhook_endpoints?.url ?? "Unknown endpoint"}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${delivered ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {delivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {delivered ? (log.response_status ?? "Success") : (log.response_status ?? "Failed")}
                      </span>
                    </div>
                    {log.error_message && <p className="mt-2 break-words text-xs text-destructive">{log.error_message}</p>}
                    {date && <time dateTime={log.created_at ?? undefined} className="mt-3 block text-xs text-muted-foreground">{dateFormatter.format(date)} · {timeFormatter.format(date)}</time>}
                  </article>
                );
              })}
              {error && <p className="px-4 py-3 text-center text-sm text-destructive">{error}</p>}
              <div ref={sentinelRef} className="h-1" aria-hidden="true" />
              {loadingMore && <div className="flex justify-center py-4" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="sr-only">Loading more deliveries</span></div>}
            </div>
          )}
        </section>
      </main>
      {selected && createPortal((() => {
            const fmt = (v?: string | null) => v ? `${dateFormatter.format(new Date(v))} · ${timeFormatter.format(new Date(v))}` : "—";
            const failed = selected.status !== "delivered";
            const CopyBlock = ({ label, text }: { label: string; text: string }) => (
              <div className="rounded-md bg-muted">
                <div className="flex justify-end px-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Copy ${label}`} onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs">{text}</pre>
              </div>
            );
            return (
              <div role="dialog" aria-modal="true" aria-label="Workbook Log Details" className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
                <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:px-4">
                  <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => setSelected(null)} aria-label="Back to workbook logs">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0 flex-1 leading-tight">
                    <h2 className="truncate text-lg font-semibold">Workbook Log Details</h2>
                    <p className="truncate text-xs text-muted-foreground">{selected.event}</p>
                  </div>
                  <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold ${failed ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {failed ? "Failed" : "Delivered"}
                  </span>
                </header>
                <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-4 mt-3 grid grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                  <dl className="divide-y divide-border">
                    {([
                      ["id", selected.id],
                      ["timestamp", fmt(selected.created_at)],
                      ["event", selected.event],
                      ["status", selected.status],
                      ["response_status", selected.response_status != null ? String(selected.response_status) : "—"],
                      ["level", failed ? "error" : "info"],
                      ["delivered_at", fmt(selected.delivered_at)],
                      ["endpoint", selected.webhook_endpoints?.url ?? "—"],
                      ["description", selected.webhook_endpoints?.description ?? "—"],
                      ["webhook_id", selected.webhook_id ?? "—"],
                      ["error", selected.error_message ?? "—"],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex gap-3 py-3 text-sm">
                        <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                        <dd className={`min-w-0 flex-1 break-all font-mono text-xs ${k === "error" && selected.error_message ? "text-destructive" : "text-foreground"}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {selected.payload != null && (
                    <div className="mt-2">
                      <p className="mb-2 text-sm text-muted-foreground">payload</p>
                      <CopyBlock label="payload" text={JSON.stringify(selected.payload, null, 2)} />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="raw" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                  <CopyBlock label="raw log" text={JSON.stringify(selected, null, 2)} />
                </TabsContent>
                </Tabs>
              </div>
            );
          })(), document.body)}
    </div>
  );
}