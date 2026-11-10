import { confirmDialog } from '@/lib/confirmDialog';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deleteStorageUrl } from "@/utils/storageCleanup";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadImage } from "@/lib/mediaCdn";
import { resolveBadgeImage, getBadgeDescription, type HomeTrustBadge } from "@/components/HomeTrustBadges";

const COLOR_PRESETS: Array<{
  label: string;
  gradient: string;
  ring: string;
  glow: string;
  tint: string;
}> = [
  { label: "Emerald", gradient: "from-emerald-400 to-green-600", ring: "ring-emerald-500/20", glow: "shadow-emerald-500/20", tint: "from-emerald-500/10 via-emerald-500/5 to-transparent" },
  { label: "Blue", gradient: "from-sky-400 to-blue-600", ring: "ring-blue-500/20", glow: "shadow-blue-500/20", tint: "from-blue-500/10 via-blue-500/5 to-transparent" },
  { label: "Violet", gradient: "from-violet-400 to-purple-600", ring: "ring-violet-500/20", glow: "shadow-violet-500/20", tint: "from-violet-500/10 via-violet-500/5 to-transparent" },
  { label: "Orange", gradient: "from-orange-400 to-amber-600", ring: "ring-orange-500/20", glow: "shadow-orange-500/20", tint: "from-orange-500/10 via-orange-500/5 to-transparent" },
  { label: "Indigo", gradient: "from-indigo-400 to-blue-700", ring: "ring-indigo-500/20", glow: "shadow-indigo-500/20", tint: "from-indigo-500/10 via-indigo-500/5 to-transparent" },
  { label: "Pink", gradient: "from-rose-400 to-pink-600", ring: "ring-rose-500/20", glow: "shadow-rose-500/20", tint: "from-rose-500/10 via-rose-500/5 to-transparent" },
  { label: "Teal", gradient: "from-teal-400 to-cyan-600", ring: "ring-teal-500/20", glow: "shadow-teal-500/20", tint: "from-teal-500/10 via-teal-500/5 to-transparent" },
  { label: "Slate", gradient: "from-slate-500 to-slate-700", ring: "ring-slate-500/20", glow: "shadow-slate-500/20", tint: "from-slate-500/10 via-slate-500/5 to-transparent" },
];

const presetLabelFor = (gradient: string) =>
  COLOR_PRESETS.find((p) => p.gradient === gradient)?.label ?? "Custom";

const TrustBadgesManagement = () => {
  const navigate = useNavigate();
  const [badges, setBadges] = useState<HomeTrustBadge[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<HomeTrustBadge>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("home_trust_badges")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error("Failed to load badges");
    } else {
      const list = (data || []) as HomeTrustBadge[];
      setBadges(list);
      // Seed editor with the description currently shown in the home-page popup
      // (DB value if present, otherwise the rich Hindi fallback) so the owner
      // can see and edit it instead of an empty box.
      const seeded: Record<string, Partial<HomeTrustBadge>> = {};
      list.forEach((b) => {
        if (!b.description?.trim()) {
          seeded[b.id] = { description: getBadgeDescription(b) };
        }
      });
      setDrafts(seeded);
    }
    setLoading(false);
  };

  const draftOf = (b: HomeTrustBadge): HomeTrustBadge => ({
    ...b,
    ...(drafts[b.id] || {}),
  });

  const setDraft = (id: string, patch: Partial<HomeTrustBadge>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));

  const applyPreset = (id: string, label: string) => {
    const preset = COLOR_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setDraft(id, {
      gradient: preset.gradient,
      ring: preset.ring,
      glow: preset.glow,
      tint: preset.tint,
    });
  };

  const handleUpload = async (badge: HomeTrustBadge, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { url } = await uploadImage(file, {
        folder: "trust-badges",
        fileName,
        replaceUrl: badge.image_url,
      });
      setDraft(badge.id, { image_url: `${url}?t=${Date.now()}` });
      toast.success("Image uploaded — click Save to apply");
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    }
  };

  const saveBadge = async (badge: HomeTrustBadge) => {
    const draft = drafts[badge.id];
    if (!draft) return;
    setSavingId(badge.id);
    const { error } = await supabase
      .from("home_trust_badges")
      .update(draft as any)
      .eq("id", badge.id);
    setSavingId(null);
    if (error) {
      toast.error("Save failed");
      return;
    }
    toast.success("Saved");
    fetchBadges();
  };

  const toggleActive = async (badge: HomeTrustBadge) => {
    const { error } = await supabase
      .from("home_trust_badges")
      .update({ is_active: !badge.is_active })
      .eq("id", badge.id);
    if (error) toast.error("Failed");
    else fetchBadges();
  };

  const removeBadge = async (badge: HomeTrustBadge) => {
    if (!(await confirmDialog(`Delete "${badge.title}"?`))) return;
    const { error } = await supabase
      .from("home_trust_badges")
      .delete()
      .eq("id", badge.id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Deleted");
      fetchBadges();
    }
  };

  const move = async (badge: HomeTrustBadge, dir: -1 | 1) => {
    const idx = badges.findIndex((b) => b.id === badge.id);
    const swap = badges[idx + dir];
    if (!swap) return;
    await supabase.from("home_trust_badges").update({ sort_order: swap.sort_order }).eq("id", badge.id);
    await supabase.from("home_trust_badges").update({ sort_order: badge.sort_order }).eq("id", swap.id);
    fetchBadges();
  };

  const addBadge = async () => {
    const maxOrder = badges.reduce((m, b) => Math.max(m, b.sort_order), 0);
    const preset = COLOR_PRESETS[badges.length % COLOR_PRESETS.length];
    const { error } = await supabase.from("home_trust_badges").insert({
      title: "New Badge",
      subtitle: "Short description",
      gradient: preset.gradient,
      ring: preset.ring,
      glow: preset.glow,
      tint: preset.tint,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    if (error) toast.error("Failed to add");
    else {
      toast.success("Badge added — edit it below");
      fetchBadges();
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 pb-24 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/owner-portal")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Trust Badges</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage the 6 trust badges on the home page
            </p>
          </div>
        </div>
        <Button onClick={addBadge} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <Alert>
        <ImageIcon className="h-4 w-4" />
        <AlertDescription className="text-xs sm:text-sm">
          Upload square PNG/JPG icons (recommended 512×512, &lt; 5MB). If no image is uploaded the default illustration is shown. Toggle the eye to hide/show on the home page.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {badges.map((b) => {
            const d = draftOf(b);
            const preview = drafts[b.id]?.image_url ?? resolveBadgeImage(d);
            const dirty = Boolean(drafts[b.id]);
            return (
              <Card key={b.id} className={!b.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-16 h-16 rounded-xl bg-gradient-to-br ${d.gradient} flex items-center justify-center p-1 shadow-md ${d.glow} shrink-0`}
                    >
                      {preview ? (
                        <img
                          src={preview}
                          alt={d.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-white font-bold text-xl">
                          {d.title?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{d.title}</CardTitle>
                      <CardDescription className="text-xs truncate">
                        {d.subtitle}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(b, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(b, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={d.title}
                      onChange={(e) => setDraft(b.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtitle</Label>
                    <Input
                      value={d.subtitle}
                      onChange={(e) => setDraft(b.id, { subtitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Details (shown in popup when badge is tapped)</Label>
                    <Textarea
                      rows={5}
                      placeholder="Full explanation users will see when they tap this badge…"
                      value={
                        drafts[b.id]?.description !== undefined
                          ? (drafts[b.id]?.description ?? "")
                          : (b.description?.trim()
                              ? b.description
                              : getBadgeDescription(b))
                      }
                      onChange={(e) => setDraft(b.id, { description: e.target.value })}
                    />
                  </div>
                  {!b.description?.trim() && (
                    <p className="text-[10px] text-muted-foreground -mt-2">
                      Yeh default text hai jo abhi popup mein show ho raha hai. Edit karke Save dabayein taaki yeh database mein save ho jaye.
                    </p>
                  )}
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Select
                      value={presetLabelFor(d.gradient)}
                      onValueChange={(v) => applyPreset(b.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_PRESETS.map((p) => (
                          <SelectItem key={p.label} value={p.label}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-4 h-4 rounded bg-gradient-to-br ${p.gradient}`} />
                              {p.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Image</Label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(b, f);
                            e.target.value = "";
                          }}
                        />
                        <span className="inline-flex w-full items-center justify-center gap-2 text-xs h-9 px-3 rounded-md border bg-background hover:bg-accent cursor-pointer">
                          <Upload className="h-3 w-3" /> Upload new image
                        </span>
                      </label>
                      {drafts[b.id]?.image_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void deleteStorageUrl(drafts[b.id]?.image_url);
                            setDraft(b.id, { image_url: null });
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => toggleActive(b)}>
                        {b.is_active ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeBadge(b)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      disabled={!dirty || savingId === b.id}
                      onClick={() => saveBadge(b)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {savingId === b.id ? "Saving…" : dirty ? "Save" : "Saved"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrustBadgesManagement;
