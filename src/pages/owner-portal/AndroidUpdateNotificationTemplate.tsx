import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Bell, Save } from "lucide-react";

const EVENT = "android_app_update";

export default function AndroidUpdateNotificationTemplate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("Workly India update v{{version_name}}");
  const [body, setBody] = useState("A new version of the Workly India app is available. Update now to get the latest improvements and fixes.");
  const [buttonText, setButtonText] = useState("View Update");
  const [buttonUrl, setButtonUrl] = useState("https://worklyindia.devs.surf/");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("push_lifecycle_templates").select("*").eq("event_type", EVENT).maybeSingle();
      if (error) toast.error("Notification template could not be loaded: " + error.message);
      if (data) {
        setTitle(data.title || "");
        setBody(data.body || "");
        setButtonText(data.button_text || "");
        setButtonUrl(data.button_url || "https://worklyindia.devs.surf/");
        setEnabled(data.enabled !== false);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const save = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and message are required.");
    if (buttonUrl.trim() && !/^https:\/\//i.test(buttonUrl.trim()) && !buttonUrl.trim().startsWith("/")) {
      return toast.error("Enter a valid HTTPS URL or an app path.");
    }
    setSaving(true);
    const { error } = await supabase.from("push_lifecycle_templates").upsert({
      event_type: EVENT,
      enabled,
      title: title.trim(),
      body: body.trim(),
      button_text: buttonText.trim(),
      button_url: buttonUrl.trim() || "/",
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_type" });
    setSaving(false);
    if (error) toast.error("Notification template could not be saved: " + error.message);
    else toast.success("Android update notification template saved.");
  };

  return (
    <main className="w-full min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/owner-portal/android-app-updates")} aria-label="Back to Android releases"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">Android Update Notification</h1><p className="text-sm text-muted-foreground">Edit the push notification sent when you publish an Android release.</p></div>
        </header>
        <Card>
          <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5" />Push notification template</CardTitle><CardDescription>This message is sent only after you manually publish a new APK. Use {"{{version_name}}"} to insert the release version.</CardDescription></CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {loading ? <p className="text-sm text-muted-foreground">Loading template...</p> : <>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="text-sm font-medium">Enable update notifications</p><p className="text-xs text-muted-foreground">Turn off to publish releases without sending push notifications.</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
              <div className="space-y-2"><Label htmlFor="android-update-title">Notification title</Label><Input id="android-update-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="android-update-body">Notification message</Label><Textarea id="android-update-body" value={body} maxLength={1000} rows={5} onChange={(e) => setBody(e.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="android-update-button">Action button text</Label><Input id="android-update-button" value={buttonText} maxLength={50} onChange={(e) => setButtonText(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="android-update-url">Action button URL</Label><Input id="android-update-url" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} /></div></div>
              <div className="rounded-lg border bg-muted/30 p-3"><p className="text-xs font-medium text-muted-foreground">Preview</p><p className="mt-2 font-semibold">{title.replace(/\{\{version_name\}\}/g, "2.5.0")}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body.replace(/\{\{version_name\}\}/g, "2.5.0")}</p>{buttonText && <p className="mt-2 text-sm font-medium text-primary">{buttonText}</p>}</div>
              <Button className="w-full sm:w-auto" onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Notification Template"}</Button>
            </>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
