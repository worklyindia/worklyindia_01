import { useEffect, useRef, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralSystem } from '@/hooks/useReferralSystem';
import { useReferralProfile } from '@/hooks/useReferralProfile';
import { useToast } from '@/hooks/use-toast';
import { ReferralProfileForm } from '@/components/referral/ReferralProfileForm';
import { emptyReferralProfile, isReferralProfileComplete, referralProfileError, referralProfilePayload, toReferralForm } from '@/utils/referralProfile';
import { markOnboardingComplete, markOnboardingPending } from '@/utils/onboardingStatus';

const ReferOnboarding = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { referralCode, generateCode } = useReferralSystem();
  const { data: profile, isLoading, isError, refetch } = useReferralProfile();
  const [form, setForm] = useState(emptyReferralProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formReady, setFormReady] = useState(false);
  const hydrated = useRef<string | null>(null);
  const target = params.get('redirect');
  const destination = target && /^\/(referral(?:-profile|-code|-activity)?|employer\/referral(?:-code|-activity)?)(?:\?|$)/.test(target) ? target : '/referral-profile';
  const draftKey = user ? `referral_details_draft_${user.id}` : null;

  useEffect(() => {
    if (isLoading || isError || !user) return;
    if (isReferralProfileComplete(profile)) {
      markOnboardingComplete('referral');
      if (draftKey) localStorage.removeItem(draftKey);
      navigate(destination, { replace: true });
      return;
    }
    markOnboardingPending('referral');
    if (hydrated.current === user.id) return;
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(draftKey || '') || '{}'); } catch { /* ignore invalid drafts */ }
    setForm({ ...toReferralForm(profile), ...toReferralForm({ ...toReferralForm(profile), ...draft }) });
    hydrated.current = user.id;
  }, [profile, isLoading, isError, user, draftKey, destination, navigate]);

  const codeRequested = useRef(false);
  useEffect(() => {
    if (!user || referralCode?.referral_code || codeRequested.current) return;
    codeRequested.current = true;
    generateCode();
  }, [user, referralCode, generateCode]);

  const { data: referredBy } = useQuery({
    queryKey: ['referredBy', user?.id], enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('user_referrals').select('referrer_id, referral_code_used').eq('referred_user_id', user.id).maybeSingle();
      if (!data) return null;
      const { data: referrer } = await supabase.from('referral_profiles').select('display_name').eq('user_id', data.referrer_id).maybeSingle();
      return { name: referrer?.display_name || 'Refer User', code: data.referral_code_used };
    },
  });

  const submit = async () => {
    if (!user || saving || isError) return;
    const validation = referralProfileError(form);
    if (validation) { setError(validation); return; }
    setSaving(true); setError('');
    try {
      const { data, error: saveError } = await supabase.from('referral_profiles').upsert({ user_id: user.id, ...referralProfilePayload(form) }, { onConflict: 'user_id' }).select('*').single();
      if (saveError) throw saveError;
      if (!isReferralProfileComplete(data)) throw new Error('Please complete all required details.');
      queryClient.setQueryData(['referralProfile', user.id], data);
      markOnboardingComplete('referral');
      if (draftKey) localStorage.removeItem(draftKey);
      toast({ title: 'Your referral profile is ready' });
      navigate(destination, { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-background pb-28">
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-card text-foreground px-3 py-3 border-b border-border">
      <Button variant="ghost" size="icon" aria-label="Go back" className="text-foreground hover:bg-muted -ml-2" onClick={() => goBack(navigate, '/')}><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="text-lg font-semibold">Your referral profile</h1>
    </header>
    <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {isLoading ? <div className="flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></div> : isError ? <div className="space-y-3 text-center"><p>Could not load your profile.</p><Button onClick={() => refetch()}>Try again</Button></div> : <ReferralProfileForm value={form} originalPhone={profile?.phone || ''} onValidityChange={setFormReady} disabled={saving} onChange={next => {
        setForm(next); setError('');
        if (draftKey) { try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* ignore unavailable storage */ } }
      }} />}
      {referredBy && <div className="border-t pt-4 flex gap-3 items-center"><UserCheck className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Referred by</p><p className="font-medium">{referredBy.name}</p><p className="text-xs text-muted-foreground">{referredBy.code}</p></div></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </main>
    <footer className="fixed bottom-0 inset-x-0 bg-background border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button className="w-full max-w-lg mx-auto flex h-12 bg-success text-success-foreground hover:bg-success/90" disabled={saving || isLoading || isError || !isReferralProfileComplete(form) || !formReady} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete & Continue</Button>
    </footer>
  </div>;
};
export default ReferOnboarding;
