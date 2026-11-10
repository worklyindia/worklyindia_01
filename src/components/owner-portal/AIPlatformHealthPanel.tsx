import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCcw, AlertTriangle, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

interface HealthRow {
  id: string;
  error_signature: string;
  error_category: string;
  source: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  fix_strategy: string | null;
  fix_attempts: number;
  fix_successes: number;
  resolved: boolean;
  resolved_at: string | null;
  sample_payload: any;
  notes: string | null;
}

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

const categoryColor = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("auth") || c.includes("credential") || c.includes("token")) return "bg-red-500/10 text-red-700 border-red-500/30";
  if (c.includes("rate") || c.includes("limit") || c.includes("quota")) return "bg-orange-500/10 text-orange-700 border-orange-500/30";
  if (c.includes("network") || c.includes("timeout")) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
  if (c.includes("config") || c.includes("setting")) return "bg-blue-500/10 text-blue-700 border-blue-500/30";
  return "bg-muted text-muted-foreground";
};

export default function AIPlatformHealthPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_agent_health")
        .select("*")
        .order("resolved", { ascending: true })
        .order("error_signature", { ascending: true })
        .limit(200);
      if (error) throw error;
      // Extra client-side A→Z sort by signature within unresolved/resolved buckets
      const sorted = ((data || []) as HealthRow[]).slice().sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return (a.error_signature || "").localeCompare(b.error_signature || "");
      });
      setRows(sorted);
    } catch (e: any) {
      toast({ title: "Failed to load health data", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markResolved = async (id: string) => {
    setActing(id);
    try {
      const { error } = await supabase
        .from("ai_agent_health")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Marked resolved" });
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const reopen = async (id: string) => {
    setActing(id);
    try {
      const { error } = await supabase
        .from("ai_agent_health")
        .update({ resolved: false, resolved_at: null })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Reopened" });
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const visible = rows.filter((r) => showResolved || !r.resolved);
  const unresolved = rows.filter((r) => !r.resolved);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> AI Platform Health
              </CardTitle>
              <CardDescription>
                Errors detected across AI platforms / APIs that the agent uses (OpenAI, Lovable AI Gateway, Telegram, Email, OneSignal, etc.)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowResolved((s) => !s)}>
                {showResolved ? "Hide resolved" : "Show resolved"}
              </Button>
              <Button size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card className="bg-red-500/5">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" /> Open
                </div>
                <div className="text-2xl font-bold text-red-600">{unresolved.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Resolved
                </div>
                <div className="text-2xl font-bold text-green-600">{rows.filter((r) => r.resolved).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Total occurrences
                </div>
                <div className="text-2xl font-bold">{rows.reduce((s, r) => s + r.occurrence_count, 0)}</div>
              </CardContent>
            </Card>
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">No {showResolved ? "errors" : "open issues"} 🎉</p>
              <p className="text-xs">All AI platforms are healthy.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {visible.map((r) => (
                  <Card key={r.id} className={r.resolved ? "opacity-60" : "border-l-4 border-l-destructive"}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {r.source && <Badge variant="secondary">{r.source}</Badge>}
                            <Badge variant="outline" className={categoryColor(r.error_category)}>
                              {r.error_category}
                            </Badge>
                            <Badge variant="outline">×{r.occurrence_count}</Badge>
                            {r.resolved && <Badge variant="default" className="bg-green-600">Resolved</Badge>}
                          </div>
                          <p className="text-sm font-medium break-words">{r.error_signature}</p>
                          {r.fix_strategy && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <strong>Fix:</strong> {r.fix_strategy}
                            </p>
                          )}
                          {r.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{r.notes}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            First: {fmt(r.first_seen_at)} • Last: {fmt(r.last_seen_at)}
                            {r.fix_attempts > 0 && ` • Auto-fix: ${r.fix_successes}/${r.fix_attempts}`}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {r.resolved ? (
                            <Button size="sm" variant="outline" onClick={() => reopen(r.id)} disabled={acting === r.id}>
                              Reopen
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => markResolved(r.id)} disabled={acting === r.id}>
                              {acting === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark fixed"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
