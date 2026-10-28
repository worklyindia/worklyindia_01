import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { goBack } from "@/lib/goBack";
import { supabase } from "@/integrations/supabase/client";
import { useScrollLoader } from "@/hooks/useScrollLoader";

type Num = { sub_account_id: string; phone_number_id: string; display_phone: string | null; verified_name: string | null; quality_rating: string | null; connected_at: string };
type Sub = { id: string; external_id: string; name: string | null; status: string; created_at: string; numbers: Num[] };
type ChanEntry = { channel: string; account_id?: string; label: string; connected_at: string };
const PAGE = 30;
const db = supabase as any;

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "gmail", label: "Gmail" },
  { key: "outlook", label: "Outlook" },
  { key: "domain_email", label: "Domain Email" },
];

export default function DeveloperSubAccounts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [channel, setChannel] = useState("whatsapp");
  const [overview, setOverview] = useState<Record<string, ChanEntry[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let q = db.from("developer_sub_accounts").select("id,external_id,name,status,created_at", { count: "exact" })
      .order("created_at", { ascending: false }).range(0, page * PAGE - 1);
    const s = query.replace(/[%,()]/g, "");
    if (s) q = q.or(`external_id.ilike.%${s}%,name.ilike.%${s}%`);
    const { data, count, error } = await q;
    if (error) { toast.error("Couldn't load sub-accounts"); setLoading(false); return; }
    const ids = (data || []).map((r: any) => r.id);
    const [{ data: nums }, ov] = await Promise.all([
      ids.length
        ? db.from("developer_sub_account_numbers").select("sub_account_id,phone_number_id,display_phone,verified_name,quality_rating,connected_at").in("sub_account_id", ids).eq("status", "connected")
        : Promise.resolve({ data: [] }),
      supabase.functions.invoke("workly-india", { body: { scope: "sub_manage", action: "channels_overview" } }),
    ]);
    setRows((data || []).map((r: any) => ({ ...r, numbers: (nums || []).filter((n: Num) => n.sub_account_id === r.id) })));
    if (!ov.error && ov.data?.overview) setOverview(ov.data.overview as Record<string, ChanEntry[]>);
    setTotal(count || 0);
    setLoading(false);
  }, [page, query]);

  useEffect(() => { void load(); }, [load, refresh]);

  const disconnect = async (sub: Sub, n: Num) => {
    if (!window.confirm(`Disconnect ${n.display_phone || n.phone_number_id} from ${sub.name || sub.external_id}?`)) return;
    setBusyId(n.phone_number_id);
    const { data, error } = await supabase.functions.invoke("workly-india", { body: { scope: "sub_manage", action: "disconnect_sub_account", sub_account_id: sub.id, phone_number_id: n.phone_number_id } });
    setBusyId("");
    if (error || !data?.success) { toast.error(data?.error || "Couldn't disconnect"); return; }
    toast.success("Number disconnected");
    setRefresh((k) => k + 1);
  };

  const disconnectChannel = async (sub: Sub, e: ChanEntry) => {
    if (!window.confirm(`Disconnect ${e.label} from ${sub.name || sub.external_id}?`)) return;
    setBusyId(`${sub.id}:${e.channel}:${e.account_id || e.label}`);
    const { data, error } = await supabase.functions.invoke("workly-india", { body: { scope: "sub_manage", action: "disconnect_sub_account", sub_account_id: sub.id, channel: e.channel, account_id: e.account_id } });
    setBusyId("");
    if (error || !data?.success) { toast.error(data?.error || "Couldn't disconnect"); return; }
    toast.success("Disconnected");
    setRefresh((k) => k + 1);
  };

  const loadMore = useCallback(() => setPage(page + 1), [page]);
  const { rootRef, sentinelRef } = useScrollLoader(loadMore, rows.length < total, loading);
  const visible = rows.filter((s) => s.status !== 'disconnected' && (channel === "whatsapp" ? s.numbers.length > 0 || (overview[s.id] || []).some((c) => c.channel === channel) : (overview[s.id] || []).some((c) => c.channel === channel)));
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Back" onClick={() => goBack(navigate, "/developers")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-lg font-semibold">Sub-accounts</h1>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Refresh" onClick={() => setRefresh((k) => k + 1)}><RefreshCw className="h-5 w-5" /></Button>
      </header>
      <main ref={rootRef} className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <form className="sticky top-0 z-10 flex gap-2 bg-background py-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by external ID or name" aria-label="Search sub-accounts" />
          <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search className="h-4 w-4" /></Button>
        </form>
        <div role="tablist" aria-label="Channel" className="flex gap-2 overflow-x-auto pb-3">
          {CHANNELS.map((c) => (
            <Button
              key={c.key}
              role="tab"
              variant="ghost"
              aria-selected={channel === c.key}
              onClick={() => setChannel(c.key)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${channel === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"}`}
            >
              {c.label}
            </Button>
          ))}
        </div>
        {loading && rows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center"><Users className="mx-auto mb-4 h-9 w-9 text-muted-foreground" /><p className="font-medium">No {CHANNELS.find((c) => c.key === channel)?.label} sub-accounts yet</p><p className="mt-1 text-sm text-muted-foreground">Connect one with the API action create_connect_link (channel: {channel}). See the docs.</p></div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {visible.map((s) => {
              const entries = (overview[s.id] || []).filter((c) => c.channel === channel);
              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name || s.external_id}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.external_id} · {new Date(s.created_at).toLocaleDateString("en-IN")}</p>
                    </div>
                    <Badge variant={s.status === "connected" ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  {channel === "whatsapp" && s.numbers.map((n) => (
                    <div key={n.phone_number_id} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{n.display_phone || n.phone_number_id} {n.verified_name ? `· ${n.verified_name}` : ""}</p>
                        <p className="text-xs text-muted-foreground">Quality {n.quality_rating || "—"} · since {new Date(n.connected_at).toLocaleDateString("en-IN")}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={busyId === n.phone_number_id} onClick={() => disconnect(s, n)}>
                        {busyId === n.phone_number_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                      </Button>
                    </div>
                  ))}
                  {channel !== "whatsapp" && entries.map((e) => {
                    const busy = busyId === `${s.id}:${e.channel}:${e.account_id || e.label}`;
                    return (
                      <div key={`${e.channel}:${e.account_id || e.label}`} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">{e.label}</p>
                          <p className="text-xs text-muted-foreground">Since {e.connected_at ? new Date(e.connected_at).toLocaleDateString("en-IN") : "—"}</p>
                        </div>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => disconnectChannel(s, e)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
                        </Button>
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={sentinelRef} className="h-1" />
        {loading && rows.length > 0 && <div role="status" aria-label="Loading more" className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      </main>
    </div>
  );
}
