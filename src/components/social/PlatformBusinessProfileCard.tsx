import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Loader2, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type Profile = {
  enabled: boolean;
  owner_name: string; owner_role: string; about_me: string;
  business_name: string; business_type: string; business_description: string;
  products_services: string; pricing: string; working_hours: string; location: string;
  contact_info: string; website: string; faqs: string; reply_rules: string; avoid_topics: string;
  tone: string; language: string; reply_length: string; signature: string;
};
type TextKey = Exclude<keyof Profile, 'enabled'>;

const EMPTY: Profile = {
  enabled: true, owner_name: '', owner_role: '', about_me: '', business_name: '', business_type: '',
  business_description: '', products_services: '', pricing: '', working_hours: '', location: '',
  contact_info: '', website: '', faqs: '', reply_rules: '', avoid_topics: '', tone: 'friendly',
  language: 'auto', reply_length: 'medium', signature: '',
};
const TEXT_KEYS = Object.keys(EMPTY).filter((key) => key !== 'enabled') as TextKey[];

export default function PlatformBusinessProfileCard({ platform, label, accountId = '' }: { platform: string; label: string; accountId?: string }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const result = await supabase.from('ai_platform_business_profiles')
        .select('*').eq('user_id', user.id).eq('platform', platform).eq('account_id', accountId).maybeSingle();
      let source: Partial<Profile> | null = result.data;
      if (!source && !result.error && accountId) {
        // New account: prefill from the platform-wide details (same fallback the AI uses).
        const platformRow = await supabase.from('ai_platform_business_profiles')
          .select('*').eq('user_id', user.id).eq('platform', platform).eq('account_id', '').maybeSingle();
        source = platformRow.data;
      }
      if (!source && !result.error) {
        const legacy = await supabase.from('ai_business_profiles').select('*').eq('user_id', user.id).maybeSingle();
        source = legacy.data;
      }
      if (active && source) {
        const next = { ...EMPTY, enabled: source.enabled !== false } as Profile;
        TEXT_KEYS.forEach((key) => { next[key] = String(source?.[key] ?? EMPTY[key]); });
        setProfile(next);
      }
      if (active) {
        if (result.error) toast.error(`Could not load ${label} AI profile`);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [accountId, label, platform, user]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((old) => ({ ...old, [key]: value }));
  const field = (key: keyof Profile, title: string, placeholder: string, rows?: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${platform}-${key}`} className="text-xs">{title}</Label>
      {rows ? (
        <Textarea id={`${platform}-${key}`} rows={rows} maxLength={5000} value={String(profile[key])}
          placeholder={placeholder} onChange={(event) => set(key, event.target.value as never)} />
      ) : (
        <Input id={`${platform}-${key}`} maxLength={300} value={String(profile[key])}
          placeholder={placeholder} onChange={(event) => set(key, event.target.value as never)} />
      )}
    </div>
  );

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const row = {
      user_id: user.id,
      platform,
      account_id: accountId,
      enabled: profile.enabled,
      ...Object.fromEntries(TEXT_KEYS.map((key) => [key, String(profile[key] ?? '').trim().slice(0, 5000) || null])),
      tone: profile.tone || 'friendly',
      language: profile.language || 'auto',
      reply_length: profile.reply_length || 'medium',
    };
    const { error } = await supabase.from('ai_platform_business_profiles').upsert(row, { onConflict: 'user_id,platform,account_id' });
    setSaving(false);
    if (error) toast.error(error.message || 'Save failed');
    else toast.success(`${label} AI profile saved`);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle className="text-base">AI identity for {label}</CardTitle><p className="mt-1 text-xs text-muted-foreground">These details are used only for {label} replies.</p></div>
          <Switch checked={profile.enabled} onCheckedChange={(value) => set('enabled', value)} aria-label={`Use business details for ${label}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" /> About you</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{field('owner_name', 'Your name', 'e.g. Rahul Sharma')}{field('owner_role', 'Your role', 'e.g. Founder or Support Manager')}</div>
          {field('about_me', 'About you', 'Your experience and how you help customers', 3)}
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><BriefcaseBusiness className="h-4 w-4" /> Your business</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{field('business_name', 'Business name', 'e.g. Sharma Electronics')}{field('business_type', 'Business type', 'e.g. Coaching, shop, agency')}</div>
          {field('business_description', 'What your business does', 'Describe your business clearly', 3)}
          {field('products_services', 'Products / services', 'List products and services, one per line', 4)}
          {field('pricing', 'Prices', 'Add only prices AI may quote', 3)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{field('working_hours', 'Working hours', 'e.g. Mon–Sat, 10am–8pm')}{field('location', 'Location / service area', 'e.g. Mumbai and nearby areas')}{field('contact_info', 'Contact details', 'Phone or email AI may share')}{field('website', 'Website / links', 'yourbusiness.in')}</div>
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Questions and reply rules</h3>
          {field('faqs', 'Common questions & answers', 'Q: Do you deliver?\nA: Yes, within 5 km.', 4)}
          {field('reply_rules', 'Reply rules', 'What AI should always do in replies', 3)}
          {field('avoid_topics', 'Never say / avoid', 'Topics, promises, or claims AI must avoid', 3)}
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Reply style</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label className="text-xs">Tone</Label><Select value={profile.tone} onValueChange={(value) => set('tone', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="professional">Professional</SelectItem><SelectItem value="casual">Casual</SelectItem><SelectItem value="formal">Formal</SelectItem><SelectItem value="supportive">Supportive</SelectItem><SelectItem value="sales">Sales-focused</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Language</Label><Select value={profile.language} onValueChange={(value) => set('language', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Same as customer</SelectItem><SelectItem value="Hindi">Hindi</SelectItem><SelectItem value="Hinglish">Hinglish</SelectItem><SelectItem value="English">English</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Reply length</Label><Select value={profile.reply_length} onValueChange={(value) => set('reply_length', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">Short</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="long">Detailed</SelectItem></SelectContent></Select></div>
          </div>
          {field('signature', 'Signature (optional)', `— Team ${profile.business_name || 'Your Business'}`)}
        </section>
        <Button className="h-11 w-full" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save {label} AI profile</Button>
      </CardContent>
    </Card>
  );
}