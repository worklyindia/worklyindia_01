import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, Bell, Send, Mail, RefreshCcw, AlertTriangle,
  CheckCircle2, TrendingUp, Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChannelStats {
  channel: "push" | "telegram" | "email";
  baseTarget: number;
  windowLabel: string;
  activeUsers: number;
  eligibleUsers: number;
  ineligibleUsers: number;
  dualRoleUsers: number;
  usersWithAny: number;
  usersAtTarget: number;
  usersDelivered: number;
  usersQueued: number;
  usersUnder: number;
  usersOver: number;
  avgPerUser: number;
  totalQueued: number;
  totalDelivered: number;
}

interface Limits {
  push: number;
  telegram: number;
  email: number;
  enabled: boolean;
  updated_at: string;
}

interface TopUpResult {
  ok?: boolean;
  users_scanned?: number;
  rows_inserted?: number;
  dispatched?: number;
  sent?: number;
  failed?: number;
  requeued?: number;
  skipped?: number;
  pending_ready?: number;
  pending_total?: number;
  per_channel?: Partial<Record<"push" | "telegram" | "email", number>>;
  dispatch?: TopUpResult;
  error?: string;
}

const CHANNEL_META = {
  push: { label: "Push", icon: Bell, color: "text-blue-500" },
  telegram: { label: "Telegram", icon: Send, color: "text-cyan-500" },
  email: { label: "Email", icon: Mail, color: "text-emerald-500" },
} as const;

const startOfTodayIstIso = () => {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDay = new Date(istMs);
  istDay.setUTCHours(0, 0, 0, 0);
  return new Date(istDay.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
};

const getCompactWindowLabel = (windowLabel: string) =>
  windowLabel === "last 24h" ? "24h" : windowLabel === "last 7 days" ? "7d" : windowLabel;

const getBadgeTitle = (stat: ChannelStats) => {
  const parts = [`target ${stat.baseTarget}`, getCompactWindowLabel(stat.windowLabel)];
  if (stat.dualRoleUsers > 0) parts.splice(1, 0, "dual-role ×2");
  return parts.join(" • ");
};

export default function TargetDeliveryPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [topUpRunning, setTopUpRunning] = useState(false);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [stats, setStats] = useState<ChannelStats[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Limits
      const { data: lim } = await supabase
        .from("engagement_channel_limits")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      const L: Limits = {
        push: Number(lim?.push_per_user_24h ?? 5),
        telegram: Number(lim?.telegram_per_user_24h ?? 5),
        email: Number(lim?.email_per_user_7d ?? 2),
        enabled: lim?.enabled !== false,
        updated_at: lim?.updated_at || new Date().toISOString(),
      };
      setLimits(L);

      // 2. Active users (last 30d login) — fetch IDs so we can intersect
      //    properly with recipients (the count-only approach made the
      //    "X of Y at target" denominator drift, e.g. 84 of 19 = 442%).
      const cutoff30 = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const activeIds = new Set<string>();
      {
        const PAGE = 1000;
        let from = 0;
        while (from < 50000) {
          const { data: page, error } = await supabase
            .from("profiles")
            .select("user_id")
            .gte("last_login_at", cutoff30)
            .range(from, from + PAGE - 1);
          if (error) break;
          const rows = (page as Array<{ user_id: string }> | null) || [];
          for (const r of rows) if (r.user_id) activeIds.add(r.user_id);
          if (rows.length < PAGE) break;
          from += PAGE;
        }
      }
      const activeUsers = activeIds.size;

      const dualRoleIds = new Set<string>();
      if (activeUsers > 0) {
        const ids = Array.from(activeIds);
        const PAGE = 1000;
        for (let from = 0; from < ids.length; from += PAGE) {
          const chunk = ids.slice(from, from + PAGE);
          const { data: companies } = await supabase
            .from("companies")
            .select("user_id")
            .in("user_id", chunk);
          for (const company of (companies as Array<{ user_id: string }> | null) || []) {
            if (company.user_id) dualRoleIds.add(company.user_id);
          }
        }
      }

      // 2b. Per-channel eligibility (push token / telegram chat id / email present).
      // Without this the denominator counts unreachable users and the
      // dashboard shows "0 of 19 / 19 under" even when the agent correctly
      // skipped them.
      const pushEligible = new Set<string>();
      const telegramEligible = new Set<string>();
      const emailEligible = new Set<string>();
      if (activeUsers > 0) {
        const ids = Array.from(activeIds);
        const PAGE = 1000;
        for (let from = 0; from < ids.length; from += PAGE) {
          const chunk = ids.slice(from, from + PAGE);
          const [{ data: tokens }, { data: profs }] = await Promise.all([
            supabase
              .from("user_notification_tokens")
              .select("user_id")
              .eq("is_active", true)
              .in("user_id", chunk),
            supabase
              .from("profiles")
              .select("user_id, email, telegram_chat_id, telegram_notifications_enabled")
              .in("user_id", chunk),
          ]);
          for (const t of (tokens as Array<{ user_id: string }> | null) || []) {
            if (t.user_id) pushEligible.add(t.user_id);
          }
          for (const p of (profs as Array<{ user_id: string; email: string | null; telegram_chat_id: unknown; telegram_notifications_enabled: boolean | null }> | null) || []) {
            if (!p.user_id) continue;
            if (p.email) emailEligible.add(p.user_id);
            if (p.telegram_chat_id != null && p.telegram_notifications_enabled !== false) telegramEligible.add(p.user_id);
          }
        }
      }
      const eligibilityByChannel: Record<"push" | "telegram" | "email", Set<string>> = {
        push: pushEligible,
        telegram: telegramEligible,
        email: emailEligible,
      };

      // 3. Per-channel aggregates
      const channels: Array<{
        ch: "push" | "telegram" | "email";
        target: number;
        sinceIso: string;
        windowLabel: string;
      }> = [
        {
          ch: "push",
          target: L.push,
          sinceIso: startOfTodayIstIso(),
          windowLabel: "today",
        },
        {
          ch: "telegram",
          target: L.telegram,
          sinceIso: startOfTodayIstIso(),
          windowLabel: "today",
        },
        {
          ch: "email",
          target: L.email,
          sinceIso: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString(),
          windowLabel: "last 7 days",
        },
      ];

      const out: ChannelStats[] = [];
      for (const c of channels) {
        // Pull user_id list of all sent rows in window — paginate so big
        // windows (email 7d) aren't silently capped at 1000.
        const counts: Record<string, number> = {};
        const PAGE = 1000;
        let from = 0;
        while (from < 50000) {
          const { data: rows, error } = await supabase
            .from("ai_proactive_send_log")
            .select("user_id")
            .eq("channel", c.ch)
            .eq("status", "sent")
            .gte("sent_at", c.sinceIso)
            .range(from, from + PAGE - 1);
          if (error) {
            console.warn("[target-panel] fetch failed", c.ch, error);
            break;
          }
          const rs = (rows as Array<{ user_id: string }> | null) || [];
          for (const r of rs) {
            const uid = r.user_id;
            if (!uid) continue;
            counts[uid] = (counts[uid] || 0) + 1;
          }
          if (rs.length < PAGE) break;
          from += PAGE;
        }
        // Also pull pending/processing rows from the schedule queue so the
        // dashboard counts queued slots toward target — otherwise pressing
        // "Run top-up" never visibly clears the "under target" state.
        const pendingCounts: Record<string, number> = {};
        {
          let pf = 0;
          while (pf < 50000) {
            const { data: rows, error } = await supabase
              .from("proactive_engagement_schedule")
              .select("user_id")
              .eq("channel", c.ch)
              .in("status", ["pending", "processing"])
              .gte("scheduled_at", c.sinceIso)
              .range(pf, pf + PAGE - 1);
            if (error) {
              console.warn("[target-panel] pending fetch failed", c.ch, error);
              break;
            }
            const rs = (rows as Array<{ user_id: string }> | null) || [];
            for (const r of rs) {
              const uid = r.user_id;
              if (!uid) continue;
              pendingCounts[uid] = (pendingCounts[uid] || 0) + 1;
            }
            if (rs.length < PAGE) break;
            pf += PAGE;
          }
        }
        // Restrict on-target / over / under math to ELIGIBLE users (those
        // who CAN receive the channel). Active-but-unreachable users are
        // excluded from the denominator so the ratio reflects what the
        // agent can actually deliver.
        const eligibleSet = eligibilityByChannel[c.ch];
        let usersWithAny = 0;
        let usersAtTarget = 0;
        let usersDelivered = 0;
        let usersQueued = 0;
        let usersOver = 0;
        let sumActive = 0;
        let totalQueued = 0;
        let totalDelivered = 0;
        for (const uid of eligibleSet) {
          const sent = counts[uid] || 0;
          const queued = pendingCounts[uid] || 0;
          const total = sent + queued;
          const effectiveTarget = c.target * (dualRoleIds.has(uid) ? 2 : 1);
          totalDelivered += sent;
          totalQueued += queued;
          if (sent > 0) usersWithAny++;
          sumActive += sent;
          if (sent >= effectiveTarget) usersDelivered++;
          if (total >= effectiveTarget) usersAtTarget++;
          if (queued > 0 && sent < effectiveTarget) usersQueued++;
          // "over" only fires on actually-delivered overage, never on queued
          if (sent > effectiveTarget) usersOver++;
        }
        const eligibleCount = eligibleSet.size;
        const usersUnder = Math.max(0, eligibleCount - usersAtTarget);
        const avg = usersWithAny > 0 ? sumActive / usersWithAny : 0;
        out.push({
          channel: c.ch,
          baseTarget: c.target,
          windowLabel: c.windowLabel,
          activeUsers,
          eligibleUsers: eligibleCount,
          ineligibleUsers: Math.max(0, activeUsers - eligibleCount),
          dualRoleUsers: dualRoleIds.size,
          usersWithAny,
          usersAtTarget,
          usersDelivered,
          usersQueued,
          usersUnder,
          usersOver,
          avgPerUser: Number(avg.toFixed(2)),
          totalQueued,
          totalDelivered,
        });
      }
      setStats(out);
    } catch (e: any) {
      toast({
        title: "Failed to load delivery stats",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runTopUp = async () => {
    setTopUpRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke<TopUpResult>(
        "ai-proactive-engagement",
        { body: { mode: "top_up", immediate_first_slot: true } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dispatchData = data?.dispatch ?? null;

      toast({
        title: "Top-up complete",
        description: dispatchData
          ? `Scanned ${data?.users_scanned ?? 0}, queued ${data?.rows_inserted ?? 0}, dispatched ${dispatchData.sent ?? 0}.`
          : `Scanned ${data?.users_scanned ?? 0}, no new slots were needed.`,
      });
      await load();
      // Re-load again ~6s later so any rows the dispatcher just sent show
      // up without the user having to click Refresh manually.
      window.setTimeout(() => { load(); }, 6000);
    } catch (e: any) {
      toast({
        title: "Top-up failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setTopUpRunning(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Target className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Target Delivery — per-user quota</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Verifies the AI agent is sending exactly the configured target to
            every active user (logged in within 30 days).
          </p>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={runTopUp}
            disabled={topUpRunning || loading}
            className="flex-1 sm:flex-none"
          >
            {topUpRunning
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <TrendingUp className="h-4 w-4 mr-1" />}
            Run top-up
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 break-words">
            <strong>Active limits</strong> ({limits.enabled ? "enabled" : "DISABLED"}, 
            updated {new Date(limits.updated_at).toLocaleString()}):
            push <Badge variant="outline">{limits.push}/24h</Badge>{" "}
            telegram <Badge variant="outline">{limits.telegram}/24h</Badge>{" "}
            email <Badge variant="outline">{limits.email}/7d</Badge>
          </div>
        )}

        {loading
          ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )
          : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.map((s) => {
                const meta = CHANNEL_META[s.channel];
                const Icon = meta.icon;
                const pctAtTarget = s.eligibleUsers > 0
                  ? Math.round((s.usersAtTarget / s.eligibleUsers) * 100)
                  : 0;
                const pctDelivered = s.eligibleUsers > 0
                  ? Math.round((s.usersDelivered / s.eligibleUsers) * 100)
                  : 0;
                const pctQueued = Math.max(0, pctAtTarget - pctDelivered);
                const noEligible = s.eligibleUsers === 0;
                const overAlarm = s.usersOver > 0;
                const underAlarm = !noEligible && s.usersUnder > 0;
                const queuedOnly = !noEligible && !underAlarm && s.totalQueued > 0 && s.usersDelivered < s.eligibleUsers;
                const cardCls = noEligible
                  ? "border-border bg-muted/20"
                  : overAlarm
                    ? "border-destructive/50 bg-destructive/5"
                    : underAlarm
                      ? "border-amber-500/50 bg-amber-500/5"
                      : queuedOnly
                        ? "border-blue-500/40 bg-blue-500/5"
                        : "border-emerald-500/40 bg-emerald-500/5";
                return (
                  <div
                    key={s.channel}
                    className={`border rounded-lg p-4 space-y-3 ${cardCls}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                        <span className="font-semibold truncate">{meta.label}</span>
                      </div>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-[10px] sm:text-xs whitespace-nowrap self-start sm:self-auto shrink-0 max-w-full">
                              T{s.baseTarget}{s.dualRoleUsers > 0 ? "·2x" : ""}·{getCompactWindowLabel(s.windowLabel)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {getBadgeTitle(s)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {s.usersDelivered} of {s.eligibleUsers} delivered
                          {s.usersQueued > 0 && (
                            <span className="text-blue-600"> +{s.usersQueued} queued</span>
                          )}
                        </span>
                        <span className="font-mono">{pctAtTarget}%</span>
                      </div>
                      {/* Stacked bar: solid = delivered, lighter = queued */}
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary transition-all"
                          style={{ width: `${pctDelivered}%` }}
                        />
                        <div
                          className="absolute inset-y-0 bg-blue-400/60 transition-all"
                          style={{ left: `${pctDelivered}%`, width: `${pctQueued}%` }}
                        />
                      </div>
                      {s.ineligibleUsers > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {s.ineligibleUsers} of {s.activeUsers} active users not reachable on this channel
                          {s.channel === "push" && " (no push token)"}
                          {s.channel === "telegram" && " (no Telegram chat)"}
                          {s.channel === "email" && " (no email)"}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background rounded p-2">
                        <div className="text-muted-foreground">Avg / user</div>
                        <div className="font-mono text-base">{s.avgPerUser}</div>
                      </div>
                      <div className="bg-background rounded p-2">
                        <div className="text-muted-foreground">Reached</div>
                        <div className="font-mono text-base">
                          {s.usersWithAny}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      <Badge
                        variant={s.usersDelivered > 0 ? "default" : "outline"}
                        className="min-w-0 justify-center whitespace-nowrap px-2"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {s.usersDelivered} ok
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`min-w-0 justify-center whitespace-nowrap px-2 ${s.usersQueued > 0 ? "border-blue-500/60 text-blue-600" : ""}`}
                      >
                        {s.usersQueued} queued
                      </Badge>
                      <Badge
                        variant={s.usersUnder > 0 ? "secondary" : "outline"}
                        className="min-w-0 justify-center whitespace-nowrap px-2"
                      >
                        {s.usersUnder} under
                      </Badge>
                      <Badge
                        variant={s.usersOver > 0 ? "destructive" : "outline"}
                        className="min-w-0 justify-center whitespace-nowrap px-2"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {s.usersOver} over
                      </Badge>
                    </div>

                    {overAlarm && (
                      <p className="text-xs text-destructive">
                        ⚠ {s.usersOver} over target. Cap check needed.
                      </p>
                    )}
                    {!overAlarm && noEligible && (
                      <p className="text-xs text-muted-foreground">
                        No reachable users on this channel — nothing to send.
                      </p>
                    )}
                    {!overAlarm && !noEligible && underAlarm && (
                      <p className="text-xs text-amber-600">
                        {s.usersUnder} user{s.usersUnder === 1 ? "" : "s"} under target. Press “Run top-up” to queue the missing slots.
                      </p>
                    )}
                    {!overAlarm && !noEligible && !underAlarm && queuedOnly && (
                      <p className="text-xs text-blue-600">
                        On track — {s.totalQueued} slot{s.totalQueued === 1 ? "" : "s"} queued, dispatcher will deliver.
                      </p>
                    )}
                    {!overAlarm && !noEligible && !underAlarm && !queuedOnly && (
                      <p className="text-xs text-emerald-600">
                        Healthy — every eligible user has hit target.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
