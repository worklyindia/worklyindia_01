import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReferralProfileForm } from '@/components/referral/ReferralProfileForm';
import { emptyReferralProfile, referralProfileError, referralProfilePayload, toReferralForm } from '@/utils/referralProfile';
import { ArrowLeft, Pencil, Users, Wallet, TrendingUp, Copy, Loader2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { useToast } from "@/hooks/use-toast";
import { SafeAvatarImage } from '@/components/ui/safe-image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ReferralProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { referralCode, referralWallet } = useReferralSystem();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyReferralProfile);
  const [saving, setSaving] = useState(false);
  const [formReady, setFormReady] = useState(false);

  // Referral profile — separate from employee/job seeker profile
  const { data: referralProfile } = useQuery({
    queryKey: ["referralProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("referral_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Who referred this user (verified referral code at signup)
  const { data: referredBy } = useQuery({
    queryKey: ["referredBy", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: referral, error } = await supabase
        .from("user_referrals")
        .select("referrer_id, referral_code_used")
        .eq("referred_user_id", user.id)
        .maybeSingle();
      if (error || !referral) return null;

      const [refProfile, jobProfile, company] = await Promise.all([
        supabase
          .from("referral_profiles")
          .select("display_name")
          .eq("user_id", referral.referrer_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", referral.referrer_id)
          .maybeSingle(),
        supabase
          .from("companies")
          .select("company_name")
          .eq("user_id", referral.referrer_id)
          .maybeSingle(),
      ]);

      return {
        name:
          refProfile.data?.display_name ||
          jobProfile.data?.full_name ||
          company.data?.company_name ||
          "Refer User",
        code: referral.referral_code_used,
      };
    },
    enabled: !!user?.id,
  });

  const displayName =
    referralProfile?.display_name || user?.email?.split("@")[0] || "Refer User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const copyCode = () => {
    if (!referralCode?.referral_code) return;
    navigator.clipboard.writeText(referralCode.referral_code);
    toast({ title: "Copied!", description: "Referral code copied to clipboard" });
  };

  const openEdit = () => {
    setForm(toReferralForm(referralProfile));
    setFormReady(false);
    setEditOpen(true);
  };

  const saveProfile = async () => {
    if (referralProfileError(form) || !formReady) {
      toast({ title: "Complete your details", description: referralProfileError(form) || undefined, variant: "destructive" });
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("referral_profiles")
      .upsert(
        { user_id: user.id, ...referralProfilePayload(form) },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: "Please try again", variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["referralProfile", user.id] });
    toast({ title: "Profile updated" });
    setEditOpen(false);
  };

  const goBack = () => {
    if (Number((window.history.state as any)?.idx) > 0) navigate(-1);
    else navigate("/referral", { replace: true });
  };

  if (editOpen) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-3 py-3 text-foreground">
          <Button variant="ghost" size="icon" aria-label="Back to profile" className="-ml-1 h-9 w-9" onClick={() => setEditOpen(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Edit Referral Profile</h1>
        </header>
        <main className="mx-auto max-w-lg px-4 py-6">
          <ReferralProfileForm value={form} onChange={setForm} disabled={saving} originalPhone={referralProfile?.phone || ''} onValidityChange={setFormReady} />
        </main>
        <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <Button onClick={saveProfile} disabled={saving || !formReady} className="mx-auto flex h-12 w-full max-w-lg bg-success text-success-foreground hover:bg-success/90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header: Back icon + Profile text */}
      <div className="sticky top-0 z-10 bg-card text-foreground p-4 shadow-sm border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={goBack}
            className="text-foreground hover:bg-muted h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Profile</h1>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit profile"
            onClick={openEdit}
            className="text-foreground hover:bg-muted h-9 w-9"
          >
            <Pencil className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="px-4 pt-8 pb-24 max-w-md mx-auto">
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* Referral photo is independent of employee/company profiles. */}
            <Avatar className="h-28 w-28 border-4 border-background shadow-xl bg-success/10 text-success text-3xl font-bold">
              <SafeAvatarImage src={referralProfile?.photo_url} width={224} alt={displayName} />
              <AvatarFallback className="bg-success/10 text-success text-3xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              aria-label="Edit profile"
              onClick={openEdit}
              className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-success hover:bg-success/90 text-success-foreground shadow-lg border-2 border-background"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">{displayName}</h2>
          {user?.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
          {referralProfile?.phone && (
            <p className="text-sm text-muted-foreground">{referralProfile.phone}</p>
          )}
        </div>

        <section className="mt-6 space-y-3 border-t pt-4">
          <h3 className="font-semibold">Personal details</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">City</dt><dd className="break-words">{referralProfile?.city}</dd></div>
            <div><dt className="text-muted-foreground">State</dt><dd className="break-words">{referralProfile?.state}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Address</dt><dd className="break-words">{referralProfile?.precise_address}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Occupation</dt><dd className="break-words">{referralProfile?.occupation}</dd></div>
          </dl>
          {referralProfile?.bio && <p className="text-sm whitespace-pre-wrap break-words">{referralProfile.bio}</p>}
        </section>
        {referredBy && (
          <Card className="mt-6 border-border shadow-sm bg-muted/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Referred by</p>
                <p className="text-base font-semibold text-foreground">{referredBy.name}</p>
                {referredBy.code && (
                  <p className="text-xs text-muted-foreground">Code: {referredBy.code}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {referralCode?.referral_code && (
          <Card className="mt-4 border-border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Your Referral Code</p>
                <p className="text-lg font-bold  text-success">
                  {referralCode.referral_code}
                </p>
              </div>
              <Button variant="outline" size="icon" aria-label="Copy referral code" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 flex flex-col items-center text-center">
              <Users className="h-5 w-5 text-primary mb-1" />
              <p className="text-lg font-bold text-foreground">{referralCode?.total_referrals || 0}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Referrals</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 flex flex-col items-center text-center">
              <TrendingUp className="h-5 w-5 text-success mb-1" />
              <p className="text-lg font-bold text-foreground">
                ₹{referralWallet?.total_earned ? Number(referralWallet.total_earned).toFixed(0) : '0'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Earned</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 flex flex-col items-center text-center">
              <Wallet className="h-5 w-5 text-warning mb-1" />
              <p className="text-lg font-bold text-foreground">
                ₹{referralWallet?.balance_amount ? Number(referralWallet.balance_amount).toFixed(0) : '0'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Balance</p>
            </CardContent>
          </Card>
        </div>

        <Button onClick={openEdit} className="w-full mt-6 bg-success hover:bg-success/90 text-success-foreground">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </main>

    </div>
  );
};

export default ReferralProfile;
