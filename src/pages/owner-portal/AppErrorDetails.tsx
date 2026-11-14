import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Search, AlertTriangle, Smartphone, Clock, Bug } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type AppError = { id:string; installation_id:string; app_version:string; android_version:string; device_model:string; component:string; severity:string; error_type:string; message:string; stack_trace:string; context:Record<string, unknown>; created_at:string };

export default function AppErrorDetails() {
  const navigate = useNavigate();
  const [rows,setRows] = useState<AppError[]>([]);
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState("");
  const [severity,setSeverity] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    const {data,error} = await supabase.from("app_error_reports").select("*").order("created_at",{ascending:false}).limit(500);
    if(error){ toast.error("Unable to load app error reports: "+error.message); setRows([]); }
    else setRows((data || []) as AppError[]);
    setLoading(false);
  },[]);
  useEffect(()=>{ void load(); },[load]);
  const filtered = useMemo(()=>rows.filter(r=>{
    const q=search.toLowerCase();
    const matches=!q || [r.device_model,r.app_version,r.android_version,r.component,r.error_type,r.message,r.installation_id].some(v=>String(v||"").toLowerCase().includes(q));
    return matches && (severity==="all" || r.severity===severity);
  }),[rows,search,severity]);
  const counts = {total:rows.length,fatal:rows.filter(r=>r.severity==="fatal").length,error:rows.filter(r=>r.severity==="error").length,warning:rows.filter(r=>r.severity==="warning").length};
  return <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-3 px-3 py-3 sm:px-6">
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to Owner Portal" onClick={()=>navigate("/owner-portal")}><ArrowLeft className="h-5 w-5"/></Button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold sm:text-2xl">App Error Details</h1><p className="hidden text-xs text-muted-foreground sm:block">Android app crash and error reports</p></div>
        <Button variant="outline" size="icon" className="shrink-0" onClick={()=>void load()} disabled={loading} aria-label="Refresh error reports"><RefreshCw className={loading?"h-4 w-4 animate-spin":"h-4 w-4"}/></Button>
      </div>
    </header>
    <section className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Total Reports",counts.total],["Fatal",counts.fatal],["Errors",counts.error],["Warnings",counts.warning]].map(([label,value])=><Card key={label}><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></CardContent></Card>)}
      </div>
      <Card><CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:p-4">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search device, version, component or error..."/></div>
        <Select value={severity} onValueChange={setSeverity}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Severity"/></SelectTrigger><SelectContent><SelectItem value="all">All Severities</SelectItem><SelectItem value="fatal">Fatal</SelectItem><SelectItem value="error">Error</SelectItem><SelectItem value="warning">Warning</SelectItem></SelectContent></Select>
      </CardContent></Card>
      {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading error reports...</CardContent></Card> : filtered.length===0 ? <Card><CardContent className="p-8 text-center"><Bug className="mx-auto mb-2 h-8 w-8 text-muted-foreground"/><p className="font-medium">No error reports found</p><p className="mt-1 text-sm text-muted-foreground">Reports received from supported app builds will appear here.</p></CardContent></Card> :
      <div className="grid min-w-0 grid-cols-1 gap-3">
        {filtered.map(r=><Card key={r.id} className="min-w-0 overflow-hidden"><CardHeader className="space-y-2 p-3 sm:p-4"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><CardTitle className="min-w-0 break-words text-sm sm:text-base">{r.error_type || "App Error"}</CardTitle><Badge variant={r.severity==="fatal"?"destructive":"secondary"}>{r.severity}</Badge></div><p className="break-words text-sm text-muted-foreground">{r.message || "No error message"}</p></CardHeader><CardContent className="grid min-w-0 grid-cols-1 gap-2 p-3 pt-0 text-xs sm:grid-cols-2 sm:p-4 sm:pt-0">
          <p className="flex min-w-0 items-center gap-2 break-all"><Smartphone className="h-4 w-4 shrink-0"/> {r.device_model} · Android {r.android_version} · App {r.app_version}</p>
          <p className="flex min-w-0 items-center gap-2 break-words"><AlertTriangle className="h-4 w-4 shrink-0"/> {r.component}</p>
          <p className="flex min-w-0 items-center gap-2 break-all"><Clock className="h-4 w-4 shrink-0"/> {format(new Date(r.created_at),"dd MMM yyyy, hh:mm:ss a")}</p>
          <p className="break-all text-muted-foreground">Installation: {r.installation_id}</p>
          {r.stack_trace && <details className="col-span-1 min-w-0 sm:col-span-2"><summary className="cursor-pointer font-medium">View stack trace</summary><pre className="mt-2 max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-[11px]">{r.stack_trace}</pre></details>}
        </CardContent></Card>)}
      </div>}
      <p className="text-xs text-muted-foreground">Reports are retained for up to 30 days. This page shows only reports successfully received by Supabase.</p>
    </section>
  </main>;
}
