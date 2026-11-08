import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Bell, Download, Loader2, Package, RefreshCw, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Release = {
  id: string; version_code: number; version_name: string; apk_path: string;
  apk_size_bytes: number; release_notes: string; min_supported_version_code: number;
  published_at: string | null; is_published: boolean;
};

const BUCKET = "android-app-releases";
const formatSize = (n: number) => n >= 1024 * 1024
  ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

export default function AndroidAppUpdates() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("android_app_releases").select("*")
      .order("version_code", { ascending: false }).limit(10);
    if (error) { toast.error("Android releases could not be loaded: " + error.message); setReleases([]); }
    else setReleases((data || []) as Release[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const downloadUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const latest = releases[0] ?? null;
  const published = releases.find((release) => release.is_published) ?? null;

  const publishLatest = async () => {
    if (!latest || latest.is_published || publishing) return;
    if (!window.confirm(`Publish Workly India v${latest.version_name} to all users? This will make it the public update and send an Android update notification.`)) return;
    setPublishing(true);
    try {
      const { error: publishError } = await supabase.from("android_app_releases")
        .update({ is_published: true, published_at: new Date().toISOString() }).eq("id", latest.id);
      if (publishError) throw publishError;

      // Keep only the newly published APK and release record.
      const { data: oldRows, error: oldError } = await supabase.from("android_app_releases")
        .select("id, apk_path").neq("id", latest.id);
      if (oldError) throw oldError;
      const oldPaths = [...new Set((oldRows || []).map((row) => row.apk_path).filter(Boolean))];
      if (oldPaths.length) {
        const { error } = await supabase.storage.from(BUCKET).remove(oldPaths);
        if (error) throw new Error("The release is published, but older APK files could not be removed: " + error.message);
      }
      if (oldRows?.length) {
        const { error } = await supabase.from("android_app_releases").delete().neq("id", latest.id);
        if (error) throw new Error("The release is published, but older release records could not be removed: " + error.message);
      }

      // Notify registered Android installations only after the owner publishes.
      const { data: template, error: templateError } = await supabase.from("push_lifecycle_templates")
        .select("enabled, title, body, button_text, button_url, image_url")
        .eq("event_type", "android_app_update").maybeSingle();
      if (templateError) throw new Error("Release is published, but the update notification template could not be loaded: " + templateError.message);
      let sent = 0;
      if (template?.enabled && template.title?.trim() && template.body?.trim()) {
        const { data: devices, error: devicesError } = await supabase.from("push_subscriptions")
          .select("user_id").eq("platform", "android").eq("enabled", true);
        if (devicesError) throw new Error("Release is published, but Android recipients could not be loaded: " + devicesError.message);
        const userIds = [...new Set((devices || []).map((device) => device.user_id).filter(Boolean))];
        if (userIds.length) {
          const { data, error } = await supabase.functions.invoke("email-api", {
            body: {
              action: "send_push_raw",
              userIds,
              title: template.title.replace(/\{\{version_name\}\}/g, latest.version_name),
              body: template.body.replace(/\{\{version_name\}\}/g, latest.version_name),
              url: template.button_url || "https://worklyindia.devs.surf/",
              tag: `workly-android-update-${latest.version_code}`,
              image: template.image_url || undefined,
              data: { type: "android_app_update", version_code: String(latest.version_code) },
            },
          });
          if (error || !data?.success) {
            console.error("Android release push failed:", error, data);
            toast.warning("The release is public, but the update push could not be sent. Check notification permissions and function logs.");
          } else sent = Number(data.sent || 0);
        }
      } else {
        toast.warning("The release is public. The Android update notification template is disabled or empty, so no push was sent.");
      }
      toast.success(`Workly India v${latest.version_name} is now public. ${sent} push notification(s) accepted.`);
      await load();
    } catch (error) {
      console.error("Android release publish failed:", error);
      toast.error(error instanceof Error ? error.message : "The Android release could not be published.");
      await load();
    } finally {
      setPublishing(false);
    }
  };

  const unpublishLatest = async () => {
    if (!latest?.is_published || publishing) return;
    if (!window.confirm("Unpublish the current Android release? New downloads and update checks will no longer see it.")) return;
    setPublishing(true);
    const { error } = await supabase.from("android_app_releases")
      .update({ is_published: false, published_at: null }).eq("id", latest.id);
    setPublishing(false);
    if (error) toast.error("The release could not be unpublished: " + error.message);
    else { toast.success("Android release unpublished."); await load(); }
  };

  return (
    <main className="w-full min-w-0 max-w-none overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
        <header className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to Owner Portal" onClick={() => navigate("/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold sm:text-2xl">Android Release Management</h1>
            <p className="text-sm text-muted-foreground">Review, publish, or unpublish the latest Android APK</p>
          </div>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Refresh releases" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </header>

        <Card className="w-full min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg sm:text-xl">
              <Package className="h-5 w-5 shrink-0" />Latest uploaded APK
              {latest && <Badge className="ml-auto shrink-0" variant={latest.is_published ? "default" : "secondary"}>{latest.is_published ? "Public" : "Unpublished"}</Badge>}
            </CardTitle>
            <CardDescription>New Android builds are uploaded as unpublished drafts. Nothing becomes public until you select Publish.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Loading Android releases...</div>
              : !latest ? <p className="py-8 text-center text-sm text-muted-foreground">No Android APK has been uploaded yet.</p>
              : <>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">App version</p><p className="break-all text-xl font-semibold">{latest.version_name}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Version code</p><p className="break-all text-xl font-semibold tabular-nums">{latest.version_code}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">APK size</p><p className="text-base font-semibold">{formatSize(latest.apk_size_bytes)}</p></div>
                  <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Minimum supported code</p><p className="text-base font-semibold tabular-nums">{latest.min_supported_version_code}</p></div>
                </div>
                {latest.release_notes && <section className="min-w-0 rounded-lg border p-3 sm:p-4"><h2 className="mb-2 text-sm font-semibold">Release notes</h2><p className="break-words whitespace-pre-wrap text-sm text-muted-foreground">{latest.release_notes}</p></section>}
                <div className="flex min-w-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-xs text-muted-foreground">Uploaded: {new Date(latest.created_at || Date.now()).toLocaleString()}</p>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.open(downloadUrl(latest.apk_path), "_blank", "noopener,noreferrer")}>
                    <Download className="mr-2 h-4 w-4" />Download APK
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {!latest.is_published
                    ? <Button className="w-full" onClick={() => void publishLatest()} disabled={publishing}><Send className="mr-2 h-4 w-4" />{publishing ? "Publishing..." : "Publish to All Users"}</Button>
                    : <Button variant="destructive" className="w-full" onClick={() => void unpublishLatest()} disabled={publishing}>{publishing ? "Updating..." : "Unpublish Release"}</Button>}
                  <Button variant="outline" className="w-full" onClick={() => navigate("/owner-portal/android-update-notification")}>
                    <Bell className="mr-2 h-4 w-4" />Edit Update Notification
                  </Button>
                </div>
              </>}
          </CardContent>
        </Card>

        {published && !published.id.includes(latest?.id || "__none__") && (
          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base">Currently public release</CardTitle><CardDescription>This version remains available while a newer build is waiting for your approval.</CardDescription></CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6"><p className="font-semibold">Workly India v{published.version_name}</p><p className="text-xs text-muted-foreground">Version code {published.version_code}</p></CardContent>
          </Card>
        )}
        <p className="px-1 text-xs text-muted-foreground">Only an owner can publish or unpublish an Android release. Publishing sends an update alert to registered Android devices.</p>
      </div>
    </main>
  );
}
