import { useCallback, useEffect, useRef, useState } from "react";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Clock3, Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type ApiLog = {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  error_message: string | null;
  created_at: string;
  api_key_id?: string | null;
  request_params?: any;
  response_size_bytes?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

type Period = "today" | "7days" | "30days";
const periods: { id: Period; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 0 },
  { id: "7days", label: "7 Day", days: 6 },
  { id: "30days", label: "30 Day", days: 29 },
];
const pageSize = 30;

function periodStart(period: Period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (periods.find((item) => item.id === period)?.days ?? 0));
  return start.toISOString();
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

export default function DeveloperApiLogs() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("today");
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [selected, setSelected] = useState<ApiLog | null>(null);
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);

  const loadQuota = useCallback(async () => {
    const { data } = await (supabase.rpc as any)("get_my_api_quota");
    if (data) setQuota(data);
  }, []);

  useEffect(() => { loadQuota(); }, [loadQuota]);
  const scrollRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = useCallback(async (selected: Period, offset: number) => {
    return supabase
      .from("api_request_logs")
      .select("id,endpoint,method,status_code,response_time_ms,error_message,created_at,api_key_id,request_params,response_size_bytes,ip_address,user_agent", { count: "exact" })
      .gte("created_at", periodStart(selected))
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setLogs([]);
    setTotal(0);
    fetchLogs(period, 0).then(({ data, count, error: queryError }) => {
      if (!current) return;
      setLoading(false);
      if (queryError) {
        setError("Couldn't load API logs. Please try again.");
        return;
      }
      setLogs(data ?? []);
      setTotal(count ?? 0);
    });
    return () => { current = false; };
  }, [period, refreshKey, fetchLogs]);


  const loadMore = async () => {
    if (loadingMore || loading || logs.length >= total) return;
    setLoadingMore(true);
    const { data, error: queryError } = await fetchLogs(period, logs.length);
    setLoadingMore(false);
    if (queryError) {
      setError("Couldn't load more API logs. Please try again.");
      return;
    }
    setError("");
    setLogs((current) => [...current, ...(data ?? [])]);
  };

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || logs.length >= total) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
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

  const statusBadgeClass = (status: number) => {
    if (status >= 500) return "bg-destructive/10 text-destructive";
    if (status >= 400) return "bg-warning/10 text-warning";
    if (status >= 300) return "bg-primary/10 text-primary";
    return "bg-success/10 text-success";
  };

  const downloadPdf = async () => {
    if (downloading || loading) return;
    setDownloading(true);
    // Capture a single period so a tab change during export cannot mix periods.
    const selected = period;
    const start = new Date(periodStart(selected));
    const end = new Date();
    const allLogs: ApiLog[] = [];
    const batchSize = 500;
    try {
      for (let offset = 0; ; offset += batchSize) {
        const { data, error: queryError } = await supabase
          .from("api_request_logs")
          .select("id,endpoint,method,status_code,response_time_ms,error_message,created_at")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (queryError) throw queryError;
        allLogs.push(...(data ?? []));
        if (!data || data.length < batchSize) break;
      }
      const { downloadApiLogsPdf } = await import("@/lib/apiLogsPdf");
      downloadApiLogsPdf(allLogs, periods.find((item) => item.id === selected)?.label ?? "Today", start, end);
      toast.success("API Logs PDF downloaded");
    } catch (downloadError) {
      console.error("API Logs PDF download failed", downloadError);
      toast.error("Couldn't download API logs. Please try again.");
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
          <h1 className="flex-1 text-lg font-semibold">API Logs</h1>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Download ${periods.find((item) => item.id === period)?.label} API logs PDF`} title="Download PDF" disabled={downloading || loading} onClick={downloadPdf}>
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh API logs" onClick={() => { setRefreshKey((key) => key + 1); loadQuota(); }}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </header>
        <nav className="grid grid-cols-3 border-b border-border" aria-label="API log period">
          {periods.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              aria-current={period === item.id ? "true" : undefined}
              onClick={() => setPeriod(item.id)}
              className={`h-12 w-full rounded-none border-b-2 text-sm font-semibold ${period === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <section ref={scrollRef} aria-label="API request history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
        {quota && (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs sm:mx-6">
            <span className="inline-flex items-center gap-1.5 font-medium">Usage</span>
            <span className="text-muted-foreground"><b className="text-foreground">{quota.used.toLocaleString("en-IN")}</b> used · <b className="text-foreground">{quota.remaining.toLocaleString("en-IN")}</b> calls left</span>
          </div>
        )}
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">{loading ? "Loading requests…" : `${total.toLocaleString("en-IN")} ${total === 1 ? "request" : "requests"}`}</p>
          {!loading && total > 0 && <Activity className="h-4 w-4 text-primary" aria-hidden="true" />}
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading API logs</span></div>
        ) : error && logs.length === 0 ? (
          <div className="px-4 py-14 text-center sm:px-6"><p className="text-sm text-destructive">{error}</p><Button variant="outline" className="mt-4" onClick={() => setRefreshKey((key) => key + 1)}>Try again</Button></div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-16 text-center sm:px-6"><Activity className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><p className="font-medium">No API requests in this period</p></div>
        ) : (
          <div className="border-t border-border">
            {logs.map((log) => {
              const date = new Date(log.created_at);
              return (
                <article key={log.id} role="button" tabIndex={0} onClick={() => setSelected(log)} onKeyDown={(e) => { if (e.key === "Enter") setSelected(log); }} className="cursor-pointer border-b border-border px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">{log.method}</span>
                        <p className="min-w-0 break-all text-sm font-semibold leading-5 text-foreground">{log.endpoint}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(log.status_code)}`}>
                      {log.status_code}
                    </span>
                  </div>
                  {log.error_message && <p className="mt-2 break-words text-xs text-destructive">{log.error_message}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={log.created_at}>{dateFormatter.format(date)} · {timeFormatter.format(date)}</time>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{log.response_time_ms.toLocaleString("en-IN")} ms</span>
                  </div>
                </article>
              );
            })}
            {error && <p className="px-4 py-3 text-center text-sm text-destructive">{error}</p>}
            <div ref={sentinelRef} className="h-1" aria-hidden="true" />
            {loadingMore && <div className="flex justify-center py-4" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="sr-only">Loading more requests</span></div>}
          </div>
        )}
        </section>
      </main>
      {selected && createPortal(
        <div role="dialog" aria-modal="true" aria-label="API Log Details" className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:px-4">
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => setSelected(null)} aria-label="Back to API logs">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 leading-tight">
              <h2 className="truncate text-lg font-semibold">API Log Details</h2>
              <p className="truncate text-xs text-muted-foreground">{selected.endpoint}</p>
            </div>
            <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(selected.status_code)}`}>{selected.status_code}</span>
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
                    ["timestamp", `${dateFormatter.format(new Date(selected.created_at))} · ${timeFormatter.format(new Date(selected.created_at))}`],
                    ["service", selected.request_params?.service ?? selected.endpoint.split(":")[0]],
                    ["action", selected.request_params?.action ?? selected.endpoint.split(":").slice(1).join(":")],
                    ["method", selected.method],
                    ["status", String(selected.status_code)],
                    ["level", selected.status_code >= 500 ? "error" : selected.status_code >= 400 ? "warning" : "info"],
                    ["response_time", `${selected.response_time_ms} ms`],
                    ["response_size", selected.response_size_bytes != null ? `${selected.response_size_bytes} bytes` : "—"],
                    ["path", selected.request_params?.path ?? "—"],
                    ["api_key_id", selected.api_key_id ?? "—"],
                    ["ip_address", selected.ip_address ?? "—"],
                    ["user_agent", selected.user_agent ?? "—"],
                    ["error", selected.error_message ?? "—"],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-3 text-sm">
                      <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className={`min-w-0 flex-1 break-all font-mono text-xs ${k === "error" && selected.error_message ? "text-destructive" : "text-foreground"}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {(selected.request_params?.body || selected.request_params?.query) && (() => {
                  const requestText = JSON.stringify({ query: selected.request_params?.query, body: selected.request_params?.body }, null, 2);
                  return (
                    <div className="mt-2">
                      <p className="mb-2 text-sm text-muted-foreground">request</p>
                      <div className="rounded-md bg-muted">
                        <div className="flex justify-end px-1 pt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                            aria-label="Copy request"
                            onClick={() => { navigator.clipboard.writeText(requestText); toast.success("Copied"); }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs">{requestText}</pre>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>
              <TabsContent value="raw" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                {(() => {
                  const rawText = JSON.stringify(selected, null, 2);
                  return (
                    <div className="rounded-md bg-muted">
                      <div className="flex justify-end px-1 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Copy raw log"
                          onClick={() => { navigator.clipboard.writeText(rawText); toast.success("Copied"); }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 font-mono text-xs">{rawText}</pre>
                    </div>
                  );
                })()}
              </TabsContent>
          </Tabs>
        </div>,
        document.body
      )}
    </div>
  );
}