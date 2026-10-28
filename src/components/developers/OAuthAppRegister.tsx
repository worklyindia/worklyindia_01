import { confirmDialog } from '@/lib/confirmDialog';
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Download, KeyRound, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { downloadOAuthCredentialsPdf } from "@/lib/oauthCredentialsPdf";

type App = { id: string; client_id: string; client_name: string; redirect_uris: string[]; client_type: string; created_at: string };
type Credentials = { app_name: string; redirect_uris: string[]; client_id: string; client_secret?: string };

async function request(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first");
  const response = await fetch("https://jubwzelupbntbetpajqb.supabase.co/functions/v1/email-api/developer-oauth-apps", {
    method: "POST", headers: { "Content-Type": "application/json", "x-developer-oauth-apps": "1", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <span className="min-w-0 flex-1 break-all font-mono text-sm">{value}</span>
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title={`Copy ${label}`} aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(value); toast.success("Copied"); } catch { toast.error("Could not copy"); } }}><Copy className="h-4 w-4" /></Button>
    </div>
  </div>;
}

function parseUris(input: string) {
  const uris = input.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  if (!uris.length || uris.length > 10) throw new Error("Enter 1–10 redirect URLs");
  for (const uri of uris) {
    let url: URL;
    try { url = new URL(uri); } catch { throw new Error(`Invalid URL: ${uri}`); }
    if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error(`Use HTTPS or localhost HTTP: ${uri}`);
  }
  return uris;
}

export default function OAuthAppRegister() {
  const [sheet, setSheet] = useState<"create" | "manage" | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [name, setName] = useState("");
  const [redirect, setRedirect] = useState("");
  const [type, setType] = useState<"confidential" | "public">("confidential");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const load = useCallback(async () => {
    try { const data = await request("list"); setApps(data.apps || []); }
    catch (e) { toast.error((e as Error).message); }
  }, []);
  useEffect(() => { if (sheet) void load(); }, [sheet, load]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try { await task(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    if (name.trim().length < 2) throw new Error("Enter an app name");
    const appName = name.trim();
    const uris = parseUris(redirect);
    const result = await request("create", { client_name: appName, redirect_uris: uris, client_type: type });
    const createdCredentials = { app_name: appName, redirect_uris: uris, client_id: result.client_id, client_secret: result.client_secret };
    setCredentials(createdCredentials);
    downloadOAuthCredentialsPdf({ appName, redirectUris: uris, clientId: result.client_id, clientSecret: result.client_secret });
    setName(""); setRedirect("");
    await load(); toast.success("OAuth app created");
  });
  const edit = (app: App) => { setSelected(app.id); setName(app.client_name); setRedirect(app.redirect_uris.join("\n")); };
  const save = () => run(async () => {
    if (!selected || name.trim().length < 2) throw new Error("Enter an app name");
    await request("update", { id: selected, client_name: name.trim(), redirect_uris: parseUris(redirect) });
    setSelected(null); setName(""); setRedirect("");
    await load(); toast.success("OAuth app updated");
  });
  const remove = async (app: App) => {
    if (!await confirmDialog(`Delete ${app.client_name}? Login through this app will stop working.`)) return;
    void run(async () => { await request("delete", { id: app.id }); if (selected === app.id) setSelected(null); setCredentials(null); await load(); toast.success("App deleted"); });
  };
  const contentClass = "inset-0 h-[100dvh] max-h-none w-full overflow-y-auto rounded-none border-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-2xl";
  return <>
    <div className="flex flex-col gap-2 sm:w-fit">
      <Button className="gap-2" onClick={() => { setCredentials(null); setSelected(null); setSheet("create"); }}><Plus className="h-4 w-4" />Create OAuth App</Button>
      <Button variant="outline" className="gap-2" onClick={() => { setSelected(null); setSheet("manage"); }}><KeyRound className="h-4 w-4" />Manage OAuth App</Button>
    </div>
    <Sheet open={sheet === "create"} onOpenChange={(open) => { if (!open && sheet === "create") setSheet(null); }}>
      <SheetContent side="bottom" className={`${contentClass} [&>button]:hidden`}>
        <SheetHeader className="text-left"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Back to Developer Portal" onClick={() => setSheet(null)}><ArrowLeft className="h-5 w-5" /></Button><SheetTitle>Create OAuth App</SheetTitle></div><SheetDescription>Add your website and its exact login return URL.</SheetDescription></SheetHeader>
        <div className="mt-5 space-y-4">
          {!credentials ? <>
            <div className="space-y-1.5"><Label htmlFor="oauth-name">App name</Label><Input id="oauth-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="My Website" /></div>
            <div className="space-y-1.5"><Label htmlFor="oauth-url">Redirect URL</Label><Input id="oauth-url" value={redirect} onChange={e => setRedirect(e.target.value)} placeholder="https://yourwebsite.com/auth/callback" /><p className="text-xs text-muted-foreground">For several URLs, separate with commas. HTTPS required except localhost.</p></div>
            <div className="space-y-1.5"><Label>App type</Label><div className="grid grid-cols-2 gap-2">{(["confidential", "public"] as const).map(t => <Button key={t} variant={type === t ? "default" : "outline"} onClick={() => setType(t)} className="h-auto flex-col py-2"><span className="capitalize">{t}</span><span className="text-xs font-normal opacity-80">{t === "confidential" ? "Server website, has secret" : "SPA / mobile, PKCE"}</span></Button>)}</div></div>
            <Button className="w-full" disabled={busy} onClick={create}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create app</Button>
          </> : <><Field label="client_id" value={credentials.client_id} />{credentials.client_secret && <Field label="client_secret" value={credentials.client_secret} />}{credentials.client_secret && <p className="text-sm text-destructive">Save the secret securely. It is available here only until this page is refreshed.</p>}<Button className="w-full gap-2" onClick={() => downloadOAuthCredentialsPdf({ appName: credentials.app_name, redirectUris: credentials.redirect_uris, clientId: credentials.client_id, clientSecret: credentials.client_secret })}><Download className="h-4 w-4" />Download PDF</Button><Button variant="outline" className="w-full" onClick={() => setSheet("manage")}>Manage OAuth App</Button></>}
        </div>
      </SheetContent>
    </Sheet>
    <Sheet open={sheet === "manage"} onOpenChange={(open) => { if (!open && sheet === "manage") { setSheet(null); setSelected(null); } }}>
      <SheetContent side="bottom" className={`${contentClass} [&>button]:hidden`}>
        <SheetHeader className="text-left"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Back to Developer Portal" onClick={() => setSheet(null)}><ArrowLeft className="h-5 w-5" /></Button><SheetTitle>Manage OAuth App</SheetTitle></div><SheetDescription>View your app IDs and update login settings.</SheetDescription></SheetHeader>
        <div className="mt-5 space-y-4">
          {apps.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No OAuth apps yet.</p>}
          {apps.map(app => <div key={app.id} className="space-y-3 border-b border-border pb-4 last:border-0">
            <div className="flex items-center justify-between gap-2"><h3 className="min-w-0 break-words font-medium">{app.client_name}</h3><span className="shrink-0 text-xs capitalize text-muted-foreground">{app.client_type}</span></div>
            <Field label="client_id" value={app.client_id} />
            {app.client_type === "confidential" && (credentials?.client_id === app.client_id && credentials.client_secret ? <><Field label="client_secret" value={credentials.client_secret} /><p className="text-xs text-muted-foreground">Available until you refresh this page. Store it securely.</p></> : <p className="text-xs text-muted-foreground">client_secret cannot be retrieved after creation. Use your saved copy.</p>)}
            {selected === app.id ? <div className="space-y-3"><div className="space-y-1"><Label htmlFor={`name-${app.id}`}>App name</Label><Input id={`name-${app.id}`} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></div><div className="space-y-1"><Label htmlFor={`url-${app.id}`}>Redirect URLs</Label><Input id={`url-${app.id}`} value={redirect} onChange={e => setRedirect(e.target.value)} /></div><div className="grid grid-cols-2 gap-2"><Button className="w-full" disabled={busy} onClick={save}>Save changes</Button><Button className="w-full" variant="outline" onClick={() => setSelected(null)}>Cancel</Button></div></div> : <>{app.redirect_uris.map(u => <Field key={u} label="redirect_uri" value={u} />)}<div className="grid grid-cols-2 gap-2"><Button size="sm" className="w-full" variant="outline" title="Edit app" onClick={() => edit(app)} disabled={busy}><Pencil className="mr-2 h-4 w-4" />Edit</Button><Button size="sm" className="w-full" variant="destructive" title="Delete app" disabled={busy} onClick={() => remove(app)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div></>}
          </div>)}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
