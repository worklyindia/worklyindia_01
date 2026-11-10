import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Loader2, Package, RefreshCw, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Release = {
  id: string; version_code: number; version_name: string; apk_path: string;
  apk_size_bytes: number; release_notes: string; min_supported_version_code: number;
  published_at: string | null; is_published: boolean; created_at: string;
};

const formatSize = (n: number) => n >= 1_000_000
  ? (n / 1_000_000).toFixed(2) + " MB"
  : (n / 1_000).toFixed(2) + " KB";
const formatExactBytes = (n: number) => new Intl.NumberFormat("en-IN").format(n) + " bytes";

// R2 release URLs are stored directly in apk_path. Keep the host allowlist
// narrow so a database value cannot make the Owner Portal open an arbitrary URL.
const isR2ReleaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && ["pub-e8cec40741a24d08bc49bd0c7070f8f3.r2.dev", "downloads.devs.surf"].includes(url.hostname)
      && !url.username && !url.password;
  } catch {
    return false;
  }
};

// GitHub Release assets are the canonical download source for new APK builds.
// Keep R2 URLs recognized only for backwards compatibility with existing records.
const isGitHubReleaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && url.pathname.startsWith("/worklyindia/worklyindia_01/releases/download/android-v")
      && url.pathname.endsWith("/Workly-India.apk")
      && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isExternalReleaseUrl = (value: string) => isGitHubReleaseUrl(value) || isR2ReleaseUrl(value);

export default function AndroidAppUpdates() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingReleaseId, setUpdatingReleaseId] = useState<string | null>(null);
  const [downloadingReleaseId, setDownloadingReleaseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("android_app_releases").select("*")
      .order("version_code", { ascending: false }).limit(100);
    if (error) {
      toast.error("Android releases could not be loaded: " + error.message);
      setReleases([]);
      setLoading(false);
      return;
    }

    let rows = (data || []) as Release[];

    // The database size can be stale or accidentally contain the AAB size.
    // Read the actual APK object so the Owner Portal matches the APK artifact
    // reported by the native Android workflow.
    const sizeCheckIds = new Set(
      rows.filter((release, index) => (index === 0 || release.is_published) && !isExternalReleaseUrl(release.apk_path)).map((release) => release.id)
    );
    rows = await Promise.all(rows.map(async (release) => {
      if (!sizeCheckIds.has(release.id)) return release;
      try {
        const { data: apkBlob, error: apkError } = await supabase.storage
          .from("android-app-releases")
          .download(release.apk_path);
        if (apkError || !apkBlob) {
          console.warn("Could not verify stored APK size:", release.apk_path, apkError);
          return release;
        }
        const actualApkBytes = apkBlob.size;
        if (actualApkBytes !== release.apk_size_bytes) {
          const { error: sizeUpdateError } = await supabase
            .from("android_app_releases")
            .update({ apk_size_bytes: actualApkBytes })
            .eq("id", release.id);
          if (sizeUpdateError) console.warn("Could not save verified APK size:", sizeUpdateError);
        }
        return { ...release, apk_size_bytes: actualApkBytes };
      } catch (sizeError) {
        console.warn("APK size verification failed:", release.apk_path, sizeError);
        return release;
      }
    }));

    // Old unpublished releases are removed automatically by the scheduled R2 cleanup workflow.
    setReleases(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publishRelease = async (release: Release) => {
    if (release.is_published || updatingReleaseId) return;
    if (!window.confirm(`Publish Workly India v${release.version_name} to all users? This will make it the public update and send an Android update notification.`)) return;
    setUpdatingReleaseId(release.id);
    try {
      // Keep the release history. Ensure only the selected version is public.
      const { error: unpublishError } = await supabase.from("android_app_releases")
        .update({ is_published: false, published_at: null }).eq("is_published", true);
      if (unpublishError) throw unpublishError;

      const { error: publishError } = await supabase.from("android_app_releases")
        .update({ is_published: true, published_at: new Date().toISOString() }).eq("id", release.id);
      if (publishError) throw publishError;

      const { data: pushData, error: pushError } = await supabase.functions.invoke("email-api", {
        body: {
          action: "send_android_release_push",
          version_name: release.version_name,
          version_code: release.version_code,
        },
      });
      if (pushError || pushData?.success !== true) {
        console.error("Android release push failed:", pushError, pushData);
        if (pushData?.skipped) {
          toast.warning("The release is public, but Android update notifications are disabled or the template is incomplete.");
        } else if (Number(pushData?.recipients || 0) === 0) {
          toast.warning("The release is public, but no Android devices are registered yet. Users must open the updated app, sign in, and allow notifications before they can receive this alert.");
        } else {
          toast.warning(`The release is public, but push delivery failed. Registered devices: ${Number(pushData?.recipients || 0)}; failed: ${Number(pushData?.failed || 0)}. Check Edge Function logs.`);
        }
      } else {
        const sent = Number(pushData.sent || 0);
        const failed = Number(pushData.failed || 0);
        toast.success(`Workly India v${release.version_name} is public. FCM accepted ${sent} notification(s)${failed ? `; ${failed} failed` : ""}.`);
      }
      await load();
    } catch (error) {
      console.error("Android release publish failed:", error);
      toast.error(error instanceof Error ? error.message : "The Android release could not be published.");
      await load();
    } finally {
      setUpdatingReleaseId(null);
    }
  };

  const unpublishRelease = async (release: Release) => {
    if (!release.is_published || updatingReleaseId) return;
    if (!window.confirm(`Unpublish Workly India v${release.version_name}? New downloads and update checks will no longer see it.`)) return;
    setUpdatingReleaseId(release.id);
    const { error } = await supabase.from("android_app_releases")
      .update({ is_published: false, published_at: null }).eq("id", release.id);
    setUpdatingReleaseId(null);
    if (error) toast.error("The release could not be unpublished: " + error.message);
    else { toast.success(`Workly India v${release.version_name} is now unpublished.`); await load(); }
  };


  const getPreferredDownloadRelease = (release: Release) => {
    if (isExternalReleaseUrl(release.apk_path)) return release;
    // Prefer the public GitHub asset for legacy records. Old Supabase objects
    // can return Object not found even while their metadata remains in the table.
    return releases.find((item) => isGitHubReleaseUrl(item.apk_path)) ?? release;
  };

  const downloadReleaseApk = async (release: Release) => {
    if (downloadingReleaseId) return;
    setDownloadingReleaseId(release.id);
    try {
      const target = getPreferredDownloadRelease(release);
      if (isExternalReleaseUrl(target.apk_path)) {
        window.open(target.apk_path, "_blank", "noopener,noreferrer");
        if (target.id !== release.id) toast.warning("Older APK storage is unavailable. Opening latest uploaded APK v" + target.version_name + " instead.");
        else toast.success("Opening Workly India v" + target.version_name + " APK download.");
        return;
      }
      const filename = "Workly-India-" + target.version_name + "-" + target.version_code + ".apk";
      const { data, error } = await supabase.storage.from("android-app-releases").download(target.apk_path);
      if (error) throw error;
      if (!data) throw new Error("APK file was not returned by storage.");
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      toast.success("Downloading Workly India v" + target.version_name + " APK.");
    } catch (error) {
      console.error("Android APK download failed:", error);
      toast.error(error instanceof Error ? error.message : "The APK could not be downloaded.");
    } finally {
      setDownloadingReleaseId(null);
    }
  };

  const copyReleaseApkLink = async (release: Release) => {
    try {
      const target = getPreferredDownloadRelease(release);
      let downloadUrl = target.apk_path;
      if (!isExternalReleaseUrl(downloadUrl)) {
        const { data, error } = await supabase.storage.from("android-app-releases").createSignedUrl(downloadUrl, 60 * 60 * 24 * 365);
        if (error) throw error;
        if (!data?.signedUrl) throw new Error("A download link could not be created.");
        downloadUrl = data.signedUrl;
      }
      await navigator.clipboard.writeText(downloadUrl);
      if (target.id !== release.id) toast.warning("Older APK is unavailable. Latest uploaded APK v" + target.version_name + " link copied instead.");
      else toast.success("APK download link copied.");
    } catch (error) {
      console.error("APK link copy failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not copy the APK link.");
    }
  };
  const latest = releases[0] ?? null;

  return (
    <main className="w-full min-w-0 max-w-none overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6">
        <header className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Back to Owner Portal" onClick={() => navigate("/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold sm:text-xl">Android Release Management</h1>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Refresh releases" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </header>

        <Card className="w-full min-w-0 overflow-hidden">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg sm:text-xl">
              <Package className="h-5 w-5 shrink-0" />Latest uploaded APK
              {latest && <Badge className="ml-auto shrink-0" variant={latest.is_published ? "default" : "secondary"}>{latest.is_published ? "Public" : "Unpublished"}</Badge>}
            </CardTitle>
            <CardDescription>APK files are hosted on Cloudflare R2; Supabase stores release metadata and the public download link.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Loading Android releases...</div>
              : !latest ? <p className="py-8 text-center text-sm text-muted-foreground">No Android APK has been uploaded yet.</p>
              : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">App version</p><p className="break-all text-xl font-semibold">{latest.version_name}</p></div>
                <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">Version code</p><p className="break-all text-xl font-semibold tabular-nums">{latest.version_code}</p></div>
                <div className="min-w-0 rounded-lg border p-3"><p className="text-xs text-muted-foreground">APK size (same APK as workflow)</p><p className="text-base font-semibold tabular-nums">{formatSize(latest.apk_size_bytes)}</p><p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatExactBytes(latest.apk_size_bytes)}</p></div>
                <div className="min-w-0 rounded-lg border p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">What's new</p><p className="break-words whitespace-pre-wrap text-sm font-medium">{latest.release_notes?.trim() || "No release notes provided for this version."}</p></div>
                <div className="min-w-0 rounded-lg border p-3 sm:col-span-2">
                  <p className="text-xs font-medium">Release availability</p>
                  <p className="mt-1 text-sm text-muted-foreground">{latest.is_published
                    ? "This verified APK is public. Android update checks can now offer it to users."
                    : "This APK is uploaded and verified, but it is still an unpublished draft. Users will not receive this update until you select Make Public."}</p>
                  {isExternalReleaseUrl(latest.apk_path) && <a className="mt-2 inline-flex break-all text-sm font-medium text-primary underline underline-offset-4" href={latest.apk_path} target="_blank" rel="noopener noreferrer">Download latest APK directly</a>}
                </div>
              </div>}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Android app releases</h2>
            <p className="text-sm text-muted-foreground">Publish or unpublish the latest Cloudflare-hosted APK. Only one release can be public at a time.</p>
          </div>
          {loading ? null : releases.length === 0 ? <p className="rounded-lg border p-5 text-center text-sm text-muted-foreground">No app releases found.</p>
            : releases.map((release) => {
              const busy = updatingReleaseId === release.id;
              return (
                <Card key={release.id} className="min-w-0 overflow-hidden">
                  <CardContent className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">Workly India v{release.version_name}</p>
                        <Badge variant={release.is_published ? "default" : "secondary"}>{release.is_published ? "Public" : "Unpublished"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Version code {release.version_code} · {formatSize(release.apk_size_bytes)}</p><p className="text-xs text-muted-foreground tabular-nums">{formatExactBytes(release.apk_size_bytes)}</p>
                      <p className="text-xs text-muted-foreground">Uploaded: {new Date(release.created_at || Date.now()).toLocaleString()}</p>
                      {release.release_notes && <p className="break-words whitespace-pre-wrap pt-1 text-sm text-muted-foreground">{release.release_notes}</p>}
                      {isExternalReleaseUrl(release.apk_path) && <a className="inline-flex break-all pt-1 text-xs font-medium text-primary underline underline-offset-4" href={release.apk_path} target="_blank" rel="noopener noreferrer">Direct APK download link</a>}
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-40">
                      {release.is_published
                        ? <Button variant="destructive" className="w-full" onClick={() => void unpublishRelease(release)} disabled={!!updatingReleaseId}>
                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{busy ? "Updating..." : "Make Unpublished"}
                          </Button>
                        : <Button className="w-full" onClick={() => void publishRelease(release)} disabled={!!updatingReleaseId}>
                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{busy ? "Publishing..." : "Make Public"}
                          </Button>}
                      <Button type="button" variant="outline" className="w-full" onClick={() => void downloadReleaseApk(release)} disabled={!!downloadingReleaseId}>
                        {downloadingReleaseId === release.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{downloadingReleaseId === release.id ? "Preparing APK..." : "Download APK"}
                      </Button>
                      <Button type="button" variant="secondary" className="w-full" onClick={() => void copyReleaseApkLink(release)}>
                        <Copy className="mr-2 h-4 w-4" />Copy Link
                      </Button>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </section>
      </div>
    </main>
  );
}
