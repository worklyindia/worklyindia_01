import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Package, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Release = {
  id: string; version_code: number; version_name: string; apk_path: string;
  apk_size_bytes: number; release_notes: string; min_supported_version_code: number;
  published_at: string | null;
};

const BUCKET = "android-app-releases";
const formatSize = (n: number) => n >= 1024 * 1024
  ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

export default function AndroidAppUpdates() {
  const navigate = useNavigate();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("android_app_releases").select("*")
      .eq("is_published", true).order("version_code", { ascending: false })
      .limit(1).maybeSingle();
    if (error) { toast.error("Latest Android release load nahi hui: " + error.message); setRelease(null); }
    else setRelease(data as Release | null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const downloadUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return (
    <main className="w-full min-w-0 max-w-none overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
        <header className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to Owner Portal" onClick={() => navigate("/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold sm:text-2xl">Android Release History</h1>
            <p className="text-sm text-muted-foreground">Latest published Workly India Android app</p>
          </div>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Refresh release" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </header>
        <Card className="w-full min-w-0 overflow-hidden">
          <CardHeader className="space-y-1 p-4 sm:p-6">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg sm:text-xl">
              <Package className="h-5 w-5 shrink-0" /><span className="break-words">Current app release</span>
              <Badge className="ml-auto shrink-0">Latest</Badge>
            </CardTitle>
            <CardDescription>Yahan sirf latest published APK dikhayi jayegi. Nayi successful release publish hone par purani APK aur uska record automatically clean ho jayega.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Latest release load ho rahi hai...</div>
              : !release ? <p className="py-8 text-center text-sm text-muted-foreground">Abhi koi published Android release available nahi hai.</p>
              : <>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">App version</p><p className="break-all text-xl font-semibold">{release.version_name}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Version code</p><p className="break-all text-xl font-semibold tabular-nums">{release.version_code}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">APK size</p><p className="text-base font-semibold">{formatSize(release.apk_size_bytes)}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Minimum supported code</p><p className="text-base font-semibold tabular-nums">{release.min_supported_version_code}</p></div>
                </div>
                {release.release_notes && <section className="min-w-0 rounded-lg border p-3 sm:p-4"><h2 className="mb-2 text-sm font-semibold">What's new</h2><p className="break-words whitespace-pre-wrap text-sm text-muted-foreground">{release.release_notes}</p></section>}
                <div className="flex min-w-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-xs text-muted-foreground">Published: {release.published_at ? new Date(release.published_at).toLocaleString() : "—"}</p>
                  <Button className="w-full shrink-0 sm:w-auto" onClick={() => window.open(downloadUrl(release.apk_path), "_blank", "noopener,noreferrer")}>
                    <Download className="mr-2 h-4 w-4" />Download latest APK
                  </Button>
                </div>
              </>}
          </CardContent>
        </Card>
        <p className="px-1 text-xs text-muted-foreground">Android installation ke waqt device par zaroori permission aur user approval maangega.</p>
      </div>
    </main>
  );
}
