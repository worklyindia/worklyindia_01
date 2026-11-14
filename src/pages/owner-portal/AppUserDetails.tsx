import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, Smartphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type ProfileRow = { user_id: string; full_name: string | null; email: string | null; phone: string | null; whatsapp_number: string | null; profile_image_url: string | null; account_status: string | null; created_at: string | null; updated_at: string | null; last_login_at: string | null };
type DeviceRow = { user_id: string | null; device_id: string | null; device_type: string | null; operating_system: string | null; browser_name: string | null; browser_version: string | null; native_device_info: Record<string, unknown> | null; created_at: string; updated_at: string };

export default function AppUserDetails() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: role, error: roleError } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
      if (roleError || role?.role !== "owner") throw new Error("Owner access required");
      const [profileResult, deviceResult] = await Promise.all([
        supabase.from("profiles").select("user_id,full_name,email,phone,whatsapp_number,profile_image_url,account_status,created_at,updated_at,last_login_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("device_info_logs").select("user_id,device_id,device_type,operating_system,browser_name,browser_version,native_device_info,created_at").order("updated_at", { ascending: false }).limit(1000),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (deviceResult.error) throw deviceResult.error;
      setProfiles((profileResult.data || []) as ProfileRow[]);
      setDevices((deviceResult.data || []) as DeviceRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load app user details");
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  const latestByUser = new Map<string, DeviceRow>();
  for (const device of devices) if (device.user_id && !latestByUser.has(device.user_id) && Date.now() - new Date(device.updated_at || device.created_at).getTime() < 30 * 86400000) latestByUser.set(device.user_id, device);
  const activeCount = latestByUser.size;
  // Only show a profile while at least one device for that account has sent a heartbeat in the last 30 days.
  const filtered = profiles.filter(p => latestByUser.has(p.user_id) && [p.full_name,p.email,p.phone,p.whatsapp_number].some(v => (v || "").toLowerCase().includes(search.toLowerCase())));

  return <main className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
    <header className="sticky top-0 z-20 flex min-h-14 w-full items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur">
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/owner-portal")} aria-label="Back to Owner Portal"><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">App User Details</h1>
      <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh users"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
    </header>
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-5">
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Active app users</p><p className="text-2xl font-bold tabular-nums">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Devices seen</p><p className="text-2xl font-bold tabular-nums">{latestByUser.size}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Active installs ≤30d</p><p className="text-2xl font-bold tabular-nums">{activeCount}</p></CardContent></Card>
      </div>
      <p className="text-xs text-muted-foreground">Only accounts with a device heartbeat in the last 30 days appear here. Uninstalled or inactive app installations disappear after the 30-day heartbeat window; account profiles, resumes and applications remain safe.</p>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone…" className="pl-9" /></div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading user profiles…</p> : filtered.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No profiles found.</CardContent></Card> : <div className="space-y-3">
        {filtered.map(profile => {
          const device = latestByUser.get(profile.user_id);
          const isActiveEstimate = !!device && Date.now() - new Date(device.updated_at || device.created_at).getTime() < 30 * 86400000;
          return <Card key={profile.user_id} className="w-full min-w-0"><CardContent className="space-y-2 p-3 sm:p-4">
            <div className="flex min-w-0 items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{profile.full_name || "Name not provided"}</p><p className="break-all text-xs text-muted-foreground">{profile.email || "Email unavailable"}</p></div><Badge variant={isActiveEstimate ? "default" : "secondary"} className="shrink-0">{isActiveEstimate ? "Recently active" : "No recent device log"}</Badge></div>
            <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2"><p className="break-all"><span className="text-muted-foreground">Mobile: </span>{profile.phone || "Not provided"}</p><p className="break-all"><span className="text-muted-foreground">WhatsApp: </span>{profile.whatsapp_number || "Not provided"}</p><p className="break-words"><span className="text-muted-foreground">Account: </span>{profile.account_status || "active"}</p><p className="break-words"><span className="text-muted-foreground">Joined: </span>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</p></div>
            {device && <div className="rounded-lg bg-muted/50 p-2 text-xs"><p className="flex items-center gap-1 font-medium"><Smartphone className="h-3 w-3" />{device.device_type || "Device"} · {device.operating_system || "OS unknown"}</p><p className="mt-1 break-all text-muted-foreground">{device.browser_name || "App/browser"} {device.browser_version || ""} · Last app heartbeat {new Date(device.updated_at || device.created_at).toLocaleString()}</p><Button variant="ghost" size="sm" className="mt-1 px-0" onClick={() => setExpanded(expanded === profile.user_id ? null : profile.user_id)}>{expanded === profile.user_id ? "Hide device details" : "View device details"}</Button>{expanded === profile.user_id && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(device.native_device_info || {}, null, 2)}</pre>}</div>}
          </CardContent></Card>;
        })}
      </div>}
    </div>
  </main>;
}
