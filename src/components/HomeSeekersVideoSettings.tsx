import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, Save, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";
import { HOME_SEEKERS_VIDEO_KEY, isValidYouTubeUrl, parseVideoUrls } from "@/hooks/useHomeSeekersVideo";

/** Owner editor: the YouTube links shown above the job seekers scroll on the home page. */
const HomeSeekersVideoSettings = ({ bare = false }: { bare?: boolean }) => {
  const [links, setLinks] = useState<string[]>([""]);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", HOME_SEEKERS_VIDEO_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const list = parseVideoUrls(data?.setting_value ?? "");
        setLinks(list.length ? list : [""]);
        setSaved(list);
      });
  }, []);

  const setLink = (i: number, value: string) =>
    setLinks((prev) => prev.map((l, idx) => (idx === i ? value : l)));

  const addLink = () => setLinks((prev) => [...prev, ""]);

  const removeLink = (i: number) =>
    setLinks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [""]));

  const save = async () => {
    const cleaned = links.map((l) => l.trim()).filter(Boolean);
    const bad = cleaned.find((l) => !isValidYouTubeUrl(l));
    if (bad) {
      toast.error("Ek link sahi YouTube link nahi hai — please check karo");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        setting_value: cleaned.join("\n"),
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from("app_settings")
        .select("setting_key")
        .eq("setting_key", HOME_SEEKERS_VIDEO_KEY)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("app_settings").update(payload as any).eq("setting_key", HOME_SEEKERS_VIDEO_KEY)
        : await supabase.from("app_settings").insert({ setting_key: HOME_SEEKERS_VIDEO_KEY, ...payload } as any);
      if (error) throw error;
      setLinks(cleaned.length ? cleaned : [""]);
      setSaved(cleaned);
      toast.success(
        cleaned.length
          ? `${cleaned.length} video${cleaned.length > 1 ? "s" : ""} saved — ab home page pe dikhenge`
          : "Videos removed from the home page",
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not save the videos");
    } finally {
      setBusy(false);
    }
  };

  const dirty = links.map((l) => l.trim()).filter(Boolean).join("\n") !== saved.join("\n");

  return (
    <Card className={bare ? "p-4 space-y-4 rounded-none border-x-0 shadow-none" : "p-6 space-y-4"}>
      {!bare && (
        <h2 className="text-xl font-semibold flex items-center">
          <Youtube className="w-5 h-5 mr-2 text-primary" />
          Home Page Videos
        </h2>
      )}
      <p className="text-sm text-muted-foreground">
        Ye YouTube videos home page pe job seekers profile scroll ke upar dikhenge. Jitne chahe links add karo —
        home page pe log left-right scroll karke saare videos dekh sakte hain. Sab hatane ke liye saare boxes khali
        karke Save dabao.
      </p>
      <div className="space-y-3">
        <Label>YouTube video links</Label>
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={link}
              onChange={(e) => setLink(i, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove link ${i + 1}`}
              onClick={() => removeLink(i)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addLink} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Add another video
        </Button>
      </div>
      <Button type="button" onClick={save} disabled={busy || !dirty}>
        <Save className="w-4 h-4 mr-2" /> Save
      </Button>
      {saved.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">Preview ({saved.length} video{saved.length > 1 ? "s" : ""})</p>
          {saved.map((url) => (
            <YouTubeVideoCard key={url} url={url} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default HomeSeekersVideoSettings;
