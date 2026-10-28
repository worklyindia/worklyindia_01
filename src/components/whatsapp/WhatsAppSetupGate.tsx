import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { employerScope } from '@/components/employer/whatsapp/selectedNumber';
import { CHAT_AUDIENCE } from '@/lib/whatsappAudience';
import { needsBusinessVerification, needsWhatsAppRegistration, needsWhatsAppSetup, type WhatsAppSetupStatus } from '@/lib/whatsappSetup';
import WhatsAppSecuritySettings from './WhatsAppSecuritySettings';

export default function WhatsAppSetupGate({ scope, children }: { scope: 'owner' | 'employer'; children: ReactNode }) {
  const [profile, setProfile] = useState<WhatsAppSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke(scope === 'employer' ? 'workly-india' : 'whatsapp-cloud-api', {
        body: scope === 'employer' ? { ...employerScope(), action: 'get_profile' } : { action: 'get_profile', audience: CHAT_AUDIENCE },
      });
      if (failure) throw new Error(failure instanceof FunctionsHttpError ? await failure.context.text() : failure.message);
      if (!data?.success) throw new Error(data?.error || 'Could not check WhatsApp setup.');
      setProfile(data.profile || {});
    } catch (failure) { setError((failure as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [scope]);
  if (loading) return <div role="status" className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking WhatsApp setup…</div>;
  if (error || !profile) return <section className="space-y-3 px-4 py-6"><p role="alert" className="break-words text-sm text-destructive">{error || 'WhatsApp setup status is unavailable.'}</p><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button></section>;
  const setup = needsWhatsAppSetup(profile);
  const unknown = profile.is_pin_enabled == null && !needsWhatsAppRegistration(profile);
  return <>
    {needsBusinessVerification(profile) && <section role="alert" className="space-y-3 border-b border-border bg-destructive/5 px-4 py-5 sm:px-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />Business verification incomplete</h2>
      <p className="text-sm text-muted-foreground">Complete business verification in Meta Business Suite → Security Center. Status: {profile.business_verification_status?.replace(/_/g, ' ')}.</p>
      <p className="text-sm text-muted-foreground">Business verification and phone activation are separate. Verification can help qualify your business for a 2,000-recipient messaging limit, but Meta decides eligibility and approval; it is not an automatic upgrade.{profile.messaging_limit ? ` Current Meta limit: ${profile.messaging_limit}.` : ''}</p>
      <Button variant="outline" asChild><a href="https://business.facebook.com/settings/security" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Complete verification on Meta</a></Button>
    </section>}
    {setup ? <>
      <section className="space-y-2 px-4 pt-6 sm:px-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" />Finish WhatsApp setup</h2><p className="text-sm text-muted-foreground">{needsWhatsAppRegistration(profile) ? 'Activate this number on WhatsApp Cloud API to continue. If a PIN already exists, enter that PIN; do not create a different one.' : 'Create a six-digit security PIN to continue to your profile and settings.'}</p></section>
      <WhatsAppSecuritySettings scope={scope} setup registration={needsWhatsAppRegistration(profile)} onSaved={load} />
    </> : <>
      {unknown && <p role="status" className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Meta did not return the PIN status. Check two-step verification in WhatsApp Manager before changing your PIN.</p>}
      {children}
    </>}
  </>;
}