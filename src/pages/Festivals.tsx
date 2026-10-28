import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";
import { expandFestivalDays, type Festival } from "@/lib/festivals";

const IST_TIMEZONE = "Asia/Kolkata";

const formatDMY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const shortMonth = (iso: string) => MONTH_SHORT[parseInt(iso.slice(5, 7), 10) - 1] ?? "";

const Festivals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Back: jis page se aaye vahi wapas jaye; seedha link/refresh par history na ho to aane wale page ya More par
  const handleBack = () => {
    const from = (location.state as { from?: string } | null)?.from;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(from && from !== location.pathname ? from : "/more", { replace: true });
  };
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const todayYear = parseInt(formatInTimeZone(now, IST_TIMEZONE, "yyyy"), 10);
  const todayKey = formatInTimeZone(now, IST_TIMEZONE, "yyyy-MM-dd");

  const year = todayYear;
  const [allFestivals, setAllFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("google_calendar_api")
          .select("data")
          .eq("name", "Google Calendar API JSON")
          .maybeSingle();
        if (cancelled) return;
        const list = (data?.data as any)?.festivals;
        if (Array.isArray(list)) {
          setAllFestivals(expandFestivalDays(list));
        } else {
          setAllFestivals([]);
        }
      } catch {
        if (!cancelled) setAllFestivals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const yearFestivals = useMemo(
    () =>
      allFestivals
        .filter((f) => f.date.startsWith(`${year}-`))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [allFestivals, year]
  );

  // One entry per day: a day can hold several festivals, they share a single box.
  const grouped = useMemo(() => {
    const byMonth = new Map<string, [string, Festival[]][]>();
    yearFestivals.forEach((f) => {
      const month = f.date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      const days = byMonth.get(month)!;
      const existing = days.find(([date]) => date === f.date);
      if (existing) existing[1].push(f);
      else days.push([f.date, [f]]);
    });
    return Array.from(byMonth.entries());
  }, [yearFestivals]);

  const monthName = (ym: string) => {
    const [y, m] = ym.split("-");
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-3 py-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Go back"
            className="rounded-full shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            <Calendar className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-semibold truncate">
              {year}
            </h1>
          </div>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <main className="px-3 sm:px-4 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading festivals...</p>
          </div>
        ) : yearFestivals.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No festival data available for {year}.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center text-xs text-muted-foreground">
              Showing {yearFestivals.length} festivals & holidays for {year}
            </div>
            {grouped.map(([month, days]) => (
              <div key={month}>
                <h2 className="text-sm font-semibold text-foreground mb-2 px-1 sticky top-[60px] bg-background/95 backdrop-blur py-1.5 z-10">
                  {monthName(month)}
                </h2>
                <div className="space-y-2">
                  {days.map(([date, items]) => {
                    const isToday = date === todayKey;
                    const isPast = date < todayKey;
                    return (
                      <Card
                        key={date}
                        className={`p-3 flex items-center gap-3 ${
                          isToday
                            ? "border-primary/60 bg-primary/10"
                            : isPast
                            ? "opacity-60"
                            : ""
                        }`}
                      >
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg shrink-0 ${isToday ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"}`}>
                          <span className="text-lg font-bold leading-none">
                            {date.slice(8, 10)}
                          </span>
                          <span className="text-[10px] uppercase leading-none tracking-tight mt-1 whitespace-nowrap">
                            {shortMonth(date)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {items.map((f, i) => (
                            <p
                              key={f.name}
                              className={`text-sm font-medium break-words ${
                                i > 0 ? "mt-1.5 pt-1.5 border-t border-border/50" : ""
                              } ${isToday ? "text-primary" : "text-foreground"}`}
                            >
                              {f.name}
                            </p>
                          ))}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDMY(date)}
                            {items.length > 1 && (
                              <span className="ml-2 inline-block rounded-full border border-border/60 px-1.5 py-px text-[10px]">
                                {items.length} festivals
                              </span>
                            )}
                          </p>
                        </div>
                        {isToday && (
                          <Badge className="shrink-0 self-start">Today</Badge>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
};

export default Festivals;
