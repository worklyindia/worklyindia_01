import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Loader2, Package, RefreshCw, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Release = {
  id: string; version_code: number; version_name: string; apk_path: string;
  apk_size_bytes: number; release_notes: string; is_published: boolean;
  min_supported_version_code: number; created_at: string; published_at: string | null;
};

const BUCKET = "android-app-releases";
const formatSize = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default function AndroidAppUpdates() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [apk, setApk] = useState<File | null>(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [minVersion, setMinVersion] = useState("1");
  const [notes, setNotes] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [buildMetadata, setBuildMetadata] = useState<{ version_name: string; version_code: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/android-app-build-info.json", { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("Build metadata not found"); return response.json(); })
      .then(info => {
        if (!active) return;
        setBuildMetadata(info);
        setVersionName(String(info.version_name || ""));
        setVersionCode(String(info.version_code || ""));
        setMinVersion(String(info.min_supported_version_code || 1));
        setNotes(String(info.release_notes || "Performance improvements and bug fixes."));
      })
      .catch(() => { if (active) toast.error("Auto version details load nahi hue. Android build config check karein."); })
      .finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, []);

  const copyReleaseDetails = async () => {
    const details = ["Version name: " + versionName, "Version code: " + versionCode, "Minimum supported version code: " + minVersion, "Release notes: " + notes].join("\n");
    try { await navigator.clipboard.writeText(details); toast.success("Release details copy ho gaye."); }
    catch { toast.error("Copy nahi hua. Fields manually copy karein."); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("android_app_releases")
      .select("*").order("version_code", { ascending: false });
    if (error) toast.error(error.message);
    else setReleases((data || []) as Release[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const uploadRelease = async () => {
    if (!apk || !versionName.trim() || !/^\d+$/.test(versionCode) || Number(versionCode) <= 0) {
      toast.error("APK, version name aur valid version code enter karein.");
      return;
    }
    if (!apk.name.toLowerCase().endsWith(".apk") || apk.size > 200 * 1024 * 1024) {
      toast.error("Sirf APK file (maximum 200 MB) upload karein.");
      return;
    }
    setUploading(true);
    try {
      const path = `releases/${versionCode}-${Date.now()}.apk`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, apk, {
        contentType: "application/vnd.android.package-archive", upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("android_app_releases").insert({
        version_code: Number(versionCode), version_name: versionName.trim(), apk_path: path,
        apk_size_bytes: apk.size, release_notes: notes.trim(),
        min_supported_version_code: Number(minVersion) || 1, created_by: userData.user?.id,
        is_published: false,
      });
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
      toast.success("APK upload ho gaya. Publish karne ke baad app users ko update milega.");
      setApk(null); setVersionName(""); setVersionCode(""); setNotes("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "APK upload failed");
    } finally { setUploading(false); }
  };

  const publish = async (release: Release) => {
    const { error: unpublishError } = await supabase.from("android_app_releases")
      .update({ is_published: false }).eq("is_published", true);
    if (unpublishError) return toast.error(unpublishError.message);
    const { error } = await supabase.from("android_app_releases")
      .update({ is_published: true, published_at: new Date().toISOString() }).eq("id", release.id);
    if (error) toast.error(error.message);
    else { toast.success(`Version ${release.version_name} publish ho gaya`); await load(); }
  };

  const unpublish = async (release: Release) => {
    const { error } = await supabase.from("android_app_releases")
      .update({ is_published: false }).eq("id", release.id);
    if (error) toast.error(error.message);
    else { toast.success("Release unpublish ho gaya"); await load(); }
  };

  const deleteRelease = async (release: Release) => {
    const confirmed = window.confirm(`Version ${release.version_name} (code ${release.version_code}) permanently delete karein? Published release delete karne se direct APK users ko update feed nahi milega.`);
    if (!confirmed) return;
    const { error: rowError } = await supabase.from("android_app_releases").delete().eq("id", release.id);
    if (rowError) {
      toast.error(rowError.message);
      return;
    }
    const { error: fileError } = await supabase.storage.from(BUCKET).remove([release.apk_path]);
    if (fileError) {
      toast.error("Release record delete ho gaya, lekin APK storage cleanup fail hua: " + fileError.message);
    } else {
      toast.success(`Version ${release.version_name} delete ho gaya`);
    }
    await load();
  };

  const downloadUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate("/owner-portal")}><ArrowLeft className="h-5 w-5" /></Button>
      <div className="min-w-0 flex-1"><h1 className="text-2xl font-bold">Android App Updates</h1><p className="text-sm text-muted-foreground">Play Store aur direct APK releases manage karein</p></div>
      <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload new APK</CardTitle>
        <CardDescription>Signed APK upload karein. Version details Android build configuration se automatically aayengi. APK isi build ki honi chahiye. Same application ID aur same signing key required hai. Maximum 200 MB.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>APK file</Label><Input type="file" accept=".apk,application/vnd.android.package-archive" onChange={e => setApk(e.target.files?.[0] || null)} /></div>
        <div className="space-y-2"><Label>Version name</Label><Input placeholder="Auto-filled from Android build" value={versionName} onChange={e => setVersionName(e.target.value)} /><p className="text-xs text-muted-foreground">App ka display version {metadataLoading ? "· Loading..." : buildMetadata ? "· Auto-filled" : "· Manual entry required"}</p></div>
        <div className="space-y-2"><Label>Version code</Label><Input type="number" min="1" placeholder="Auto-filled from Android build" value={versionCode} onChange={e => setVersionCode(e.target.value)} /><p className="text-xs text-muted-foreground">Har nayi release par previous code se bada hona chahiye.</p></div>
        <div className="space-y-2"><Label>Minimum supported version code</Label><Input type="number" min="1" value={minVersion} onChange={e => setMinVersion(e.target.value)} /><p className="text-xs text-muted-foreground">Isse purane app versions ko update karna mandatory hoga. Default 1 = sab purane versions allowed.</p></div>
        <div className="space-y-2 md:col-span-2"><Label>Release notes</Label><Textarea rows={3} placeholder="What's new in this version?" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <div className="md:col-span-2"><Button type="button" variant="outline" onClick={() => void copyReleaseDetails()} disabled={!versionName || !versionCode}><Copy className="mr-2 h-4 w-4" /> Copy all release details</Button></div>
        <div className="md:col-span-2"><Button onClick={() => void uploadRelease()} disabled={uploading || !apk} className="w-full sm:w-auto">{uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="mr-2 h-4 w-4" /> Upload APK</>}</Button></div>
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Release history</CardTitle><CardDescription>Ek waqt mein ek hi direct APK release published rakhein.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading releases...</div> :
          releases.length === 0 ? <p className="text-sm text-muted-foreground">Abhi koi APK release upload nahi hui.</p> :
          releases.map(release => <div key={release.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>Version {release.version_name}</strong><Badge variant={release.is_published ? "default" : "secondary"}>{release.is_published ? "Published" : "Draft"}</Badge></div>
              <p className="text-xs text-muted-foreground">Code {release.version_code} · {formatSize(release.apk_size_bytes)} · {new Date(release.created_at).toLocaleString()}</p>
              {release.release_notes && <p className="mt-2 whitespace-pre-wrap text-sm">{release.release_notes}</p>}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(downloadUrl(release.apk_path), "_blank", "noopener,noreferrer")}><Download className="mr-2 h-4 w-4" /> APK</Button>
              {release.is_published ? <Button size="sm" variant="secondary" onClick={() => void unpublish(release)}>Unpublish</Button> : <Button size="sm" onClick={() => void publish(release)}>Publish</Button>}
              <Button size="sm" variant="destructive" onClick={() => void deleteRelease(release)} aria-label={`Delete version ${release.version_name}`}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            </div>
          </div>)}
      </CardContent></Card>
    <p className="text-xs text-muted-foreground">Play Store installs use Google Play updates. Direct APK installs use the Workly release feed. Android will always ask the user to approve installation from this source when required.</p>
  </div>;
}
