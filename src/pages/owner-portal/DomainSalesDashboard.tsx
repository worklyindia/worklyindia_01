import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";

interface Stats {
  today_sales: number;
  total_sales: number;
  total_revenue: number;
  total_supplier_cost: number;
  total_profit: number;
  margin_percent: number;
  pending_registrations: number;
  failed_registrations: number;
  reseller_pricing: boolean;
  reseller_warning: string | null;
  top_tlds: { tld: string; count: number; revenue: number; profit: number }[];
  daily: { day: string; count: number; revenue: number; profit: number }[];
  recent: {
    id: string;
    domain: string;
    tld: string;
    status: string;
    customer_price: number;
    supplier_cost: number | null;
    profit: number | null;
    user_id: string;
    created_at: string;
  }[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

const statusClass = (status: string) => {
  switch (status) {
    case "registered":
      return "bg-emerald-600 hover:bg-emerald-600";
    case "failed":
      return "bg-destructive hover:bg-destructive";
    case "registration_pending":
    case "payment_pending":
      return "bg-amber-500 hover:bg-amber-500";
    default:
      return "bg-secondary";
  }
};

const DomainSalesDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [tld, setTld] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minProfit, setMinProfit] = useState("");
  const [maxProfit, setMaxProfit] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callDomainMarket<{ stats: Stats }>("admin_stats");
      setStats(res.stats);
    } catch (e: any) {
      toast.error(e?.message || "Could not load sales stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tldOptions = useMemo(() => {
    if (!stats) return [];
    return Array.from(new Set(stats.recent.map((r) => r.tld))).sort();
  }, [stats]);

  const filtered = useMemo(() => {
    if (!stats) return [];
    const needle = q.trim().toLowerCase();
    return stats.recent.filter((r) => {
      if (needle && !r.domain.toLowerCase().includes(needle) && !r.user_id.toLowerCase().startsWith(needle)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (tld !== "all" && r.tld !== tld) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(`${to}T23:59:59`)) return false;
      if (minProfit !== "" && (r.profit ?? -Infinity) < Number(minProfit)) return false;
      if (maxProfit !== "" && (r.profit ?? Infinity) > Number(maxProfit)) return false;
      return true;
    });
  }, [stats, q, status, tld, from, to, minProfit, maxProfit]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl space-y-4 px-3 py-6 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">Sales stats are unavailable right now.</p>
      </main>
    );
  }

  const cards = [
    { label: "Today's sales", value: String(stats.today_sales) },
    { label: "Total sales", value: String(stats.total_sales) },
    { label: "Revenue", value: formatMoney(stats.total_revenue) },
    { label: "Supplier cost", value: formatMoney(stats.total_supplier_cost) },
    { label: "Gross profit", value: formatMoney(stats.total_profit) },
    { label: "Margin", value: `${stats.margin_percent}%` },
    { label: "Pending registrations", value: String(stats.pending_registrations) },
    { label: "Failed registrations", value: String(stats.failed_registrations) },
  ];

  return (
    <>
      <Helmet>
        <title>Domain Sales Dashboard | Owner Portal</title>
      </Helmet>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-3 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Domain Sales Dashboard</h1>
            <p className="text-sm text-muted-foreground">Revenue, supplier cost and profit across domain orders.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </header>

        {!stats.reseller_pricing && stats.reseller_warning ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Estimated supplier cost</AlertTitle>
            <AlertDescription>{stats.reseller_warning}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-lg font-bold sm:text-xl">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {stats.top_tlds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top TLDs</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">TLD</th>
                    <th className="py-2 pr-3">Sales</th>
                    <th className="py-2 pr-3">Revenue</th>
                    <th className="py-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_tlds.map((t) => (
                    <tr key={t.tld} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">.{t.tld}</td>
                      <td className="py-2 pr-3">{t.count}</td>
                      <td className="py-2 pr-3">{formatMoney(t.revenue)}</td>
                      <td className="py-2">{formatMoney(t.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {stats.daily.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 14 days</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Day</th>
                    <th className="py-2 pr-3">Sales</th>
                    <th className="py-2 pr-3">Revenue</th>
                    <th className="py-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.daily.map((d) => (
                    <tr key={d.day} className="border-b border-border/50">
                      <td className="py-2 pr-3">{new Date(d.day).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })}</td>
                      <td className="py-2 pr-3">{d.count}</td>
                      <td className="py-2 pr-3">{formatMoney(d.revenue)}</td>
                      <td className="py-2">{formatMoney(d.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent orders</CardTitle>
            <CardDescription>Newest 50 orders — filter by domain, customer, TLD, status, date or profit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <Input placeholder="Domain or customer id" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 h-9" />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["registered", "registration_pending", "paid", "payment_pending", "pending", "failed", "refunded", "cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tld} onValueChange={setTld}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="TLD" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All TLDs</SelectItem>
                  {tldOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      .{t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              <div className="col-span-2 flex gap-2 lg:col-span-1">
                <Input type="number" placeholder="Min ₹" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} className="h-9" />
                <Input type="number" placeholder="Max ₹" value={maxProfit} onChange={(e) => setMaxProfit(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Domain</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-xs">{fmtDate(r.created_at)}</td>
                      <td className="py-2 pr-3 font-medium">{r.domain}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.user_id.slice(0, 8)}…</td>
                      <td className="py-2 pr-3">
                        <Badge className={statusClass(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="py-2 pr-3">{formatMoney(r.customer_price)}</td>
                      <td className="py-2">{r.profit != null ? formatMoney(r.profit) : "—"}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No orders match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default DomainSalesDashboard;
