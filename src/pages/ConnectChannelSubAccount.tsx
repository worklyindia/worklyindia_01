import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Facebook, Instagram, Loader2, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

/** Shared with the OAuth return pages so they can hand the code back here. */
export const SUB_CONNECT_KEY = "wsub_connect";

const META = {
  instagram: { channel: "instagram", title: "Instagram", Icon: Instagram, button: "Continue with Instagram" },
  facebook: { channel: "facebook", title: "Facebook Page", Icon: Facebook, button: "Continue with Facebook" },
  gmail: { channel: "gmail", title: "Gmail", Icon: Mail, button: "Continue with Google" },
  outlook: { channel: "outlook", title: "Outlook", Icon: Mail, button: "Continue with Microsoft" },
  email: { channel: "domain_email", title: "Domain Email", Icon: Mail, button: "Connect email" },
} as const;
type Key = keyof typeof META;

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("workly-india", { body: { scope: "sub_connect", ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const parsed = ctx ? await ctx.json().catch(() => null) : null;
    return parsed ?? { success: false, error: error.message };
  }
  return data;
}

/** Hosted page a developer's customer opens (one-time link) to connect Instagram, Facebook, Gmail, Outlook or domain email. */
export default function ConnectChannelSubAccount() {
  const { channel: slug = "" } = useParams();
  const [params] = useSearchParams();
  const cfg = META[slug as Key];
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SUB_CONNECT_KEY) || "{}"); } catch { return {}; } })();
  const code = params.get("code");
  const token = params.get("token") || (code ? saved.token : "") || "";
  const [info, setInfo] = useState<{ developer_name: string | null; cancel_url: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [form, setForm] = useState({ email: "", password: "", imapHost: "", imapPort: "993", smtpHost: "", smtpPort: "465" });
  const ran = useRef(false);

  const finish = (res: any) => {
    if (res?.success) setDone(res.label || "Your account");
    else setError(res?.error || "Connection failed");
    if (res?.redirect_url) setTimeout(() => { window.location.href = res.redirect_url; }, 1500);
  };

  useEffect(() => {
    if (!cfg) return;
    document.title = `Connect ${cfg.title} | Workly India`;
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!token) { setError("This link is not valid."); return; }
      const res = await call({ action: "session_info", token });
      if (!res?.success) { setError(res?.error || "This link is not valid."); return; }
      if (res.channel !== cfg.channel) { setError("This link is for a different account type."); return; }
      setInfo(res);
      const err = params.get("error_description") || params.get("error");
      if (code || err) {
        sessionStorage.removeItem(SUB_CONNECT_KEY);
        if (err) { setError(err); return; }
        if (slug !== "gmail" && saved.state && params.get("state") && saved.state !== params.get("state")) { setError("Session expired. Please open the link again."); return; }
        setBusy(true);
        finish(await call({ action: "complete", token, code, origin: window.location.origin }));
        setBusy(false);
      }
    })();
  }, [cfg, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true); setError("");
    const res = await call({ action: "start", token, origin: window.location.origin });
    if (!res?.success) { setBusy(false); setError(res?.error || "Could not start login"); return; }
    sessionStorage.setItem(SUB_CONNECT_KEY, JSON.stringify({ token, slug, state: res.state }));
    window.location.href = res.url;
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    finish(await call({ action: "complete", token, ...form, imapPort: Number(form.imapPort), smtpPort: Number(form.smtpPort) }));
    setBusy(false);
  };

  if (!cfg) return <main className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">Page not found</main>;
  const { Icon } = cfg;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        {done ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">{cfg.title} connected</h1>
            <p className="mt-2 text-sm text-muted-foreground">{done} is connected. Taking you back…</p>
          </>
        ) : (!info && !error) || (busy && code) ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : !info ? (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Link not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Icon className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Connect your {cfg.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {info.developer_name ? <><b className="text-foreground">{info.developer_name}</b> wants to use your {cfg.title} account.</> : `Connect your ${cfg.title} account to continue.`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">No Workly India account needed. Powered by Workly India.</p>
            {error && <p className="mt-4 text-sm text-destructive break-words">{error}</p>}
            {slug === "email" ? (
              <form onSubmit={submitEmail} className="mt-6 space-y-3 text-left">
                <div><Label htmlFor="em">Email address</Label><Input id="em" type="email" required value={form.email} onChange={set("email")} /></div>
                <div><Label htmlFor="pw">Password / app password</Label><Input id="pw" type="password" required value={form.password} onChange={set("password")} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><Label htmlFor="ih">IMAP server</Label><Input id="ih" required placeholder="imap.yourdomain.com" value={form.imapHost} onChange={set("imapHost")} /></div>
                  <div><Label htmlFor="ip">Port</Label><Input id="ip" inputMode="numeric" value={form.imapPort} onChange={set("imapPort")} /></div>
                  <div className="col-span-2"><Label htmlFor="sh">SMTP server</Label><Input id="sh" required placeholder="smtp.yourdomain.com" value={form.smtpHost} onChange={set("smtpHost")} /></div>
                  <div><Label htmlFor="sp">Port</Label><Input id="sp" inputMode="numeric" value={form.smtpPort} onChange={set("smtpPort")} /></div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.button}</Button>
              </form>
            ) : (
              <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={start}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.button}
              </Button>
            )}
            <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => { window.location.href = info.cancel_url; }}>Cancel</Button>
          </>
        )}
      </div>
    </main>
  );
}
