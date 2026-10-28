import { PhoneInput } from '@/components/ui/phone-input';
import { isValidE164, displayPhone } from '@/lib/phone';
import { confirmedAccountPhone } from '@/lib/onboardingPhone';
import { useEffect, useMemo, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Code,
  FileText,
  Globe,
  Loader2,
  Pencil,
  Phone,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeveloperProfileForm {
  avatar_url: string;
  full_name: string;
  organization: string;
  website: string;
  phone: string;
  use_case: string;
  description: string;
}

const EMPTY_PROFILE: DeveloperProfileForm = {
  avatar_url: '',
  full_name: '',
  organization: '',
  website: '',
  phone: '',
  use_case: '',
  description: '',
};

const USE_CASES: Record<string, string> = {
  jobs: 'Show jobs on my website',
  whatsapp: 'WhatsApp inbox / messaging',
  email: 'Email inbox / sending',
  social: 'Instagram / Facebook inbox',
  oauth: 'Login with Workly India',
  other: 'Other',
};

const DESCRIPTION_LIMIT = 200;
const isPhone = (value: string) => isValidE164(value);
const isUrl = (value: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value.trim());

const DeveloperProfile = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [profile, setProfile] = useState<DeveloperProfileForm>(EMPTY_PROFILE);
  const [form, setForm] = useState<DeveloperProfileForm>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // Number confirmed on the login account — shown read-only, updates only
  // when the account's own number changes.
  const [authPhone, setAuthPhone] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
      setAuthPhone(confirmedAccountPhone(user));
      const { data, error } = await (supabase as any)
        .from('developer_profiles')
        .select('avatar_url, full_name, organization, website, phone, use_case, description')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast.error(error.message || 'Could not load developer profile.');
      } else if (data) {
        const loaded: DeveloperProfileForm = {
          avatar_url: data.avatar_url || '',
          full_name: data.full_name || '',
          organization: data.organization || '',
          website: data.website || '',
          phone: data.phone || '',
          use_case: data.use_case || '',
          description: data.description || '',
        };
        setProfile(loaded);
        setForm(loaded);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const canSave = useMemo(
    () =>
      !!form.avatar_url &&
      form.full_name.trim().length >= 2 &&
      form.organization.trim().length >= 2 &&
      isUrl(form.website) &&
      (authPhone ? true : isPhone(form.phone)) &&
      !!form.use_case &&
      form.description.trim().length >= 10,
    [form, authPhone],
  );

  const setField = (key: keyof DeveloperProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const cancelEditing = () => {
    setForm(profile);
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!userId || !canSave || saving) return;
    setSaving(true);
    const nextProfile: DeveloperProfileForm = {
      ...form,
      full_name: form.full_name.trim(),
      organization: form.organization.trim(),
      website: form.website.trim(),
      phone: authPhone || form.phone.replace(/\s/g, ''),
      description: form.description.trim(),
    };
    const { error } = await (supabase as any)
      .from('developer_profiles')
      .update({ ...nextProfile, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not update profile.');
      return;
    }
    setProfile(nextProfile);
    setForm(nextProfile);
    setEditing(false);
    toast.success('Developer profile updated');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
        <Button variant="ghost" size="icon" aria-label="Back to Developer Portal" onClick={() => goBack(navigate, '/developers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold text-foreground">Developer Profile</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={editing ? 'Cancel editing' : 'Edit developer profile'}
          onClick={() => editing ? cancelEditing() : setEditing(true)}
        >
          {editing ? <X className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
        </Button>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {editing ? (
            <ProfilePhotoUpload
              currentPhoto={form.avatar_url}
              onPhotoUpdate={(url) => setField('avatar_url', url)}
              useEmployerContext
              skipSave
            />
          ) : profile.avatar_url && !avatarFailed ? (
            <img
              key={profile.avatar_url}
              src={profile.avatar_url}
              alt={profile.full_name || 'Developer'}
              loading="eager"
              decoding="async"
              onError={() => setAvatarFailed(true)}
              className="block h-28 w-28 shrink-0 rounded-full border-2 border-border bg-muted object-cover opacity-100 shadow-lg"
            />
          ) : (
            <span className="flex h-28 w-28 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
              {(profile.full_name || email || 'D').charAt(0).toUpperCase()}
            </span>
          )}
          <h2 className="text-xl font-semibold text-foreground">{profile.full_name || 'Developer'}</h2>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        {editing ? (
          <div className="space-y-5">
            {!form.avatar_url && <p className="text-center text-xs text-destructive">Profile photo is required</p>}
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <EditField icon={UserRound} label="Full name *">
                <Input value={form.full_name} maxLength={40} onChange={(event) => setField('full_name', event.target.value)} />
              </EditField>
              <EditField icon={Building2} label="Company / organization *">
                <Input value={form.organization} maxLength={60} onChange={(event) => setField('organization', event.target.value)} />
              </EditField>
              <EditField icon={Globe} label="Website *" hint={form.website && !isUrl(form.website) ? 'Start with https://' : undefined}>
                <Input value={form.website} maxLength={120} onChange={(event) => setField('website', event.target.value)} />
              </EditField>
              {authPhone ? (
                <EditField icon={Phone} label="Phone number *">
                  <Input value={authPhone} disabled />
                  <p className="text-xs text-muted-foreground">Number comes from your login account and updates only when that changes.</p>
                </EditField>
              ) : (
                <EditField icon={Phone} label="Phone number *" hint={form.phone && !isPhone(form.phone) ? 'Enter a valid mobile number' : undefined}>
                  <PhoneInput value={form.phone} onChange={(v) => setField('phone', v)} />
                </EditField>
              )}
            </section>
            <section className="space-y-4 rounded-lg border border-border bg-card p-4">
              <EditField icon={Code} label="What will you build? *">
                <Select value={form.use_case} onValueChange={(value) => setField('use_case', value)}>
                  <SelectTrigger><SelectValue placeholder="Select main use" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(USE_CASES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </EditField>
              <EditField icon={FileText} label="Short description *">
                <Textarea
                  rows={4}
                  value={form.description}
                  maxLength={DESCRIPTION_LIMIT}
                  onChange={(event) => setField('description', event.target.value.slice(0, DESCRIPTION_LIMIT))}
                />
                <p className="text-xs text-muted-foreground">{form.description.length}/{DESCRIPTION_LIMIT} characters</p>
              </EditField>
            </section>
            <Button className="h-12 w-full" disabled={!canSave || saving} onClick={saveProfile}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        ) : (
          <section className="divide-y divide-border rounded-lg border border-border bg-card px-4">
            <ProfileRow icon={Building2} label="Company / organization" value={profile.organization} />
            <ProfileRow icon={Globe} label="Website" value={profile.website} link />
            <ProfileRow icon={Phone} label="Phone number" value={displayPhone(authPhone || profile.phone)} />
            <ProfileRow icon={Code} label="What you build" value={USE_CASES[profile.use_case] || profile.use_case} />
            <ProfileRow icon={FileText} label="About" value={profile.description} multiline />
          </section>
        )}
      </main>
    </div>
  );
};

const EditField = ({ icon: Icon, label, hint, children }: { icon: typeof UserRound; label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /> {label}
    </Label>
    {children}
    {hint && <p className="text-xs text-destructive">{hint}</p>}
  </div>
);

const ProfileRow = ({ icon: Icon, label, value, link = false, multiline = false }: { icon: typeof UserRound; label: string; value: string; link?: boolean; multiline?: boolean }) => (
  <div className={`flex gap-3 py-4 ${multiline ? 'items-start' : 'items-center'}`}>
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {link && value ? (
        <a href={value} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-primary hover:underline">{value}</a>
      ) : (
        <p className={`text-sm font-medium text-foreground ${multiline ? 'whitespace-pre-wrap' : 'break-words'}`}>{value || 'Not added'}</p>
      )}
    </div>
  </div>
);

export default DeveloperProfile;