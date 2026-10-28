import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Run {
  id: string; status: string; run_type: string; trigger_source: string;
  started_at: string; finished_at: string | null; duration_ms: number | null;
  users_targeted: number; messages_sent: number; messages_failed: number;
  errors_auto_fixed: number; markdown_report: string | null; error_message: string | null;
}
interface Health {
  id: string; error_signature: string; error_category: string; source: string | null;
  occurrence_count: number; fix_strategy: string | null; resolved: boolean; last_seen_at: string;
}
interface ChannelLimits {
  push_per_user_24h: number;
  telegram_per_user_24h: number;
  email_per_user_7d: number;
  email_global_24h: number;
  enabled: boolean;
}
interface SkipBucket {
  channel: string;
  reason: string;
  count: number;
}

export default function AutonomousAgent() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Run | null>(null);
  const [limits, setLimits] = useState<ChannelLimits | null>(null);
  const [skips, setSkips] = useState<SkipBucket[]>([]);

  const load = async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [r, h, s, l, sk] = await Promise.all([
      supabase.functions.invoke("unified-ai-tricks", { body: { action: "agent_get_runs", limit: 30 } }),
      supabase.functions.invoke("unified-ai-tricks", { body: { action: "agent_get_health" } }),
      supabase.functions.invoke("unified-ai-tricks", { body: { action: "agent_status" } }),
      supabase.from("engagement_channel_limits").select("push_per_user_24h, telegram_per_user_24h, email_per_user_7d, email_global_24h, enabled").eq("id", 1).maybeSingle(),
      supabase.from("engagement_skip_log").select("channel, reason").gte("created_at", since).limit(5000),
    ]);
    if (r.data?.runs) setRuns(r.data.runs);
    if (h.data?.health) setHealth(h.data.health);
    if (s.data) setPaused(!!s.data.paused);
    if (l.data) setLimits(l.data as ChannelLimits);
    if (sk.data) {
      const map = new Map<string, SkipBucket>();
      for (const row of sk.data as { channel: string; reason: string }[]) {
        const key = `${row.channel}|${row.reason}`;
        const existing = map.get(key);
        if (existing) existing.count++;
        else map.set(key, { channel: row.channel, reason: row.reason, count: 1 });
      }
      setSkips(Array.from(map.values()).sort((a, b) => b.count - a.count));
    }
  };

  // Egress optimization: 30s → 5min polling cuts ~270 requests/day per open tab
  useEffect(() => { load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, []);

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("unified-ai-tricks", {
      body: { action: "agent_run", trigger_source: "manual_ui" },
    });
    setRunning(false);
    if (error) toast.error(error.message);
    else toast.success(`Run complete: sent=${data?.messages_sent ?? 0}, fixed=${data?.errors_auto_fixed ?? 0}`);
    load();
  };

  const togglePause = async () => {
    const { data } = await supabase.functions.invoke("unified-ai-tricks", {
      body: { action: paused ? "agent_resume" : "agent_pause" },
    });
    setPaused(!!data?.paused);
    toast.success(paused ? "Agent resumed" : "Agent paused");
  };

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">🤖 Autonomous Growth Agent</h1>
          <p className="text-muted-foreground">Self-running AI: senses → diagnoses → plans → executes → heals every hour.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={paused ? "destructive" : "default"}>{paused ? "PAUSED" : "ACTIVE"}</Badge>
          <Button variant="outline" onClick={togglePause}>{paused ? "Resume" : "Pause"}</Button>
          <Button onClick={runNow} disabled={running}>{running ? "Running…" : "Run Now"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Per-User Targets {limits?.enabled === false && <Badge variant="destructive" className="ml-2">DISABLED</Badge>}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Push</div>
                <div className="text-2xl font-bold mt-1">{limits?.push_per_user_24h ?? "–"} <span className="text-sm font-normal text-muted-foreground">/ day</span></div>
                <div className="text-xs text-muted-foreground mt-1">Dual-role: {(limits?.push_per_user_24h ?? 0) * 2} / day</div>
              </div>
              <div className="p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Telegram</div>
                <div className="text-2xl font-bold mt-1">{limits?.telegram_per_user_24h ?? "–"} <span className="text-sm font-normal text-muted-foreground">/ day</span></div>
                <div className="text-xs text-muted-foreground mt-1">Dual-role: {(limits?.telegram_per_user_24h ?? 0) * 2} / day</div>
              </div>
              <div className="p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Email</div>
                <div className="text-2xl font-bold mt-1">{limits?.email_per_user_7d ?? "–"} <span className="text-sm font-normal text-muted-foreground">/ 7 days</span></div>
                <div className="text-xs text-muted-foreground mt-1">Dual-role: {(limits?.email_per_user_7d ?? 0) * 2} / 7 days</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-4 space-y-1">
              <p>• Push & Telegram reset at <strong>12:00 AM IST</strong>. Yesterday's pending rows are auto-cancelled.</p>
              <p>• Email is a <strong>rolling 7-day window</strong>. Once the quota is hit, no more emails until the oldest send ages out.</p>
              <p>• If a channel is not connected (no push token / no Telegram chat / no email), <strong>only that channel</strong> is skipped for the user — the other channels still run at full target.</p>
              <p>• Dual-role accounts (seeker + employer) automatically get <strong>2× targets</strong>, split 50/50 between the two roles.</p>
              <p>• Global email cap: <strong>{limits?.email_global_24h ?? "–"} / 24h</strong> across all users.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Skip Reasons (last 24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {skips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skips logged in the last 24h.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["push", "telegram", "email"] as const).map((ch) => {
                  const rows = skips.filter((s) => s.channel === ch);
                  const total = rows.reduce((a, b) => a + b.count, 0);
                  return (
                    <div key={ch} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{ch}</div>
                        <Badge variant="secondary">{total}</Badge>
                      </div>
                      {rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No skips</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {rows.map((r) => (
                            <li key={r.reason} className="flex justify-between gap-2">
                              <span className="font-mono truncate">{r.reason}</span>
                              <span className="text-muted-foreground shrink-0">{r.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Confirms each channel skips independently — e.g. <code>push_not_subscribed</code> means push was skipped for that user, but telegram/email continued.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Runs ({runs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {runs.map((r) => (
              <div key={r.id} onClick={() => setSelected(r)}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition ${selected?.id === r.id ? "bg-accent" : ""}`}>
                <div className="flex justify-between items-center">
                  <Badge variant={r.status === "success" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, year: "numeric", month: "long", day: "2-digit", hour: "numeric", minute: "2-digit" })} IST</span>
                </div>
                <div className="text-sm mt-2 grid grid-cols-4 gap-2">
                  <span>👥 {r.users_targeted}</span>
                  <span>📤 {r.messages_sent}</span>
                  <span>❌ {r.messages_failed}</span>
                  <span>🔧 {r.errors_auto_fixed}</span>
                </div>
              </div>
            ))}
            {runs.length === 0 && <p className="text-muted-foreground text-sm">No runs yet. Click "Run Now".</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{selected ? "Run Report" : "Health Issues"}</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {selected ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{selected.markdown_report || selected.error_message || "_no report_"}</ReactMarkdown>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Back to health</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {health.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between items-center">
                      <Badge variant={h.resolved ? "default" : "destructive"}>{h.error_category}</Badge>
                      <span className="text-xs">×{h.occurrence_count}</span>
                    </div>
                    <p className="text-xs mt-1 font-mono break-all">{h.error_signature}</p>
                    <p className="text-xs text-muted-foreground mt-1">Strategy: {h.fix_strategy} · {h.source}</p>
                  </div>
                ))}
                {health.length === 0 && <p className="text-muted-foreground text-sm">No errors detected. ✨</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
