import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Search, Smartphone, Users, UserRound, Clock, Activity, CalendarDays } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { toast } from "sonner";

type ProfileRow = {
  user_id: string; full_name: string | null; email: string | null; phone: string | null;
  profile_image_url: string | null; location: string | null; city: string | null; state: string | null;
  created_at: string | null; account_status: string | null;
};
type InstallRow = {
  id: string; user_id: string; installation_id: string; platform: string;
  device_model: string | null; os_version: string | null; app_version: string | null;
  last_seen_at: string; created_at: string;
};
type SessionRow = {
  id: string; session_id: string; user_id: string | null; installation_id: string; platform: string;
  device_model: string; os_version: string; app_version: string;
  started_at: string; last_seen_at: string; ended_at: string | null;
};

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function AppUserDetails() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [installs, setInstalls] = useState<InstallRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [anonymousInstalls, setAnonymousInstalls] = useState<AnonymousInstallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [u, i, s, a] = await Promise.all([
      supabase.rpc("get_owner_app_user_details"),
      supabase.from("app_installations").select("*").eq("platform", "android_app").order("last_seen_at", { ascending: false }).limit(10000),
      supabase.from("app_sessions").select("*").eq("platform", "android_app").order("last_seen_at", { ascending: false }).limit(10000),
      supabase.from("app_anonymous_installations").select("installation_id,last_seen_at,device_model,app_version").order("last_seen_at", { ascending: false }).limit(10000),
    ]);
    if (u.error) toast.error("Unable to load app users: " + u.error.message);
    if (i.error) toast.error("Unable to load Android app installations: " + i.error.message);
    if (s.error) toast.error("Unable to load app sessions: " + s.error.message);
    if (a.error) toast.error("Unable to load anonymous app devices: " + a.error.message);
    setUsers((u.data || []) as ProfileRow[]);
    setInstalls((i.data || []) as InstallRow[]);
    setSessions((s.data || []) as SessionRow[]);
    setAnonymousInstalls((a.data || []) as AnonymousInstallRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const activeUserIds = new Set(sessions.filter(s =>
      !s.ended_at && now - new Date(s.last_seen_at).getTime() <= ACTIVE_WINDOW_MS
    ).map(s => s.user_id));
    const recentUserIds = new Set(sessions.filter(s => s.user_id &&
      now - new Date(s.last_seen_at).getTime() <= RECENT_WINDOW_MS
    ).map(s => s.user_id as string));
    const anonymousActive = new Set(sessions.filter(s =>
      !s.user_id && !s.ended_at && now - new Date(s.last_seen_at).getTime() <= ACTIVE_WINDOW_MS
    ).map(s => s.installation_id)).size;
    const distinctIn = (from: Date) => new Set(
      sessions.filter(s => s.user_id && new Date(s.last_seen_at).getTime() >= from.getTime()).map(s => s.user_id as string)
    ).size;
    return {
      totalUsers: users.length,
      installations: installs.length + anonymousInstalls.length,
      anonymousDevices: anonymousInstalls.length,
      anonymousActive,
      activeNow: activeUserIds.size,
      recentlyActive: recentUserIds.size,
      inactive: Math.max(0, users.length - recentUserIds.size),
      daily: distinctIn(startOfDay(new Date())),
      weekly: distinctIn(startOfWeek(new Date(), { weekStartsOn: 1 })),
      monthly: distinctIn(startOfMonth(new Date())),
    };
  }, [users, installs, sessions, anonymousInstalls]);

  const filtered = useMemo(() => users.filter(u =>
    [u.full_name, u.email, u.phone, u.user_id, u.city, u.state, u.location]
      .some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
  ), [users, search]);

  const installsByUser = useMemo(() => {
    const map = new Map<string, InstallRow[]>();
    installs.forEach(row => map.set(row.user_id, [...(map.get(row.user_id) || []), row]));
    return map;
  }, [installs]);

  const sessionsByUser = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    sessions.forEach(row => map.set(row.user_id, [...(map.get(row.user_id) || []), row]));
    return map;
  }, [sessions]);

  const getStatus = (userId: string) => {
    const now = Date.now();
    const userSessions = sessionsByUser.get(userId) || [];
    const live = userSessions.some(s => !s.ended_at && now - new Date(s.last_seen_at).getTime() <= ACTIVE_WINDOW_MS);
    const lastSeen = Math.max(
      ...[...(installsByUser.get(userId) || []).map(x => new Date(x.last_seen_at).getTime()),
        ...userSessions.map(x => new Date(x.last_seen_at).getTime())],
      0
    );
    return { live, recent: lastSeen > 0 && now - lastSeen <= RECENT_WINDOW_MS, lastSeen };
  };

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-3 px-3 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to Owner Portal" onClick={() => navigate("/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold sm:text-2xl">App User Details</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">Android app users, live sessions and device activity only</p>
          </div>
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => void load()} disabled={loading} aria-label="Refresh app tracking">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-3 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Total App Users</p><p className="mt-1 text-2xl font-bold tabular-nums">{stats.totalUsers}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Active Now</p><p className="mt-1 text-2xl font-bold tabular-nums">{stats.activeNow}</p><p className="text-[11px] text-muted-foreground">Heartbeat within 2 minutes</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Recently Active</p><p className="mt-1 text-2xl font-bold tabular-nums">{stats.recentlyActive}</p><p className="text-[11px] text-muted-foreground">Last 24 hours</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Inactive Users</p><p className="mt-1 text-2xl font-bold tabular-nums">{stats.inactive}</p><p className="text-[11px] text-muted-foreground">No app activity in 24 hours</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">App Installations</p><p className="text-xl font-semibold tabular-nums">{stats.installations}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Anonymous Devices</p><p className="text-xl font-semibold tabular-nums">{stats.anonymousDevices}</p><p className="text-[11px] text-muted-foreground">{stats.anonymousActive} active now</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Daily Active Users</p><p className="text-xl font-semibold tabular-nums">{stats.daily}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Weekly Active Users</p><p className="text-xl font-semibold tabular-nums">{stats.weekly}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Monthly Active Users</p><p className="text-xl font-semibold tabular-nums">{stats.monthly}</p></CardContent></Card>
        </div>

        <Card><CardContent className="p-3 sm:p-4">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search app user, email, phone or user ID..." />
          </div>
        </CardContent></Card>

        {loading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading Android app tracking...</CardContent></Card>
          : filtered.length === 0 ? <Card><CardContent className="p-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No Android app users found</p>
            <p className="mt-1 text-xs text-muted-foreground">Website-only accounts are intentionally excluded.</p>
          </CardContent></Card>
          : <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(user => {
              const userInstalls = installsByUser.get(user.user_id) || [];
              const userSessions = sessionsByUser.get(user.user_id) || [];
              const status = getStatus(user.user_id);
              return <Card key={user.user_id} className="min-w-0 overflow-hidden">
                <CardContent className="space-y-3 p-3 sm:p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {user.profile_image_url
                      ? <img src={user.profile_image_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{user.full_name || "Name not available"}</p>
                      <p className="break-all text-xs text-muted-foreground">{user.email || "Email not available"}</p>
                    </div>
                    <Badge variant={status.live ? "default" : status.recent ? "secondary" : "outline"}>
                      {status.live ? "Active Now" : status.recent ? "Recently Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p><span className="text-muted-foreground">Mobile:</span> {user.phone || "Not provided"}</p>
                    <p className="break-words"><span className="text-muted-foreground">Location:</span> {[user.city, user.state, user.location].filter(Boolean).join(", ") || "Not provided"}</p>
                    <p><span className="text-muted-foreground">Account:</span> {user.account_status || "Unknown"}</p>
                    <p className="break-all text-xs text-muted-foreground">User ID: {user.user_id}</p>
                    <p className="text-xs text-muted-foreground">Joined: {user.created_at ? format(new Date(user.created_at), "dd MMM yyyy") : "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">Last app activity: {status.lastSeen ? format(new Date(status.lastSeen), "dd MMM yyyy, hh:mm a") : "No session yet"}</p>
                  </div>

                  <div className="border-t pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" /> Android Devices</span>
                      <Badge variant="outline">{userInstalls.length} total</Badge>
                    </div>
                    {userInstalls.length === 0 ? <p className="text-xs text-muted-foreground">No Android installation registered.</p>
                      : userInstalls.slice(0, 4).map(device => <div key={device.id} className="mb-2 min-w-0 rounded-md bg-muted/50 p-2 text-xs">
                        <p className="break-words font-medium">{device.device_model || "Android device"}</p>
                        <p className="mt-1 break-words text-muted-foreground">{device.os_version || "OS unknown"} · App {device.app_version || "unknown"}</p>
                        <p className="mt-1 flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> Last seen: {format(new Date(device.last_seen_at), "dd MMM yyyy, hh:mm a")}</p>
                      </div>)}
                  </div>

                  <div className="border-t pt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4" /> Recent App Sessions</span>
                      <Badge variant="outline">{userSessions.length}</Badge>
                    </div>
                    {userSessions.length === 0 ? <p className="text-xs text-muted-foreground">Session history will appear after the next app update is installed and opened.</p>
                      : userSessions.slice(0, 3).map(session => <div key={session.session_id} className="mb-2 rounded-md bg-muted/50 p-2 text-xs">
                        <p className="font-medium">{format(new Date(session.started_at), "dd MMM yyyy, hh:mm a")}</p>
                        <p className="mt-1 text-muted-foreground">Last heartbeat: {format(new Date(session.last_seen_at), "hh:mm:ss a")}</p>
                        <p className="text-muted-foreground">{session.ended_at ? "Session ended" : "Session end not received · timeout-based status"}</p>
                      </div>)}
                  </div>
                </CardContent>
              </Card>;
            })}
          </div>}

        <p className="text-xs text-muted-foreground">
          Active Now means a foreground heartbeat within 2 minutes. Recently Active means activity within 24 hours. Session history is retained for 90 days and app installation records for up to 365 days. Signed-in users and anonymous app devices are tracked separately. Website visits and website-only accounts are excluded.
        </p>
      </section>
    </main>
  );
}
