import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Smartphone, ShieldCheck } from "lucide-react";

type Release = {
  version_name: string;
  version_code: number;
  apk_path: string;
  apk_size_bytes: number;
  release_notes: string | null;
  published_at: string | null;
};

const trustedUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev", "downloads.devs.surf"].includes(url.hostname) &&
      url.pathname.startsWith("/chatwork/releases/chatwork-v") &&
      url.pathname.endsWith("/ChatWork.apk") && !url.username && !url.password;
  } catch { return false; }
};

export default function ChatWorkDownloadPage() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await (supabase as any)
        .from("chatwork_app_releases")
        .select("version_name,version_code,apk_path,apk_size_bytes,release_notes,published_at")
        .eq("is_published", true).order("version_code", { ascending: false }).limit(1).maybeSingle();
      if (queryError) throw queryError;
      if (data && !trustedUrl(data.apk_path)) throw new Error("The published APK link did not pass URL verification.");
      setRelease(data as Release | null);
    } catch (e) {
      console.error("ChatWork public release lookup failed:", e);
      setError("The latest ChatWork release could not be loaded. Please try again.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const download = () => {
    if (!release || preparing) return;
    setPreparing(true);
    window.location.assign(release.apk_path);
    window.setTimeout(() => setPreparing(false), 1800);
  };
  const size = release ? (release.apk_size_bytes / 1_000_000).toFixed(1) + " MB" : "—";

  return <>
    <Helmet>
      <title>ChatWork for Android – Official APK Download</title>
      <meta name="description" content="Download the latest official ChatWork Android app update." />
      <link rel="canonical" href="https://worklyindia.devs.surf/chatwork-download" />
      <meta name="robots" content="index,follow" />
    </Helmet>
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/icons/icon-192x192.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
          <span className="text-lg font-semibold">ChatWork</span>
          <Badge variant="outline" className="ml-auto">Official Android app</Badge>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">ChatWork for Android</h1>
          <p className="mt-3 text-muted-foreground">Offline AI voice, text-to-speech and connected Workly India services.</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Official release · Verified APK
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
            {loading ? <div className="flex items-center justify-center gap-2 py-5 text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Checking latest version…</div>
            : error ? <div className="space-y-3 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div>
            : release ? <>
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">LATEST PUBLIC VERSION</p><p className="mt-1 text-2xl font-bold">v{release.version_name}</p></div>
                <Badge>Latest</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground"><span>{size}</span><span>Build {release.version_code}</span>{release.published_at ? <span>{new Date(release.published_at).toLocaleDateString()}</span> : null}</div>
              {release.release_notes ? <div className="mt-4 border-t border-border pt-4"><p className="text-sm font-semibold">What's new</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{release.release_notes}</p></div> : null}
              <Button className="mt-6 h-12 w-full rounded-full text-base" onClick={download} disabled={preparing}>
                <Download className="mr-2 h-5 w-5" />{preparing ? "Preparing download…" : "Download ChatWork APK"}
              </Button>
            </> : <div className="py-5 text-center"><p className="font-semibold">No public update yet</p><p className="mt-2 text-sm text-muted-foreground">The next ChatWork APK will appear here after the owner publishes it.</p></div>}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Android may ask you to allow installation from this source. Confirm the installer prompt to complete the update.</p>
        </div>
      </section>
    </main>
  </>;
}
