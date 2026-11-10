import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Heart, Users, IndianRupee, CheckCircle2, XCircle, Clock } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

type Donation = {
  id: string;
  campaign_id: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  amount: number;
  status: "paid" | "failed" | "pending" | string;
  is_anonymous: boolean | null;
  message: string | null;
  created_at: string;
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function DonationCampaignDonations() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "failed" | "pending">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: camp }, { data: dons }] = await Promise.all([
      supabase.from("donation_campaigns").select("*").eq("id", id).maybeSingle(),
      supabase.from("donations").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(1000),
    ]);
    setCampaign(camp);
    setDonations((dons as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`donations_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "donations", filter: `campaign_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    return donations.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (d.donor_name || "").toLowerCase().includes(q) ||
          (d.donor_email || "").toLowerCase().includes(q) ||
          (d.donor_phone || "").toLowerCase().includes(q) ||
          String(d.amount).includes(q)
        );
      }
      return true;
    });
  }, [donations, filter, search]);

  const stats = useMemo(() => {
    const paid = donations.filter((d) => d.status === "paid");
    const total = paid.reduce((s, d) => s + Number(d.amount || 0), 0);
    return {
      total,
      paid: paid.length,
      failed: donations.filter((d) => d.status === "failed").length,
      pending: donations.filter((d) => d.status === "pending").length,
    };
  }, [donations]);

  const statusBadge = (s: string) => {
    if (s === "paid") return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Success</Badge>;
    if (s === "failed") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Failed</Badge>;
    return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{s}</Badge>;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-4xl px-3 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/owner-portal/donation-campaigns")} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Heart className="w-3 h-3 text-orange-600" />Donations</div>
            <h1 className="text-sm sm:text-base font-semibold truncate">{campaign?.title || "Campaign"}</h1>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl px-3 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Raised</div>
            <div className="text-base sm:text-lg font-bold tabular-nums truncate flex items-center"><IndianRupee className="w-3.5 h-3.5" />{stats.total.toLocaleString("en-IN")}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Donors</div>
            <div className="text-base sm:text-lg font-bold tabular-nums flex items-center gap-1"><Users className="w-4 h-4" />{stats.paid}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Failed</div>
            <div className="text-base sm:text-lg font-bold tabular-nums text-destructive">{stats.failed}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Pending</div>
            <div className="text-base sm:text-lg font-bold tabular-nums text-amber-600">{stats.pending}</div>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input placeholder="Search by name, email, phone, amount" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {(["all", "paid", "failed", "pending"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 capitalize shrink-0" onClick={() => setFilter(f)}>
                {f === "paid" ? "Success" : f} {f !== "all" && (
                  <span className="ml-1 text-[10px] opacity-75">({f === "paid" ? stats.paid : f === "failed" ? stats.failed : stats.pending})</span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">No donations found.</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {d.is_anonymous ? "Anonymous" : d.donor_name || "—"}
                    </div>
                    {(d.donor_email || d.donor_phone) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {d.donor_email || d.donor_phone}
                      </div>
                    )}
                    {d.message && (
                      <div className="text-xs italic text-muted-foreground mt-1 line-clamp-2">"{d.message}"</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">{fmtDateTime(d.created_at)}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="font-bold text-sm tabular-nums">₹{Number(d.amount).toLocaleString("en-IN")}</div>
                    {statusBadge(d.status)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}