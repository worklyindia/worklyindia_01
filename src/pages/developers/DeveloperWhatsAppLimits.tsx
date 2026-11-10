import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CircleHelp, Gauge, Loader2, RefreshCw, Search, ShieldAlert, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { goBack } from "@/lib/goBack";
import { supabase } from "@/integrations/supabase/client";
import { useScrollLoader } from "@/hooks/useScrollLoader";

export type NumLimit = {
  phone_number_id: string | null;
  phone: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  meta_status?: string | null;
  meta_blocked?: boolean;
  tier: string;
  limit_24h: number;
  used_24h: number;
  remaining_24h: number;
  resets_at: string | null;
  unique_customers_7d?: number;
  next_tier_at?: number;
  next_limit?: number | null;
  unlimited?: boolean;
};
type SubLimit = {
  sub_account_id: string;
  external_id: string;
  name: string | null;
  status: string;
  used_24h: number;
  sent_30d?: number;
  resets_at: string | null;
  numbers: NumLimit[];
};
type Overview = {
  success: boolean;
  api_key: { used_24h: number; resets_at: string | null };
  account: { numbers: NumLimit[] };
  sub_accounts: SubLimit[];
};
type Tab = "account" | "subs";

const fmtReset = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

const numMatches = (n: NumLimit, q: string) =>
  !q || [n.phone, n.verified_name, n.phone_number_id, n.tier].some((v) => (v || "").toLowerCase().includes(q));

const subMatches = (s: SubLimit, q: string) =>
  !q || [s.name, s.external_id].some((v) => (v || "").toLowerCase().includes(q)) || s.numbers.some((n) => numMatches(n, q));

function UsageBar({ used, limit, unlimited }: { used: number; limit: number; unlimited?: boolean }) {
  if (unlimited) {
    return (
      <div className="mt-3">
        <div role="progressbar" aria-label="WhatsApp limit used" aria-valuemin={0} aria-valuemax={1} aria-valuenow={0} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-success" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{used.toLocaleString("en-IN")} used · Unlimited</p>
      </div>
    );
  }
  const pct = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  return (
    <div className="mt-3">
      <div role="progressbar" aria-label="WhatsApp limit used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(Math.max(used, 0), limit)} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {used.toLocaleString("en-IN")} / {limit.toLocaleString("en-IN")} used ·{" "}
        <span className={limit > 0 && used / limit >= 0.9 ? "font-medium text-destructive" : undefined}>
          {Math.max(limit - used, 0).toLocaleString("en-IN")} left
        </span>
      </p>
    </div>
  );
}

const QUALITY_STYLES: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  GREEN: { label: "GREEN", icon: BadgeCheck, className: "border-success/40 bg-success/10 text-success" },
  YELLOW: { label: "YELLOW", icon: TriangleAlert, className: "border-warning/40 bg-warning/10 text-warning" },
  RED: { label: "RED", icon: ShieldAlert, className: "border-destructive/40 bg-destructive/10 text-destructive" },
};
const QUALITY_UNKNOWN = { label: "—", icon: CircleHelp, className: "border-border bg-muted text-muted-foreground" };

export function NumberRow({ n }: { n: NumLimit }) {
  const unique = n.unique_customers_7d ?? 0;
  const nextAt = n.next_tier_at ?? (n.limit_24h >= 1000 ? Math.floor(n.limit_24h / 2) : 0);
  const isUnlimited = !!n.unlimited || n.tier === "TIER_UNLIMITED";
  const qualityKey = (n.quality_rating || "").toUpperCase();
  const quality = qualityKey in QUALITY_STYLES ? QUALITY_STYLES[qualityKey] : QUALITY_UNKNOWN;
  const qualityGreen = qualityKey === "GREEN";
  const pctUsed = isUnlimited || n.limit_24h <= 0 ? 0 : (n.used_24h / n.limit_24h) * 100;
  const remaining = Math.max(n.limit_24h - n.used_24h, 0);
  const usageToneClass = pctUsed >= 90 ? "text-destructive" : pctUsed >= 70 ? "text-warning" : "text-success";
  const nextLimit = n.next_limit ?? [250, 2000, 10000, 100000].find((limit) => limit > n.limit_24h);
  const formatLimit = (limit: number) => limit.toLocaleString("en-US");
  const progress = nextAt > 0 ? Math.min(100, Math.max(0, (unique / nextAt) * 100)) : 0;
  const hint = isUnlimited
    ? null
    : nextAt <= 0
      ? { text: `Verify your business to reach ${(n.next_limit ?? 2000).toLocaleString("en-IN")}`, className: "" }
      : unique >= nextAt
        ? qualityGreen
          ? { text: "Customer target met. Meta approval and eligibility requirements still apply.", className: "text-success" }
          : { text: "Needs GREEN quality to increase", className: "text-warning" }
        : { text: `${formatLimit(nextAt - unique)} more unique customers to go`, className: "" };
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">{n.phone || n.phone_number_id || "—"} {n.verified_name ? `· ${n.verified_name}` : ""}</p>
        {n.meta_blocked ? (
          <span role="status" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Blocked by Meta · sending paused
          </span>
        ) : null}
      </div>
      <dl className={`mt-6 grid gap-3 sm:gap-5 ${isUnlimited ? "grid-cols-1" : "grid-cols-2"}`}>
        <div className="min-w-0 rounded-lg bg-muted p-3 sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <dt className="min-w-0 truncate text-sm text-muted-foreground sm:text-base">Current Limit</dt>
            {qualityKey ? (
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none sm:text-xs ${quality.className}`}>
                {quality.label === "—" ? "Unknown" : quality.label.charAt(0) + quality.label.slice(1).toLowerCase()}
              </span>
            ) : null}
          </div>
          <dd className={`mt-3 break-words font-semibold leading-tight ${usageToneClass} ${isUnlimited ? "flex items-center gap-2 text-3xl sm:text-4xl" : "text-3xl sm:text-4xl"}`}>
            {isUnlimited ? (<><span aria-hidden="true" className="text-4xl leading-none sm:text-5xl">∞</span><span>Unlimited</span></>) : formatLimit(n.limit_24h)}
          </dd>
          <dd className="mt-3 whitespace-nowrap text-[10px] leading-tight tracking-tight text-muted-foreground sm:text-xs sm:tracking-normal">Business-initiated / 24 hours</dd>
          {!isUnlimited && pctUsed >= 90 && (
            <dd className="mt-2 text-[10px] font-medium leading-tight text-destructive sm:text-xs">Only {formatLimit(remaining)} left — limit almost over</dd>
          )}
        </div>
        {!isUnlimited && (
          <div className="min-w-0 rounded-lg border border-border p-3 sm:p-5">
            <dt className="text-sm text-muted-foreground sm:text-base">Next Tier</dt>
            <dd className={`mt-3 break-words font-semibold leading-tight ${!nextLimit ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>{nextLimit ? formatLimit(nextLimit) : "Unlimited"}</dd>
            <dd className="mt-3 whitespace-nowrap text-[10px] leading-tight tracking-tight text-muted-foreground sm:text-xs sm:tracking-normal">After Meta approval / eligibility</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">Unique customers in last 7 days</p>
          <p className="shrink-0 text-base font-semibold tabular-nums sm:text-lg">{formatLimit(unique)}{!isUnlimited && nextAt > 0 ? ` / ${formatLimit(nextAt)}` : ""}</p>
        </div>
        {!isUnlimited && nextAt > 0 && (
          <div role="progressbar" aria-label="Next-tier customer eligibility" aria-valuemin={0} aria-valuemax={nextAt} aria-valuenow={Math.min(unique, nextAt)} className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
        )}
        {hint && <p className={`mt-4 text-sm leading-relaxed ${hint.className || "text-muted-foreground"}`}>{hint.text}</p>}
        {!isUnlimited && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Meta eligibility requirements apply. Upgrades may take up to 24 hours.</p>}
      </div>
      <div className="mt-5 border-t border-border pt-2">
      <UsageBar used={n.used_24h} limit={n.limit_24h} unlimited={isUnlimited} />
      </div>
    </div>
  );
}

export default function DeveloperWhatsAppLimits() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<Tab>("account");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => { setVisibleCount(30); }, [tab, search, refresh]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("workly-india", {
      body: { scope: "sub_manage", action: "limits_overview" },
    });
    if (error || !data?.success) {
      toast.error(data?.error || "Couldn't load WhatsApp limits");
      setLoading(false);
      return;
    }
    setData(data as Overview);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refresh]);

  const q = search.trim().toLowerCase();
  const numbers = (data?.account.numbers || []).filter((n) => numMatches(n, q));
  const subs = (data?.sub_accounts || []).filter((s) => subMatches(s, q));
  const loadMore = useCallback(() => setVisibleCount(visibleCount + 30), [visibleCount]);
  const { rootRef, sentinelRef } = useScrollLoader(loadMore, visibleCount < (tab === "account" ? numbers.length : subs.length), loading);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "account", label: "My Account", count: data?.account.numbers.length || 0 },
    { key: "subs", label: "Sub-accounts", count: data?.sub_accounts.length || 0 },
  ];

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Back" onClick={() => goBack(navigate, "/developers")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-lg font-semibold">WhatsApp limits</h1>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="WhatsApp limit rules" title="WhatsApp limit rules" onClick={() => navigate("/developers/whatsapp-limits/guide")}><CircleHelp className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh" onClick={() => setRefresh((k) => k + 1)}><RefreshCw className="h-5 w-5" /></Button>
      </header>
      <main ref={rootRef} className="min-h-0 w-full flex-1 overflow-y-auto pb-8">
        <div className="sticky top-0 z-10 w-full bg-background pb-3">
          <div role="tablist" aria-label="WhatsApp limits view" className="grid w-full grid-cols-2 border-b border-border">
            {tabs.map((t) => (
              <Button
                key={t.key}
                role="tab"
                type="button"
                 variant="ghost"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex h-11 w-full items-center justify-center gap-2 rounded-none border-b-2 px-2 text-sm font-medium transition-colors ${
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                <span className={`text-xs ${tab === t.key ? "text-primary" : "text-muted-foreground"}`}>{t.count}</span>
              </Button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 px-4 sm:px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "account" ? "Search phone, name or tier" : "Search name, ID or phone"}
                aria-label="Search"
                className="h-10 w-full rounded-lg pl-9 pr-10"
              />
              {search && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Clear search" onClick={() => setSearch("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data ? (
          <div className="py-16 text-center"><Gauge className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><p className="font-medium">No data yet</p></div>
        ) : tab === "account" ? (
          <div className="w-full pt-1">
            <section aria-label="Your numbers">
              {data.account.numbers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No WhatsApp number connected to your account yet.</p>
              ) : numbers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No number matches “{search.trim()}”.</p>
              ) : (
                <div className="divide-y divide-border">{numbers.slice(0, visibleCount).map((n) => <NumberRow key={n.phone_number_id} n={n} />)}</div>
              )}
            </section>
          </div>
        ) : (
          <div className="w-full pt-1">
            <section aria-label="Sub-accounts">
              {data.sub_accounts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No sub-accounts yet. Create them with the API action create_sub_account.</p>
              ) : subs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No sub-account matches “{search.trim()}”.</p>
              ) : (
                <ul className="divide-y divide-border border-y border-border">
                  {subs.slice(0, visibleCount).map((s) => {
                    const matched = s.numbers.filter((n) => numMatches(n, q));
                    const shown = matched.length > 0 ? matched : q && [s.name, s.external_id].some((v) => (v || "").toLowerCase().includes(q)) ? s.numbers : [];
                    return (
                      <li key={s.sub_account_id} className="pt-4">
                        <div className="flex items-center justify-between gap-2 px-4 sm:px-6">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name || s.external_id}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.external_id} · {s.used_24h.toLocaleString("en-IN")} sent in 24h · {(s.sent_30d ?? 0).toLocaleString("en-IN")} sent in 30 days{s.resets_at ? ` · resets ${fmtReset(s.resets_at)}` : ""}
                            </p>
                          </div>
                          <Badge variant={s.status === "connected" ? "default" : "secondary"}>{s.status}</Badge>
                        </div>
                        {shown.length > 0 && (
                          <div className="mt-2 divide-y divide-border">{shown.map((n) => <NumberRow key={n.phone_number_id} n={n} />)}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
        <div ref={sentinelRef} className="h-1" />
        {!loading && visibleCount < (tab === "account" ? numbers.length : subs.length) && <div role="status" aria-label="Loading more" className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      </main>
    </div>
  );
}
