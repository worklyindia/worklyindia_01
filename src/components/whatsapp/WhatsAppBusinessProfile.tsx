import { employerScope } from "@/components/employer/whatsapp/selectedNumber";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_AUDIENCE } from "@/lib/whatsappAudience";
import { formatWhatsappTimezone } from "@/lib/whatsappTimezone";
import { Camera, Loader2, Pencil, RefreshCw, Save, ShieldCheck, User } from "lucide-react";

interface Profile {
  phone_number?: string | null;
  verified_name?: string | null;
  quality_rating?: string | null;
  messaging_limit?: string | null;
  display_name_status?: string | null;
  code_verification_status?: string | null;
  platform_type?: string | null;
  throughput?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  business_name?: string | null;
  account_review_status?: string | null;
  business_verification_status?: string | null;
  timezone_id?: string | null;
  currency?: string | null;
  message_template_namespace?: string | null;
  messaging_product?: string | null;
  about?: string | null;
  address?: string | null;
  description?: string | null;
  email?: string | null;
  websites?: string[] | null;
  vertical?: string | null;
  profile_picture_url?: string | null;
}

const VERTICALS = [
  "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", "ENTERTAIN", "EVENT_PLAN", "FINANCE",
  "GROCERY", "GOVT", "HOTEL", "HEALTH", "INDUSTRY", "NONPROFIT", "PROF_SERVICES", "RETAIL", "TRAVEL", "RESTAURANT",
];

function Field({ label, value, singleLine = false }: { label: string; value?: string | null; singleLine?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`min-w-0 text-sm font-medium text-right ${singleLine ? 'truncate' : 'break-words [overflow-wrap:anywhere]'}`} title={value}>{value}</span>
    </div>
  );
}

interface WhatsAppBusinessProfileProps {
  scope?: "owner" | "employer";
  /** view = read-only with edit icon; edit = editable form only. */
  mode?: "view" | "edit";
  onEdit?: () => void;
  onSaved?: () => void;
}

export default function WhatsAppBusinessProfile({ scope = "owner", mode = "view", onEdit, onSaved }: WhatsAppBusinessProfileProps) {
  const audience = CHAT_AUDIENCE;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ about: "", description: "", address: "", email: "", website1: "", website2: "", vertical: "" });
  const [picture, setPicture] = useState<string | null>(null);
  const [pictureOpen, setPictureOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invokeProfileAction = (body: Record<string, unknown>) =>
    supabase.functions.invoke(scope === "employer" ? "workly-india" : "whatsapp-cloud-api", {
      body: scope === "employer" ? { ...employerScope(), ...body } : { audience, ...body },
    });

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fnError } = await invokeProfileAction({ action: "get_profile" });
    if (fnError || !data?.success) {
      setError(data?.error || fnError?.message || "Could not load the WhatsApp profile.");
      setProfile(null);
    } else {
      const p: Profile = data.profile || {};
      setProfile(p);
      setForm({
        about: p.about || "",
        description: p.description || "",
        address: p.address || "",
        email: p.email || "",
        website1: p.websites?.[0] || "",
        website2: p.websites?.[1] || "",
        vertical: p.vertical || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [audience]);

  const pickPicture = (file?: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Choose a JPG or PNG picture."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Picture must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onload = () => {
        if (image.width < 192 || image.height < 192) {
          toast.error("Picture must be at least 192 × 192 pixels.");
          return;
        }
        setPicture(source);
      };
      image.onerror = () => toast.error("Could not read this picture.");
      image.src = source;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.about.trim()) {
      toast.error("About cannot be empty.");
      return;
    }
    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid contact email.");
      return;
    }
    const websites = [form.website1, form.website2].map((value) => value.trim()).filter(Boolean);
    const invalidWebsite = websites.find((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== "http:" && url.protocol !== "https:";
      } catch {
        return true;
      }
    });
    if (invalidWebsite) {
      toast.error("Website links must start with http:// or https://.");
      return;
    }
    setSaving(true);
    const { data, error: fnError } = await invokeProfileAction({
      action: "update_profile",
      about: form.about.trim(),
      description: form.description,
      address: form.address,
      email,
      websites,
      vertical: form.vertical || undefined,
      ...(picture ? { profile_picture: picture } : {}),
    });
    setSaving(false);
    if (fnError || !data?.success) {
      toast.error(data?.error || fnError?.message || "Could not update the profile.");
      return;
    }
    toast.success("WhatsApp profile updated");
    setPicture(null);
    if (onSaved) onSaved(); else void load();
  };

  const editing = mode === "edit";
  const avatar = picture || profile?.profile_picture_url || "";

  return (
    <section className="w-full border-b border-border bg-background">
      <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <h2 className="text-base font-semibold">{editing ? "Edit profile" : "Business profile"}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Refresh profile" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {!editing && onEdit && (
            <Button variant="ghost" size="icon" aria-label="Edit profile" onClick={onEdit} disabled={!profile}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-5 px-4 pb-6 sm:px-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <fieldset disabled={loading && !profile} className="min-w-0 space-y-5">
            {loading && !profile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading profile from Meta…
              </div>
            )}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                type="button"
                onClick={() => editing ? fileRef.current?.click() : avatar && setPictureOpen(true)}
                 className="relative h-20 w-20 shrink-0 rounded-full bg-muted p-0 overflow-hidden border border-border hover:bg-muted"
                aria-label={editing ? "Change profile picture" : "View profile picture"}
              >
                {avatar
                  ? <img src={avatar} referrerPolicy="no-referrer" alt="WhatsApp business profile" className="h-full w-full object-cover" />
                  : <User className="h-8 w-8 m-auto text-muted-foreground" />}
                {editing && <span className="absolute inset-x-0 bottom-0 bg-whatsapp-green/90 py-1 flex items-center justify-center">
                  <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                </span>}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => pickPicture(e.target.files?.[0])}
              />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold truncate">{profile?.verified_name || profile?.business_name || "WhatsApp Business"}</p>
                <p className="text-sm text-muted-foreground">{profile?.phone_number || "—"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile?.display_name_status && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />{profile.display_name_status}
                    </Badge>
                  )}
                  {profile?.messaging_limit && <Badge variant="outline">{profile.messaging_limit}</Badge>}
                </div>
              </div>
            </div>

            <Separator />

            {!editing && (
              <div className="divide-y divide-border">
                <Field label="About" value={profile?.about} />
                <Field label="Description" value={profile?.description} />
                <Field label="Address" value={profile?.address} />
                <Field label="Email" value={profile?.email} />
                <Field label="Website 1" value={profile?.websites?.[0]} />
                <Field label="Website 2" value={profile?.websites?.[1]} />
                <Field label="Category" value={profile?.vertical} />
              </div>
            )}

            {editing && <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="wa-about">About</Label>
                  <span className="text-xs text-muted-foreground">{form.about.length}/139</span>
                </div>
                <Input id="wa-about" maxLength={139} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="Hey there! I am using WhatsApp." />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="wa-description">Description</Label>
                  <span className="text-xs text-muted-foreground">{form.description.length}/512</span>
                </div>
                <Textarea id="wa-description" maxLength={512} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What your business does" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="wa-address">Address</Label>
                  <span className="text-xs text-muted-foreground">{form.address.length}/256</span>
                </div>
                <Input id="wa-address" maxLength={256} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="wa-email">Email</Label>
                  <span className="text-xs text-muted-foreground">{form.email.length}/128</span>
                </div>
                <Input id="wa-email" type="email" maxLength={128} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-website-1">Website 1</Label>
                <Input id="wa-website-1" type="url" maxLength={256} value={form.website1} onChange={(e) => setForm({ ...form, website1: e.target.value })} placeholder="https://example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-website-2">Website 2</Label>
                <Input id="wa-website-2" type="url" maxLength={256} value={form.website2} onChange={(e) => setForm({ ...form, website2: e.target.value })} placeholder="https://jobs.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-vertical">Category</Label>
                <select
                  id="wa-vertical"
                  value={form.vertical}
                  onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Not set</option>
                  {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <Button className="w-full" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Update profile
              </Button>
            </div>}

            {!editing && <Separator />}

            {!editing && <div className="divide-y divide-border">
              <Field label="Business name" value={profile?.business_name} />
              <Field label="Verified display name" value={profile?.verified_name} />
              <Field label="Phone number" value={profile?.phone_number} />
              <Field label="Display name status" value={profile?.display_name_status} />
              <Field label="Account review" value={profile?.account_review_status} />
              <Field label="Business verification" value={profile?.business_verification_status} />
              <Field label="Number verification" value={profile?.code_verification_status} />
              <Field label="Quality rating" value={profile?.quality_rating} />
              <Field label="Messaging limit" value={profile?.messaging_limit} />
              <Field label="Throughput" value={profile?.throughput} />
              <Field label="Platform" value={profile?.platform_type} />
              <Field label="Messaging product" value={profile?.messaging_product} />
              <Field label="Timezone" value={formatWhatsappTimezone(profile?.timezone_id)} />
              <Field label="Currency" value={profile?.currency} />
              <Field label="Template namespace" value={profile?.message_template_namespace} singleLine />
              <Field label="Phone number ID" value={profile?.phone_number_id} />
              <Field label="WhatsApp account ID" value={profile?.waba_id} />
            </div>}
          </fieldset>
        )}
      </div>
      <Dialog open={pictureOpen} onOpenChange={setPictureOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>WhatsApp profile picture</DialogTitle></DialogHeader>
          {avatar && <img src={avatar} referrerPolicy="no-referrer" alt="WhatsApp business profile enlarged" className="aspect-square w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
