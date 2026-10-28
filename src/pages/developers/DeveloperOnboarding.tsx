import { PhoneInput } from '@/components/ui/phone-input';
import { isValidE164 } from '@/lib/phone';
import { useEffect, useMemo, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Code, FileText, Globe, Loader2, Phone, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DevForm {
  avatar_url: string;
  full_name: string;
  organization: string;
  website: string;
  phone: string;
  use_case: string;
  description: string;
}

const empty: DevForm = { avatar_url: '', full_name: '', organization: '', website: '', phone: '', use_case: '', description: '' };
const DRAFT_KEY = 'onboarding_draft_developer';
const DESC_LIMIT = 200;

const USE_CASES: Record<string, string> = {
  jobs: 'Show jobs on my website',
  whatsapp: 'WhatsApp inbox / messaging',
  email: 'Email inbox / sending',
  social: 'Instagram / Facebook inbox',
  oauth: 'Login with Workly India',
  other: 'Other',
};

const isPhone = (v: string) => isValidE164(v);
const isUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v.trim());

/** Mode "setup" = first-time required screen; mode "profile" = view/edit from header icon. */
const DeveloperOnboarding = ({ mode = 'setup' }: { mode?: 'setup' | 'profile' }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destination = params.get('redirect') || '/developers';
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DevForm>(() => {
    try { return { ...empty, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') }; } catch { return empty; }
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setEmail(user.email || '');
      const { data } = await (supabase as any).from('developer_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        if (mode === 'setup' && data.is_profile_complete) {
          localStorage.setItem('onboarding_status_developer', 'complete');
          navigate(destination, { replace: true });
          return;
        }
        setForm((prev) => ({
          avatar_url: data.avatar_url || prev.avatar_url,
          full_name: data.full_name || prev.full_name,
          organization: data.organization || prev.organization,
          website: data.website || prev.website,
          phone: data.phone || prev.phone,
          use_case: data.use_case || prev.use_case,
          description: data.description || prev.description,
        }));
      }
      setLoading(false);
    })();
  }, [destination, mode, navigate]);

  const setField = (k: keyof DevForm, v: string) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const canSubmit = useMemo(
    () =>
      !!form.avatar_url &&
      form.full_name.trim().length >= 2 &&
      form.organization.trim().length >= 2 &&
      isUrl(form.website) &&
      isPhone(form.phone) &&
      !!form.use_case &&
      form.description.trim().length >= 10,
    [form],
  );

  const handleSubmit = async () => {
    if (!userId || !canSubmit || saving) return;
    setSaving(true);
    const { error } = await (supabase as any).from('developer_profiles').upsert(
      {
        user_id: userId,
        avatar_url: form.avatar_url,
        full_name: form.full_name.trim(),
        organization: form.organization.trim(),
        website: form.website.trim(),
        phone: form.phone.replace(/\s/g, ''),
        use_case: form.use_case,
        description: form.description.trim(),
        is_profile_complete: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    setSaving(false);
    if (error) { toast.error(error.message || 'Could not save. Please try again.'); return; }
    localStorage.setItem('onboarding_status_developer', 'complete');
    localStorage.removeItem(DRAFT_KEY);
    toast.success(mode === 'setup' ? 'Developer profile ready' : 'Profile updated');
    if (mode === 'setup') navigate(destination, { replace: true });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }


  return (
    <div className="min-h-screen bg-background pb-32">
      {mode === 'profile' && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, '/developers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Developer Profile</h1>
        </header>
      )}
      <main className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ProfilePhotoUpload
            currentPhoto={form.avatar_url}
            onPhotoUpdate={(url) => setField('avatar_url', url)}
            useEmployerContext
            skipSave
          />
          {!form.avatar_url && <p className="text-xs text-destructive">Profile photo is required</p>}
          <h2 className="text-xl font-semibold">
            {mode === 'setup' ? 'Set up your developer profile' : form.full_name || 'Your profile'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === 'setup' ? 'Please fill in every detail below to use the Developer Portal.' : email}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field icon={UserRound} label="Full name *">
            <Input value={form.full_name} maxLength={40} onChange={(e) => setField('full_name', e.target.value)} placeholder="Your name" />
          </Field>
          <Field icon={Building2} label="Company / organization *">
            <Input value={form.organization} maxLength={60} onChange={(e) => setField('organization', e.target.value)} placeholder="Company or project name" />
          </Field>
          <Field icon={Globe} label="Website *" hint={form.website && !isUrl(form.website) ? 'Start with https://' : undefined}>
            <Input value={form.website} maxLength={120} onChange={(e) => setField('website', e.target.value)} placeholder="https://yourwebsite.com" />
          </Field>
          <Field icon={Phone} label="Phone number *" hint={form.phone && !isPhone(form.phone) ? 'Enter a valid mobile number' : undefined}>
            <PhoneInput value={form.phone} onChange={(v) => setField('phone', v)} />
          </Field>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field icon={Code} label="What will you build? *">
            <Select value={form.use_case} onValueChange={(v) => setField('use_case', v)}>
              <SelectTrigger><SelectValue placeholder="Select main use" /></SelectTrigger>
              <SelectContent>
                {Object.entries(USE_CASES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field icon={FileText} label="Short description *">
            <Textarea rows={4} value={form.description} maxLength={DESC_LIMIT} onChange={(e) => setField('description', e.target.value.slice(0, DESC_LIMIT))} placeholder="Tell us about your app or website..." />
            <p className="text-xs text-muted-foreground">{form.description.length}/{DESC_LIMIT} characters</p>
          </Field>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto max-w-lg">
          <Button className="h-12 w-full" disabled={!canSubmit || saving} onClick={handleSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'setup' ? 'Continue' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ icon: Icon, label, hint, children }: { icon: any; label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /> {label}
    </Label>
    {children}
    {hint && <p className="text-xs text-destructive">{hint}</p>}
  </div>
);

export default DeveloperOnboarding;
