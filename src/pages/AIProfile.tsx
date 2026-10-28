import { useEffect, useState } from "react";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Loader2, Pencil, Check, X, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload";

/**
 * ChatGPT-style, mobile friendly profile page for the AI chat.
 * Users can view + edit their basic details and log out (with confirmation).
 */
const AIProfile = () => {
  const navigate = useNavigate();
  const { user, profile, loading, signOut, updateProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setLocation(profile?.location || "");
    setBio(profile?.bio || "");
  }, [profile?.full_name, profile?.phone, profile?.location, profile?.bio]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/ai-assistant/profile", { replace: true });
  }, [loading, user, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
      });
      if (error) {
        toast.error(error.message || "Could not save your profile");
        return;
      }
      toast.success("Profile updated");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/ai-assistant", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = (fullName || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-2 py-2 backdrop-blur safe-top">
        <button
          type="button"
          onClick={() => goBack(navigate, "/ai-assistant")}
          aria-label="Back to chat"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-semibold">Profile</h1>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cancel editing"
              onClick={() => {
                setEditing(false);
                setFullName(profile?.full_name || "");
                setPhone(profile?.phone || "");
                setLocation(profile?.location || "");
                setBio(profile?.bio || "");
              }}
            >
              <X className="h-5 w-5" />
            </Button>
            <Button size="icon" aria-label="Save profile" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        {/* Avatar */}
        <div className="flex flex-col items-center text-center">
          {editing ? (
            <ProfilePhotoUpload
              currentPhoto={profile?.profile_image_url || undefined}
              onPhotoUpdate={() => toast.success("Photo updated")}
            />
          ) : profile?.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={fullName || "Profile photo"}
              className="h-20 w-20 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-foreground">
              {initials}
            </div>
          )}
          <p className="mt-3 text-lg font-semibold">{fullName || "Your name"}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {user?.email}
          </p>
        </div>


        {/* Fields */}
        <div className="mt-8 space-y-4">
          <Field label="Full name">
            {editing ? (
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="h-12 rounded-xl"
              />
            ) : (
              <ReadOnly value={fullName} />
            )}
          </Field>

          <Field label="Phone">
            {editing ? (
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="+91…"
                className="h-12 rounded-xl"
              />
            ) : (
              <ReadOnly value={phone} />
            )}
          </Field>

          <Field label="Location">
            {editing ? (
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="h-12 rounded-xl"
              />
            ) : (
              <ReadOnly value={location} />
            )}
          </Field>

          <Field label="About">
            {editing ? (
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the AI a bit about you"
                className="min-h-[96px] rounded-xl"
              />
            ) : (
              <ReadOnly value={bio} />
            )}
          </Field>
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          onClick={() => setConfirmLogout(true)}
          className="mt-10 h-12 w-full gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to use the AI chat with your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ReadOnly({ value }: { value: string }) {
  return (
    <p className="min-h-[48px] whitespace-pre-wrap rounded-xl bg-muted/50 px-4 py-3 text-[15px] text-foreground">
      {value || <span className="text-muted-foreground">Not added yet</span>}
    </p>
  );
}

export default AIProfile;
