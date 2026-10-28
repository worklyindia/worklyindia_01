import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, MessageCircle, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Item = { key: string; title: string; note: string; icon: typeof User };

const NUMBER_VERIFY: Item[] = [
  { key: 'number_verify_all', title: 'Job Seeker & Employer', note: 'Create Account, Onboarding and Settings', icon: User },
];

const ALL_KEYS = NUMBER_VERIFY.map((p) => p.key);

const SignupOtpSettings = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ALL_KEYS)
      .then(({ data }) => {
        setValues(Object.fromEntries((data || []).map((r) => [r.setting_key, r.setting_value === 'true'])));
        setLoading(false);
      });
  }, []);

  const toggle = async (key: string, on: boolean) => {
    setSaving(key);
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: on }));
    const { error } = await supabase
      .from('app_settings')
      .update({ setting_value: on ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('setting_key', key);
    setSaving(null);
    if (error) {
      setValues((v) => ({ ...v, [key]: prev }));
      toast.error('Could not save');
    } else {
      toast.success(on ? 'Turned on' : 'Turned off');
    }
  };

  const section = (title: string, hint: string, Icon: typeof User, items: Item[]) => (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="px-1 text-xs text-muted-foreground">{hint}</p>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map(({ key, title: t, note, icon: ItemIcon }) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ItemIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t}</p>
              <p className="text-xs text-muted-foreground">{note}</p>
            </div>
            <Switch checked={!!values[key]} disabled={saving === key} onCheckedChange={(on) => toggle(key, on)} />
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Verify OTP</h1>
      </header>

      <main className="mx-auto max-w-xl space-y-6 p-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {section('Number Verify', 'ON: the code is sent on WhatsApp. OFF: no code is sent.', MessageCircle, NUMBER_VERIFY)}
            <p className="flex items-start gap-2 rounded-2xl border bg-card p-4 text-xs text-muted-foreground">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Email verification follows the Supabase "Confirm email" setting: when it is on, a code is emailed after Create Account.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default SignupOtpSettings;
