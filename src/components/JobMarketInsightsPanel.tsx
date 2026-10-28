import { useEffect, useState } from "react";
import { TrendingUp, MapPin, Building, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SectionState<T> = { loading: boolean; error?: string; data?: T };

const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Convert raw upstream error text into a user-friendly message. */
const friendlyError = (raw?: string): string => {
  const msg = String(raw || "").toLowerCase();
  if (msg.includes("429") || msg.includes("temporarily") || msg.includes("rate")) {
    return "Data temporarily unavailable — please try again in a moment.";
  }
  if (msg.includes("not configured")) return "Insights not available right now.";
  return "Couldn't load this section. Please try again later.";
};

interface Props {
  /** Category or title used to scope the Adzuna insights. */
  keyword?: string | null;
  /** Start collapsed by default to keep the detail page compact. */
  defaultOpen?: boolean;
}

/**
 * Compact inline Job Market Insights panel for job detail pages.
 * Scopes Adzuna insights to the given category/keyword.
 */
const JobMarketInsightsPanel = ({ keyword, defaultOpen = false }: Props) => {
  const kw = (keyword || "").trim() || "jobs";
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(false);

  const [topCompanies, setTopCompanies] = useState<SectionState<any[]>>({ loading: true });
  const [histogram, setHistogram] = useState<SectionState<Record<string, number>>>({ loading: true });
  const [geodata, setGeodata] = useState<SectionState<any[]>>({ loading: true });
  const [history, setHistory] = useState<SectionState<Record<string, number>>>({ loading: true });

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("get-job-feed", {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Request failed");
    return data.data;
  };

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        call("adzuna-top-companies", { keywords: kw }),
        call("adzuna-histogram", { keywords: kw }),
        call("adzuna-geodata", { keywords: kw }),
        call("adzuna-history", { keywords: kw }),
      ]);
      if (cancelled) return;
      const [top, hist, geo, hist12] = results;
      setTopCompanies(top.status === "fulfilled"
        ? { loading: false, data: top.value?.leaderboard || [] }
        : { loading: false, error: String(top.reason) });
      setHistogram(hist.status === "fulfilled"
        ? { loading: false, data: hist.value?.histogram || {} }
        : { loading: false, error: String(hist.reason) });
      setGeodata(geo.status === "fulfilled"
        ? { loading: false, data: geo.value?.locations || [] }
        : { loading: false, error: String(geo.reason) });
      setHistory(hist12.status === "fulfilled"
        ? { loading: false, data: hist12.value?.month || {} }
        : { loading: false, error: String(hist12.reason) });
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, loaded, kw]);

  const histogramMax = histogram.data ? Math.max(...Object.values(histogram.data), 1) : 1;
  const historyMax = history.data ? Math.max(...Object.values(history.data), 1) : 1;
  const geoMax = geodata.data?.length ? Math.max(...geodata.data.map((g: any) => g.count || 0), 1) : 1;

  return (
    <Card className="p-4 mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-300" />
          <h2 className="font-semibold text-sm">
            Job Market Insights
            {keyword ? <Badge variant="secondary" className="ml-2 text-[10px]">{kw}</Badge> : null}
          </h2>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Top companies */}
          <div>
            <h3 className="font-medium text-xs flex items-center gap-1.5 mb-2 text-muted-foreground">
              <Building className="w-3.5 h-3.5" /> Top Hiring Companies
            </h3>
            {topCompanies.loading ? (
              <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : topCompanies.error ? (
              <p className="text-xs text-muted-foreground">{friendlyError(topCompanies.error)}</p>
            ) : topCompanies.data!.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data.</p>
            ) : (
              <ul className="space-y-1">
                {topCompanies.data!.slice(0, 8).map((c: any, i: number) => (
                  <li key={i} className="flex items-center justify-between text-xs border-b border-border/40 pb-1">
                    <span className="font-medium truncate">{c.canonical_name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.count.toLocaleString("en-IN")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Salary histogram */}
          <div>
            <h3 className="font-medium text-xs flex items-center gap-1.5 mb-2 text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" /> Salary Distribution
            </h3>
            {histogram.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : histogram.error ? (
              <p className="text-xs text-muted-foreground">{friendlyError(histogram.error)}</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(histogram.data!).map(([bucket, count]) => {
                  const min = Number(bucket);
                  const label = min === 0 ? "Under ₹10L" : `${fmtINR(min)}+`;
                  const pct = (count / histogramMax) * 100;
                  return (
                    <div key={bucket}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>{label}</span><span>{count.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Geodata */}
          <div>
            <h3 className="font-medium text-xs flex items-center gap-1.5 mb-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Jobs by State
            </h3>
            {geodata.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : geodata.error ? (
              <p className="text-xs text-muted-foreground">{friendlyError(geodata.error)}</p>
            ) : (
              <div className="space-y-1.5">
                {geodata.data!.slice(0, 10).map((row: any, i: number) => {
                  const pct = ((row.count || 0) / geoMax) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="font-medium truncate">{row.location?.display_name}</span>
                        <span className="text-muted-foreground">{(row.count || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Salary trend */}
          <div>
            <h3 className="font-medium text-xs flex items-center gap-1.5 mb-2 text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" /> 12-Month Salary Trend
            </h3>
            {history.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : history.error ? (
              <p className="text-xs text-muted-foreground">{friendlyError(history.error)}</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(history.data!).map(([month, avg]) => {
                  const pct = (avg / historyMax) * 100;
                  return (
                    <div key={month}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="font-medium">{month}</span>
                        <span className="text-muted-foreground">{fmtINR(avg)}</span>
                      </div>
                      <div className="h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Data source: Adzuna (India).
          </p>
        </div>
      )}

      {!open && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tap to view categories, top companies, salary distribution and trends
          {keyword ? ` for ${kw}` : ""}.
        </p>
      )}
    </Card>
  );
};

export default JobMarketInsightsPanel;
