import { confirmDialog } from '@/lib/confirmDialog';
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deleteStorageUrl } from "@/utils/storageCleanup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAllDonationCampaigns, DonationCampaign } from "@/hooks/useDonationCampaign";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Heart, CheckCircle2, Power, Users, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/mediaCdn";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `c-${Date.now()}`;

const empty = (): Partial<DonationCampaign> => ({
  title: "",
  short_description: "",
  long_content: "",
  image_url: "",
  target_amount: 100000,
  status: "active",
  is_featured: false,
  min_amount: 10,
  suggested_amounts: [101, 251, 501, 1100, 2100],
});

export default function DonationCampaignsManagement() {
  const navigate = useNavigate();
  const { campaigns, loading, reload } = useAllDonationCampaigns();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DonationCampaign> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setEditing(empty()); setEditOpen(true); };
  const openEdit = (c: DonationCampaign) => { setEditing({ ...c }); setEditOpen(true); };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadImage(file, {
        folder: "donation-campaigns",
        replaceUrl: editing?.image_url ?? null,
      });
      setEditing((prev) => prev ? { ...prev, image_url: url } : prev);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!editing?.title) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: editing.title,
        slug: editing.slug || slugify(editing.title!),
        short_description: editing.short_description || null,
        long_content: editing.long_content || null,
        image_url: editing.image_url || null,
        target_amount: Number(editing.target_amount) || 0,
        status: editing.status || "active",
        is_featured: !!editing.is_featured,
        min_amount: Number(editing.min_amount) || 10,
        suggested_amounts: editing.suggested_amounts || [101, 251, 501, 1100, 2100],
      };
      if (editing.id) {
        const { error } = await supabase.from("donation_campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Campaign updated" });
      } else {
        const { error } = await supabase.from("donation_campaigns").insert(payload);
        if (error) throw error;
        toast({ title: "Campaign created" });
      }
      setEditOpen(false);
      reload();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: DonationCampaign) => {
    const newStatus = c.status === "active" ? "ended" : "active";
    const { error } = await supabase.from("donation_campaigns").update({ status: newStatus }).eq("id", c.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: `Campaign ${newStatus}` }); reload(); }
  };

  const remove = async (c: DonationCampaign) => {
    if (!(await confirmDialog(`Delete "${c.title}" and all its donations?`))) return;
    const { error } = await supabase.from("donation_campaigns").delete().eq("id", c.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      // Remove the campaign image from storage as well, so nothing is left behind.
      void deleteStorageUrl(c.image_url);
      toast({ title: "Deleted" });
      reload();
    }
  };

  return (
    <div className="container max-w-5xl py-4 px-3 sm:px-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/owner-portal")} className="shrink-0 px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base sm:text-xl font-bold flex items-center gap-1.5 flex-1 min-w-0 truncate">
          <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
          <span className="truncate">Donation Campaigns</span>
        </h1>
        <Button onClick={openCreate} size="sm" className="bg-orange-600 hover:bg-orange-700 shrink-0">
          <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">New</span>
        </Button>
      </div>

      {loading ? (
        <p className="text-center py-10 text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No campaigns yet. Create one!</Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const pct = c.target_amount > 0 ? Math.min(100, Math.round((Number(c.collected_amount) / Number(c.target_amount)) * 100)) : 0;
            return (
              <Card key={c.id} className="p-3 overflow-hidden">
                <div className="flex gap-3 mb-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base truncate flex-1 min-w-0">{c.title}</h3>
                      <Badge variant={c.status === "active" ? "default" : c.status === "ended" ? "secondary" : "outline"} className="text-[10px] h-5 shrink-0">
                        {c.status === "ended" && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                        {c.status}
                      </Badge>
                      {c.is_featured && <Badge variant="outline" className="text-[10px] h-5 shrink-0">★</Badge>}
                    </div>
                    {c.short_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.short_description}</p>
                    )}
                  </div>
                </div>

                {/* Amounts - mobile safe, wraps cleanly */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
                    <span className="font-semibold truncate">₹{Number(c.collected_amount).toLocaleString("en-IN")}</span>
                    <span className="text-xs text-muted-foreground shrink-0">of ₹{Number(c.target_amount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {c.donor_count} donors</span>
                    <span>{pct}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(c)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/owner-portal/donation-campaigns/${c.id}/donations`)}>
                    <Eye className="w-3 h-3 mr-1" /> History
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => toggleStatus(c)}>
                    <Power className="w-3 h-3 mr-1" /> {c.status === "active" ? "End" : "Reactivate"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" onClick={() => remove(c)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Short description</Label>
                <Input value={editing.short_description || ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value })} />
              </div>
              <div>
                <Label>Campaign image</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
                {editing.image_url ? (
                  <div className="relative mt-1 rounded-lg overflow-hidden border bg-muted">
                    <img src={editing.image_url} alt="" className="w-full h-40 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span className="ml-1 text-xs">Replace</span>
                      </Button>
                      <Button type="button" size="sm" variant="destructive" className="h-8" onClick={() => setEditing({ ...editing, image_url: "" })} disabled={uploading}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="mt-1 w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading…</span></>
                    ) : (
                      <><Upload className="w-5 h-5" /><span className="text-xs">Tap to upload image</span><span className="text-[10px]">PNG, JPG up to 5 MB</span></>
                    )}
                  </button>
                )}
                <Input
                  className="mt-2 text-xs"
                  value={editing.image_url || ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="Or paste image URL"
                />
              </div>
              <div>
                <Label>Long content / description</Label>
                <Textarea rows={6} value={editing.long_content || ""} onChange={(e) => setEditing({ ...editing, long_content: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target amount (₹)</Label>
                  <Input type="number" value={editing.target_amount || 0} onChange={(e) => setEditing({ ...editing, target_amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Min amount (₹)</Label>
                  <Input type="number" value={editing.min_amount || 10} onChange={(e) => setEditing({ ...editing, min_amount: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Suggested amounts (comma separated)</Label>
                <Input
                  value={(editing.suggested_amounts || []).join(",")}
                  onChange={(e) => setEditing({ ...editing, suggested_amounts: e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <select
                    className="w-full h-10 border rounded-md px-3 bg-background"
                    value={editing.status || "active"}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={!!editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} />
                  <Label>Featured on home</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
