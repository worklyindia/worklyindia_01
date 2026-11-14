import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Search, Smartphone, Users, UserRound, Clock } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

type ProfileRow = {
 user_id:string; full_name:string|null; email:string|null; phone:string|null;
 profile_image_url:string|null; location:string|null; city:string|null; state:string|null;
 created_at:string|null; account_status:string|null; user_type:string|null;
};
type InstallRow = {id:string;user_id:string;installation_id:string;platform:string;device_model:string|null;os_version:string|null;app_version:string|null;last_seen_at:string;created_at:string};

export default function AppUserDetails() {
 const navigate=useNavigate();
 const [users,setUsers]=useState<ProfileRow[]>([]);
 const [installs,setInstalls]=useState<InstallRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);
  const [u,i]=await Promise.all([
   supabase.rpc("get_owner_app_user_details"),
   supabase.from("app_installations").select("*").order("last_seen_at",{ascending:false}).limit(10000)
  ]);
  if(u.error) toast.error("Unable to load user profiles: "+u.error.message);
  if(i.error) toast.error("Unable to load installation details: "+i.error.message);
  setUsers((u.data||[]) as ProfileRow[]);
  setInstalls((i.data||[]) as InstallRow[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 const active=useMemo(()=>installs.filter(x=>new Date(x.last_seen_at).getTime()>=subDays(new Date(),30).getTime()),[installs]);
 const filtered=useMemo(()=>users.filter(u=>[u.full_name,u.email,u.phone,u.user_id,u.city,u.state,u.location].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))),[users,search]);
 const activeByUser=new Map<string,number>(); active.forEach(x=>activeByUser.set(x.user_id,(activeByUser.get(x.user_id)||0)+1));
 return <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground">
  <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur"><div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-3 px-3 py-3 sm:px-6"><Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to Owner Portal" onClick={()=>navigate("/owner-portal")}><ArrowLeft className="h-5 w-5"/></Button><div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold sm:text-2xl">App User Details</h1><p className="hidden text-xs text-muted-foreground sm:block">User profiles and registered app installations</p></div><Button variant="outline" size="icon" className="shrink-0" onClick={()=>void load()} disabled={loading} aria-label="Refresh user details"><RefreshCw className={loading?"h-4 w-4 animate-spin":"h-4 w-4"}/></Button></div></header>
  <section className="mx-auto w-full max-w-7xl min-w-0 space-y-4 px-3 py-4 sm:px-6 sm:py-6">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Registered Users</p><p className="mt-1 text-2xl font-bold tabular-nums">{users.length}</p></CardContent></Card><Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Active Installations</p><p className="mt-1 text-2xl font-bold tabular-nums">{active.length}</p></CardContent></Card><Card className="col-span-2 sm:col-span-1"><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Users With Active App</p><p className="mt-1 text-2xl font-bold tabular-nums">{activeByUser.size}</p></CardContent></Card></div>
   <Card><CardContent className="p-3 sm:p-4"><div className="relative min-w-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, phone or user ID..."/></div></CardContent></Card>
   {loading?<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading app user details...</CardContent></Card>:filtered.length===0?<Card><CardContent className="p-8 text-center"><Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground"/><p className="font-medium">No users found</p></CardContent></Card>:
   <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(u=>{
    const userInstalls=installs.filter(x=>x.user_id===u.user_id);
    const live=userInstalls.filter(x=>new Date(x.last_seen_at).getTime()>=subDays(new Date(),30).getTime());
    return <Card key={u.user_id} className="min-w-0 overflow-hidden"><CardContent className="space-y-3 p-3 sm:p-4">
     <div className="flex min-w-0 items-start gap-3">{u.profile_image_url?<img src={u.profile_image_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover"/>:<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-5 w-5"/></div>}<div className="min-w-0 flex-1"><p className="break-words font-semibold">{u.full_name||"Name not available"}</p><p className="break-all text-xs text-muted-foreground">{u.email||"Email not available"}</p></div><Badge variant={live.length?"default":"secondary"}>{live.length?"Active":"No active app"}</Badge></div>
     <div className="space-y-1.5 text-sm"><p className="break-all"><span className="text-muted-foreground">Mobile:</span> {u.phone||"Not provided"}</p><p className="break-words"><span className="text-muted-foreground">Location:</span> {[u.city,u.state,u.location].filter(Boolean).join(", ")||"Not provided"}</p><p><span className="text-muted-foreground">Account:</span> {u.account_status||"Unknown"} · {u.user_type||"User"}</p><p className="break-all text-xs text-muted-foreground">User ID: {u.user_id}</p><p className="text-xs text-muted-foreground">Joined: {u.created_at?format(new Date(u.created_at),"dd MMM yyyy"):"Unknown"}</p></div>
     <div className="border-t pt-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4"/> App Installations</span><Badge variant="outline">{live.length} active / {userInstalls.length} total</Badge></div>
      {userInstalls.length===0?<p className="text-xs text-muted-foreground">No installation has been registered for this account yet.</p>:userInstalls.slice(0,5).map(x=><div key={x.id} className="mb-2 min-w-0 rounded-md bg-muted/50 p-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{x.device_model||x.platform||"App device"}</span><Badge variant={live.some(a=>a.id===x.id)?"default":"secondary"}>{live.some(a=>a.id===x.id)?"Active":"Inactive"}</Badge></div><p className="mt-1 break-words text-muted-foreground">{x.os_version||"OS unknown"} · App {x.app_version||"unknown"}</p><p className="mt-1 flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3"/> Last seen: {format(new Date(x.last_seen_at),"dd MMM yyyy, hh:mm a")}</p></div>)}
     </div>
    </CardContent></Card>
   })}</div>}
   <p className="text-xs text-muted-foreground">An installation is considered active when it checks in within the last 30 days. Inactive installation records are automatically purged after 30 days. User profile and account records are not deleted by this cleanup.</p>
  </section>
 </main>;
}
