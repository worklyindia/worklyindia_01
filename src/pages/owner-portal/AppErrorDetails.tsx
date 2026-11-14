import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type ErrorRow = { id: string; app_version: string | null; android_version: string | null; device_model: string | null; component: string | null; severity: string | null; error_type: string | null; message: string | null; stack_trace: string | null; context: Record<string, unknown> | null; created_at: string };

export default function AppErrorDetails() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: role, error: roleError } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
      if (roleError || role?.role !== "owner") throw new Error("Owner access required");
      const { data, error } = await supabase.from("app_error_reports").select("id,app_version,android_version,device_model,component,severity,error_type,message,stack_trace,context,created_at").order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      setRows((data || []) as ErrorRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load app errors");
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  const filtered = rows.filter((r) => [r.message, r.error_type, r.component, r.device_model, r.app_version].some((v) => (v || "").toLowerCase().includes(search.toLowerCase())));
  const counts = { total: rows.length, critical: rows.filter(r => /critical|fatal/i.test(r.severity || "")).length, today: rows.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()).length };

  return <main className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
    <header className="sticky top-0 z-20 flex min-h-14 w-full items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur">
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/owner-portal")} aria-label="Back to Owner Portal"><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">App Error Details</h1>
      <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh errors"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
    </header>
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-5">
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Recent errors</p><p className="text-2xl font-bold tabular-nums">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Critical</p><p className="text-2xl font-bold tabular-nums">{counts.critical}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Today</p><p className="text-2xl font-bold tabular-nums">{counts.today}</p></CardContent></Card>
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search error, component, device or version…" className="pl-9" /></div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading app errors…</p> : filtered.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No app error reports found.</CardContent></Card> : <div className="space-y-3">
        {filtered.map(row => <Card key={row.id} className="w-full min-w-0"><CardContent className="space-y-2 p-3 sm:p-4">
          <div className="flex min-w-0 items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{row.message || row.error_type || "App error"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{row.component || "Unknown component"} · {new Date(row.created_at).toLocaleString()}</p></div><Badge variant="outline" className="shrink-0">{row.severity || "error"}</Badge></div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Smartphone className="h-3 w-3" />{row.device_model || "Device unknown"}</span><span>Android {row.android_version || "—"}</span><span>App {row.app_version || "—"}</span></div>
          <Button variant="ghost" size="sm" className="px-0" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? "Hide details" : "View details"}</Button>
          {expanded === row.id && <div className="max-w-full space-y-2 overflow-hidden rounded-lg bg-muted/50 p-3"><p className="break-words text-xs font-semibold">Error type: {row.error_type || "—"}</p>{row.stack_trace && <pre className="max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all text-[11px]">{row.stack_trace}</pre>}<pre className="max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(row.context || {}, null, 2)}</pre></div>}
        </CardContent></Card>)}
      </div>}
    </div>
  </main>;
}
