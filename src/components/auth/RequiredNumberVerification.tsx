import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Phone, Loader2, Check, LogOut } from 'lucide-react';
import { useBrandAssets } from '@/hooks/useBrandAssets';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';
import PhoneVerifyBox from './PhoneVerifyBox';

export default function RequiredNumberVerification({ user, employer, savedPhone, onComplete }: {
  user: User; employer: boolean; savedPhone?: string | null; onComplete: () => void;
}) {
  const userType = employer ? 'employer' : 'job_seeker';
  const { phone, setPhone, isAvailable, isChecking, error } = usePhoneValidation(userType, user.id);
  const { logo_url: logoUrl, brand_name: brandName } = useBrandAssets();
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    setPhone(savedPhone || user.phone || user.user_metadata?.mobile_number || '');
  }, [user.id, savedPhone, setPhone]);

  // Re-check right before sending the code so a number that became registered
  // (in profiles/companies or verified on another Auth account) after the
  // field was typed can never receive an OTP here.
  const checkBeforeSend = useCallback(async (phoneE164: string): Promise<string | null> => {
    try {
      const { data, error: checkError } = await supabase.functions.invoke('check-whatsapp', {
        body: { check_type: 'phone', phone: phoneE164, user_type: userType, current_user_id: user.id },
      });
      if (checkError) return 'Unable to verify phone number';
      if (data?.exists) return 'This number is already registered with another account';
      return null;
    } catch {
      return 'Unable to verify phone number';
    }
  }, [userType, user.id]);

  const finish = async (number: string) => {
    setVerifiedPhone(number);
    setSaving(true);
    setSaveError('');
    try {
      const { error: updateError } = await supabase.from(employer ? 'companies' : 'profiles')
        .update({ phone: number, whatsapp_number: number }).eq('user_id', user.id);
      if (updateError) throw updateError;
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      onComplete();
    } catch {
      setSaveError('Your number is verified. Please retry saving it.');
    } finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-background flex flex-col">
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl && (
            <img src={logoUrl} alt={`${brandName || BRAND_CONFIG.name} Logo`} className="h-8 w-8 shrink-0 object-contain" />
          )}
          <span className="truncate text-base font-bold sm:text-lg">
            <span style={{ color: BRAND_CONFIG.firstWordColor }}>{BRAND_CONFIG.firstName}</span>{' '}
            <span style={{ color: BRAND_CONFIG.secondWordColor }}>{BRAND_CONFIG.secondName}</span>
          </span>
        </div>
        <Button variant="outline" size="sm"
          className="shrink-0 gap-1.5 rounded-full border-border/70 px-3.5 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => { void supabase.auth.signOut(); }}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
    <div className="flex w-full flex-1 items-start px-4 pt-10 pb-6 sm:px-6">
      <section className="w-full max-w-3xl space-y-6">
      <Phone className="h-10 w-10 text-primary" />
      <h1 className="text-2xl font-semibold">Verify your number</h1>
      <p className="text-sm text-muted-foreground">Verify your mobile number to continue.</p>
      <div className="space-y-2">
        <Label htmlFor="required-number">Number</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input id="required-number" type="tel" inputMode="tel" value={verifiedPhone || phone}
            readOnly={Boolean(verifiedPhone)} onChange={(event) => setPhone(event.target.value)} placeholder="+91XXXXXXXXXX"
            className="pl-9 pr-10" />
          {isChecking && !verifiedPhone && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {isAvailable === true && !isChecking && !verifiedPhone && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
        {error && !verifiedPhone && <p className="text-sm text-destructive">{error}</p>}
        {isAvailable === true && !isChecking && !verifiedPhone && <PhoneVerifyBox phone={phone} mode="profile"
          autoSend={false} verified={false} onBeforeSend={checkBeforeSend}
          className="w-full"
          onVerified={(number) => { void finish(number); }} />}
      </div>
      {saving && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {saveError && <div className="space-y-2"><p className="text-sm text-destructive">{saveError}</p>
        <Button onClick={() => { void finish(verifiedPhone); }} disabled={saving}>Retry</Button></div>}
      </section>
    </div>
  </main>;
}