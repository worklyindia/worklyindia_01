import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface AgentRun {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  users_targeted: number;
  messages_sent: number;
  messages_failed: number;
  errors_auto_fixed: number;
  trigger_source: string | null;
  error_message: string | null;
}

const fmtRel = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const fmtAbs = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function LastRunSummaryCard() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("ai_agent_runs")
          .select("id, status, started_at, finished_at, duration_ms, users_targeted, messages_sent, messages_failed, errors_auto_fixed, trigger_source, error_message")
          .order("started_at", { ascending: false })
          .limit(5);
        if (error) throw error;
        if (!cancelled) setRuns((data || []) as AgentRun[]);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60_000); // refresh every minute
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading run history…
        </CardContent>
      </Card>
    );
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" /> Agent has not run yet.
        </CardContent>
      </Card>
    );
  }

  const last = runs[0];
  const statusIcon = last.status === "completed" || last.status === "success"
    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
    : last.status === "failed" || last.status === "error"
    ? <XCircle className="h-4 w-4 text-destructive" />
    : last.status === "running"
    ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    : <AlertCircle className="h-4 w-4 text-orange-500" />;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium">Last run: {fmtRel(last.started_at)}</span>
          <Badge variant="outline" className="text-[10px]">{last.status}</Badge>
          {last.trigger_source && <Badge variant="secondary" className="text-[10px]">{last.trigger_source}</Badge>}
          <span className="text-xs text-muted-foreground">{fmtAbs(last.started_at)}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span><strong>{last.users_targeted}</strong> targeted</span>
          <span className="text-green-600">✓ <strong>{last.messages_sent}</strong> sent</span>
          {last.messages_failed > 0 && <span className="text-destructive">✗ <strong>{last.messages_failed}</strong> failed</span>}
          {last.errors_auto_fixed > 0 && <span className="text-blue-600">🔧 <strong>{last.errors_auto_fixed}</strong> auto-fixed</span>}
          {last.duration_ms != null && <span className="text-muted-foreground">⏱ {(last.duration_ms / 1000).toFixed(1)}s</span>}
        </div>
        {last.error_message && (
          <p className="text-xs text-destructive break-words">⚠ {last.error_message}</p>
        )}
        {runs.length > 1 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Previous {runs.length - 1} runs</summary>
            <div className="mt-2 space-y-1">
              {runs.slice(1).map((r) => (
                <div key={r.id} className="flex flex-wrap gap-2 items-center">
                  <span>{fmtRel(r.started_at)}</span>
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  <span>{r.messages_sent}/{r.users_targeted} sent</span>
                  {r.duration_ms != null && <span>· {(r.duration_ms / 1000).toFixed(1)}s</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
