import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Power, PlayCircle, Clock } from "lucide-react";

type SettingsMap = Record<string, any>;

const NUMERIC_KEYS = [
  "per_user_telegram_per_day",
  "per_user_push_per_day",
  "per_user_email_per_7d",
  "rate_telegram_per_second",
  "rate_push_per_second",
  "rate_telegram_per_user_per_second",
  "active_user_days",
  "agent_run_interval_minutes",
  "daily_email_cap",
  "daily_telegram_cap",
  "cooldown_hours",
  "max_touchpoints",
];

const BOOL_KEYS = [
  "enabled",
  "platform_telegram_enabled",
  "platform_push_onesignal_enabled",
  "platform_push_vapid_enabled",
  "platform_email_enabled",
  "email_only_if_no_other_channel",
];

type ChannelLimits = {
  push_per_user_24h: number;
  telegram_per_user_24h: number;
  email_per_user_7d: number;
  email_global_24h: number;
  push_stagger_minutes: number;
  telegram_stagger_minutes: number;
  email_stagger_hours: number;
  jitter_seconds: number;
  enabled: boolean;
};

const DEFAULT_LIMITS: ChannelLimits = {
  push_per_user_24h: 5,
  telegram_per_user_24h: 5,
  email_per_user_7d: 2,
  email_global_24h: 150,
  push_stagger_minutes: 180,
  telegram_stagger_minutes: 180,
  email_stagger_hours: 72,
  jitter_seconds: 90,
  enabled: true,
};

export default function EngagementSettingsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<ChannelLimits>(DEFAULT_LIMITS);
  const [limitsDirty, setLimitsDirty] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("engagement_settings")
        .select("setting_key, setting_value");
      if (error) throw error;
      const map: SettingsMap = {};
      for (const row of (data || []) as { setting_key: string; setting_value: any }[]) {
        map[row.setting_key] = row.setting_value;
      }
      setSettings(map);
      setDirty(new Set());

      // Load AI agent channel limits (separate table, used by ai-proactive-engagement)
      const { data: lim } = await supabase
        .from("engagement_channel_limits")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (lim) {
        setLimits({
          push_per_user_24h: lim.push_per_user_24h ?? DEFAULT_LIMITS.push_per_user_24h,
          telegram_per_user_24h: lim.telegram_per_user_24h ?? DEFAULT_LIMITS.telegram_per_user_24h,
          email_per_user_7d: lim.email_per_user_7d ?? DEFAULT_LIMITS.email_per_user_7d,
          email_global_24h: lim.email_global_24h ?? DEFAULT_LIMITS.email_global_24h,
          push_stagger_minutes: lim.push_stagger_minutes ?? DEFAULT_LIMITS.push_stagger_minutes,
          telegram_stagger_minutes: lim.telegram_stagger_minutes ?? DEFAULT_LIMITS.telegram_stagger_minutes,
          email_stagger_hours: lim.email_stagger_hours ?? DEFAULT_LIMITS.email_stagger_hours,
          jitter_seconds: lim.jitter_seconds ?? DEFAULT_LIMITS.jitter_seconds,
          enabled: lim.enabled !== false,
        });
        setLimitsDirty(false);
      }
    } catch (e: any) {
      toast({ title: "Failed to load settings", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateLimit = <K extends keyof ChannelLimits>(key: K, value: ChannelLimits[K]) => {
    setLimits((prev) => ({ ...prev, [key]: value }));
    setLimitsDirty(true);
  };

  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      const { error } = await supabase
        .from("engagement_channel_limits")
        .update({
          push_per_user_24h: limits.push_per_user_24h,
          telegram_per_user_24h: limits.telegram_per_user_24h,
          email_per_user_7d: limits.email_per_user_7d,
          email_global_24h: limits.email_global_24h,
          push_stagger_minutes: limits.push_stagger_minutes,
          telegram_stagger_minutes: limits.telegram_stagger_minutes,
          email_stagger_hours: limits.email_stagger_hours,
          jitter_seconds: limits.jitter_seconds,
          enabled: limits.enabled,
        })
        .eq("id", 1);
      if (error) throw error;
      setLimitsDirty(false);
      toast({
        title: "AI agent limits saved",
        description: "New limits take effect on the next agent run (within ~1 minute).",
      });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingLimits(false);
    }
  };


  useEffect(() => { load(); }, []);

  const updateLocal = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set(prev).add(key));
  };

  const saveAll = async () => {
    if (dirty.size === 0) {
      toast({ title: "Nothing to save" });
      return;
    }
    setSaving(true);
    try {
      // If interval changed, sync the cron schedule via RPC
      if (dirty.has("agent_run_interval_minutes")) {
        const minutes = Number(settings["agent_run_interval_minutes"]);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
          throw new Error("Interval must be 1–1440 minutes");
        }
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "update_engagement_cron_interval" as any,
          { _minutes: minutes },
        );
        if (rpcErr) throw rpcErr;
        toast({
          title: "Cron schedule updated",
          description: `Agent will now run on schedule: ${(rpcData as any)?.schedule || "updated"}`,
        });
      }

      // Save remaining keys (skip interval since RPC already saved it)
      const keysToSave = Array.from(dirty).filter((k) => k !== "agent_run_interval_minutes");
      for (const key of keysToSave) {
        const { error } = await supabase
          .from("engagement_settings")
          .update({ setting_value: settings[key], updated_at: new Date().toISOString() })
          .eq("setting_key", key);
        if (error) throw error;
      }

      toast({ title: "Settings saved", description: `${dirty.size} setting(s) updated` });
      setDirty(new Set());
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc("trigger_proactive_engagement_now" as any);
      if (error) throw error;
      toast({
        title: "Agent triggered",
        description: `Run started. Check logs in a few seconds. Request: ${(data as any)?.request_id ?? "ok"}`,
      });
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e?.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const masterOn = settings["enabled"] === true;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master controls */}
      <Card className={masterOn ? "border-green-500/50" : "border-destructive/50"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className={masterOn ? "h-5 w-5 text-green-600" : "h-5 w-5 text-destructive"} />
            Master Agent Control
          </CardTitle>
          <CardDescription>
            Turn the entire Proactive Engagement AI agent ON or OFF. When OFF, no messages are sent across any channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base font-medium">AI Agent Status</Label>
              <p className="text-sm text-muted-foreground">
                {masterOn ? "🟢 Active — agent runs on schedule" : "🔴 Stopped — agent will not run"}
              </p>
            </div>
            <Switch
              checked={masterOn}
              onCheckedChange={(v) => updateLocal("enabled", v)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={runNow}
              disabled={!masterOn || running}
              variant="default"
              className="flex-1"
            >
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Run Agent Now
            </Button>
            <Button
              onClick={saveAll}
              disabled={saving || dirty.size === 0}
              variant="outline"
              className="flex-1"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes {dirty.size > 0 && `(${dirty.size})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Run interval */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Agent Run Schedule
          </CardTitle>
          <CardDescription>How often the agent wakes up to send messages. Updates the pg_cron job.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <Label>Run every (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={settings["agent_run_interval_minutes"] ?? 30}
                onChange={(e) => updateLocal("agent_run_interval_minutes", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Allowed: 1–1440 min. (1 = every minute, 60 = hourly, 1440 = daily)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-platform toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Platform Toggles</CardTitle>
          <CardDescription>Stop a single channel without stopping the whole agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "platform_telegram_enabled", label: "Telegram", icon: "✈️" },
            { key: "platform_push_onesignal_enabled", label: "Push (OneSignal)", icon: "🔔" },
            { key: "platform_push_vapid_enabled", label: "Push (Web VAPID)", icon: "🌐" },
            { key: "platform_email_enabled", label: "Email", icon: "📧" },
          ].map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">{icon} {label}</Label>
                <p className="text-xs text-muted-foreground">
                  {settings[key] === true ? "Enabled" : "Stopped — agent will not use this channel"}
                </p>
              </div>
              <Switch
                checked={settings[key] === true}
                onCheckedChange={(v) => updateLocal(key, v)}
              />
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="font-medium">📧 Email only as fallback</Label>
              <p className="text-xs text-muted-foreground">
                Send email only when user has no Telegram/push connected
              </p>
            </div>
            <Switch
              checked={settings["email_only_if_no_other_channel"] === true}
              onCheckedChange={(v) => updateLocal("email_only_if_no_other_channel", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-user limits */}
      <Card>
        <CardHeader>
          <CardTitle>Per-User Limits</CardTitle>
          <CardDescription>Prevent spamming individual users.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Telegram / user / day</Label>
            <Input
              type="number"
              min={1}
              value={settings["per_user_telegram_per_day"] ?? 5}
              onChange={(e) => updateLocal("per_user_telegram_per_day", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Push / user / day</Label>
            <Input
              type="number"
              min={1}
              value={settings["per_user_push_per_day"] ?? 5}
              onChange={(e) => updateLocal("per_user_push_per_day", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Email / user / 7d</Label>
            <Input
              type="number"
              min={1}
              value={settings["per_user_email_per_7d"] ?? 2}
              onChange={(e) => updateLocal("per_user_email_per_7d", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Cooldown (hours, any channel)</Label>
            <Input
              type="number"
              min={1}
              value={settings["cooldown_hours"] ?? 24}
              onChange={(e) => updateLocal("cooldown_hours", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Max touchpoints (no reply)</Label>
            <Input
              type="number"
              min={1}
              value={settings["max_touchpoints"] ?? 3}
              onChange={(e) => updateLocal("max_touchpoints", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Active-user window (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings["active_user_days"] ?? 30}
              onChange={(e) => updateLocal("active_user_days", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Agent Channel Limits + Schedule (new — drives ai-proactive-engagement) */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>🤖 AI Agent — Per-User Quota & Auto-Schedule</CardTitle>
          <CardDescription>
            When the AI agent targets a user it sends 1 message immediately and schedules the
            remaining quota for later — staggered so every user receives their full allowed
            volume without API bursts. Changes apply on the next agent run (~1 min).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="font-medium">Auto-schedule remaining slots</Label>
              <p className="text-xs text-muted-foreground">
                Off = legacy behaviour (drop user when cap hit). On = top up queue so every targeted user gets full quota over time.
              </p>
            </div>
            <Switch
              checked={limits.enabled}
              onCheckedChange={(v) => updateLimit("enabled", v)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>🔔 Push / user / 24h</Label>
              <Input
                type="number" min={0} max={50}
                value={limits.push_per_user_24h}
                onChange={(e) => updateLimit("push_per_user_24h", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>✈️ Telegram / user / 24h</Label>
              <Input
                type="number" min={0} max={50}
                value={limits.telegram_per_user_24h}
                onChange={(e) => updateLimit("telegram_per_user_24h", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>📧 Email / user / 7 days</Label>
              <Input
                type="number" min={0} max={20}
                value={limits.email_per_user_7d}
                onChange={(e) => updateLimit("email_per_user_7d", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>📧 Email / global / 24h</Label>
              <Input
                type="number" min={1}
                value={limits.email_global_24h}
                onChange={(e) => updateLimit("email_global_24h", Number(e.target.value))}
              />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-medium text-muted-foreground">
            ⏱ Stagger between scheduled messages (per user)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Push gap (minutes)</Label>
              <Input
                type="number" min={1}
                value={limits.push_stagger_minutes}
                onChange={(e) => updateLimit("push_stagger_minutes", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Telegram gap (minutes)</Label>
              <Input
                type="number" min={1}
                value={limits.telegram_stagger_minutes}
                onChange={(e) => updateLimit("telegram_stagger_minutes", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Email gap (hours)</Label>
              <Input
                type="number" min={1}
                value={limits.email_stagger_hours}
                onChange={(e) => updateLimit("email_stagger_hours", Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-3">
              <Label>Random jitter (± seconds)</Label>
              <Input
                type="number" min={0} max={3600}
                value={limits.jitter_seconds}
                onChange={(e) => updateLimit("jitter_seconds", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Spreads sends across users so two users never share the exact same scheduled second — prevents API rate-limit errors.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={saveLimits}
              disabled={!limitsDirty || savingLimits}
              size="sm"
            >
              {savingLimits ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save AI Agent Limits
            </Button>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Global Rate Limits</CardTitle>
          <CardDescription>Stay safely below platform API limits.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Telegram (msg / sec, global)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings["rate_telegram_per_second"] ?? 30}
              onChange={(e) => updateLocal("rate_telegram_per_second", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">Telegram bot limit ≈ 30/sec</p>
          </div>
          <div>
            <Label>Telegram (msg / sec, per user)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={settings["rate_telegram_per_user_per_second"] ?? 1}
              onChange={(e) => updateLocal("rate_telegram_per_user_per_second", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Push (notif / sec)</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={settings["rate_push_per_second"] ?? 150}
              onChange={(e) => updateLocal("rate_push_per_second", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Email (per day, global)</Label>
            <Input
              type="number"
              min={1}
              value={settings["daily_email_cap"] ?? 150}
              onChange={(e) => updateLocal("daily_email_cap", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">Daily email cap</p>
          </div>
          <div>
            <Label>Telegram (per day, global)</Label>
            <Input
              type="number"
              min={1}
              value={settings["daily_telegram_cap"] ?? 5000}
              onChange={(e) => updateLocal("daily_telegram_cap", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {dirty.size > 0 && (
        <div className="sticky bottom-2 z-20">
          <Card className="border-primary shadow-lg">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <p className="text-sm">
                <strong>{dirty.size}</strong> unsaved change(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={saving}>Discard</Button>
                <Button size="sm" onClick={saveAll} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
