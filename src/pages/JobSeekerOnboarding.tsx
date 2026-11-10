import { supabase } from '@/integrations/supabase/client';
import { triggerPushEvent } from '@/hooks/usePushTrigger';
import { linkSignupVerifiedPhone } from '@/lib/signupPhoneProof';
import { onboardingPhoneAllowed } from '@/lib/onboardingPhone';
import { useOnboardingPhoneVerification } from '@/hooks/useOnboardingPhoneVerification';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, User, Cake, Phone, MessageCircle, MapPin, LogOut, Check, AlertCircle, CalendarIcon, Clock } from 'lucide-react';
import { format, differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import SupabaseLocationDetector from '@/components/SupabaseLocationDetector';
import { NativeFeedbackButton } from '@/components/NativeFeedbackButton';
import { useAuth } from '@/contexts/AuthContext';
import { BirthDetailsDisplay } from '@/components/BirthDetailsDisplay';
import { useToast } from '@/hooks/use-toast';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  markOnboardingComplete,
  saveOnboardingDraft,
  loadOnboardingDraft,
  isOnboardingComplete,
} from '@/utils/onboardingStatus';

interface SetupForm {
  profile_image_url: string;
  full_name: string;
  date_of_birth: string;
  phone: string;
  whatsapp_number: string;
  location: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const emptyForm: SetupForm = {
  profile_image_url: '',
  full_name: '',
  date_of_birth: '',
  phone: '',
  whatsapp_number: '',
  location: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

const NAME_LIMIT = 22;
const isFullNumber = (value: string) => /^\+91\d{10}$/.test((value || '').replace(/\s/g, ''));

const JobSeekerOnboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, updateProfile, signOut } = useAuth();
  const { toast } = useToast();

  const redirect = searchParams.get('redirect');
  const destination = redirect ? decodeURIComponent(redirect) : '/';

  const draftRef = useRef(loadOnboardingDraft<SetupForm>('jobseeker'));
  const [form, setForm] = useState<SetupForm>(() => ({ ...emptyForm, ...draftRef.current }));
  const [saving, setSaving] = useState(false);

  const {
    phone,
    setPhone,
    isChecking: isCheckingPhone,
    isAvailable: isPhoneAvailable,
    error: phoneError,
    isDuplicate: isPhoneDuplicate,
  } = usePhoneValidation('job_seeker', user?.id);

  // Number verified at signup lives on the login account: show it locked, change only from Settings.
  const signupMeta = ((user as any)?.user_metadata || {}) as { mobile_number?: string; phone_verified?: boolean };
  const signupDigits = String(signupMeta.mobile_number || '').replace(/\D/g, '');
  const signupPhone = signupDigits.length === 10 ? `+91${signupDigits}` : signupDigits.length >= 11 ? `+${signupDigits}` : '';
  const { authPhone, phoneLocked, phoneVerifyEnabled, phoneVerifyLoading, onVerified } =
    useOnboardingPhoneVerification(user, 'phone_verify_jobseeker_signup');

  // Seed the number fields once from the saved draft / existing profile
  // Move an OTP-verified signup number onto this login account (server-checked).
  useEffect(() => {
    if (user?.id && !user.phone) void linkSignupVerifiedPhone(supabase as any);
  }, [user?.id, user?.phone]);

  // A verified login number always wins and stays locked.
  useEffect(() => {
    if (authPhone && phone !== authPhone) setPhone(authPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPhone]);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    const p = authPhone || draftRef.current.phone || signupPhone || (profile as any)?.phone || '';
    if (p || profile) {
      if (p) setPhone(p);
      seeded.current = true;
    }
  }, [profile, authPhone, signupPhone, setPhone]);

  // Keep the persisted draft in sync with the validated numbers
  useEffect(() => {
    setForm((prev) => {
      if (prev.phone === phone && prev.whatsapp_number === phone) return prev;
      const next = { ...prev, phone, whatsapp_number: phone };
      saveOnboardingDraft('jobseeker', next);
      return next;
    });
  }, [phone]);

  // Already done locally? Never show this screen again.
  useEffect(() => {
    if (isOnboardingComplete('jobseeker')) {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate]);

  // Server is the source of truth: if the account is already complete in the
  // database (browser data was cleared / new device), restore the local flag.
  useEffect(() => {
    if (profile && (profile as any).is_profile_complete) {
      markOnboardingComplete('jobseeker');
      navigate(destination, { replace: true });
    }
  }, [profile, destination, navigate]);

  // Prefill from an existing profile (e.g. social login gave us a name/photo).
  useEffect(() => {
    if (!profile) return;
    setForm((prev) => {
      const next = {
        ...prev,
        profile_image_url: prev.profile_image_url || (profile as any).profile_image_url || '',
        full_name: prev.full_name || (profile.full_name || '').slice(0, NAME_LIMIT),
        date_of_birth: prev.date_of_birth || (profile as any).date_of_birth || '',
        location: prev.location || profile.location || '',
        city: prev.city || (profile as any).city || '',
        state: prev.state || (profile as any).state || '',
        postal_code: prev.postal_code || (profile as any).postal_code || '',
        country: prev.country || (profile as any).country || '',
      };
      saveOnboardingDraft('jobseeker', next);
      return next;
    });
  }, [profile]);

  const setField = (key: keyof SetupForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveOnboardingDraft('jobseeker', next);
      return next;
    });
  };

  const handleLocationChange = useCallback((data: {
    fullAddress: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }) => {
    setForm((prev) => {
      const next = {
        ...prev,
        location: data.fullAddress,
        city: data.city,
        state: data.state,
        postal_code: data.postalCode,
        country: data.country,
      };
      if (
        prev.location === next.location &&
        prev.city === next.city &&
        prev.state === next.state &&
        prev.postal_code === next.postal_code &&
        prev.country === next.country
      ) {
        return prev;
      }
      saveOnboardingDraft('jobseeker', next);
      return next;
    });
  }, []);

  // Setup counts as complete ONLY when every field on this page is filled.
  const canSubmit = useMemo(
    () =>
      !!form.profile_image_url &&
      form.full_name.trim().length >= 2 &&
      !!form.date_of_birth &&
      isFullNumber(phone) &&
      onboardingPhoneAllowed(phoneVerifyEnabled, phoneVerifyLoading, authPhone, phone, isPhoneAvailable) &&
      form.location.trim().length >= 2 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      form.postal_code.trim().length > 0 &&
      form.country.trim().length > 0,
    [form, phone, authPhone, phoneVerifyEnabled, phoneVerifyLoading, isPhoneAvailable],
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit || saving) return;
    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: form.full_name.trim(),
        phone: phone.trim(),
        whatsapp_number: phone.trim(),
        location: form.location.trim(),
        is_profile_complete: true,
        profile_image_url: form.profile_image_url,
        date_of_birth: form.date_of_birth,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        country: form.country,
      } as any);

      if (error) throw error;

      if (user?.id) void triggerPushEvent('push_signup_welcome', user.id, 'website_user', form.full_name || undefined, { user_name: form.full_name, name: form.full_name });
      markOnboardingComplete('jobseeker');
      toast({ title: 'Setup complete', description: 'Your account is ready.' });
      navigate(destination, { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: err?.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="px-4 pt-6 space-y-6 max-w-lg mx-auto">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" /> Log out
          </Button>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold">A little about you</h2>
          <p className="text-sm text-muted-foreground">
            Please fill in every detail below to continue.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <ProfilePhotoUpload
            currentPhoto={form.profile_image_url}
            onPhotoUpdate={(url) => setField('profile_image_url', url)}
          />
          {!form.profile_image_url && (
            <p className="text-xs text-destructive">Profile photo is required</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <User className="w-3.5 h-3.5 text-primary" /> Full name *
            </Label>
            <Input
              value={form.full_name}
              maxLength={NAME_LIMIT}
              onChange={(e) => setField('full_name', e.target.value.slice(0, NAME_LIMIT))}
              placeholder="Your full name"
            />
            <p className="text-xs text-muted-foreground">
              {form.full_name.length}/{NAME_LIMIT} characters
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground flex-wrap">
              <Cake className="w-3.5 h-3.5 text-primary" /> Date of birth *
              {form.date_of_birth && (() => {
                const bd = new Date(form.date_of_birth + 'T00:00:00');
                const n = new Date();
                const y = differenceInYears(n, bd);
                const am = addYears(bd, y);
                const m = differenceInMonths(n, am);
                const aM = addMonths(am, m);
                const d = differenceInDays(n, aM);
                return (
                  <span className="text-[10px] font-semibold text-primary ml-1">
                    ({y}Y, {m}M, {d}D)
                  </span>
                );
              })()}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !form.date_of_birth && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.date_of_birth
                    ? format(new Date(form.date_of_birth + 'T00:00:00'), 'dd MMMM yyyy')
                    : 'Select your birthday'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.date_of_birth ? new Date(form.date_of_birth + 'T00:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setField('date_of_birth', format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  disabled={(date) => date > new Date() || date < new Date('1940-01-01')}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1940}
                  toYear={new Date().getFullYear()}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            {form.date_of_birth && <BirthDetailsDisplay dateOfBirth={form.date_of_birth} />}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Phone className="w-3.5 h-3.5 text-primary" /> Phone number *
            </Label>
            <div className="relative">
              <PhoneInput
                value={phone}
                disabled={phoneLocked}
                onChange={(v) => { if (!phoneLocked) setPhone(v); }}
                className={isPhoneDuplicate ? '[&_input]:border-destructive' : isPhoneAvailable ? '[&_input]:border-green-500' : ''}
              />
              {isCheckingPhone && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {!isCheckingPhone && isPhoneAvailable && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
              {!isCheckingPhone && isPhoneDuplicate && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive" />
              )}
            </div>
            <p className={`text-xs ${phoneError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {phoneLocked ? 'Verified number.' : phoneError || 'Select your country code and enter your number.'}
            </p>
            {phoneVerifyEnabled && !phoneVerifyLoading && !phoneLocked && isPhoneAvailable === true && !isCheckingPhone && (
              <PhoneVerifyBox
                key={`${user?.id}:${phone}`}
                phone={phone}
                mode="profile"
                verified={false}
                autoSend={false}
                onVerified={(verifiedPhone) => { onVerified(verifiedPhone); setPhone(verifiedPhone); }}
              />
            )}
          </div>

        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 text-primary" /> Location *
          </Label>
          <SupabaseLocationDetector
            type="profile"
            autoSave={false}
            hideSaveButton
            initialValues={{
              fullAddress: form.location,
              city: form.city,
              state: form.state,
              postalCode: form.postal_code,
              country: form.country,
            }}
            onFormDataChange={handleLocationChange}
          />
        </div>
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-4 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <NativeFeedbackButton
          className="w-full h-12 text-base font-semibold"
          disabled={!canSubmit || saving}
          onClick={handleSubmit}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </span>
          ) : (
            'Complete & Continue'
          )}
        </NativeFeedbackButton>
      </footer>
    </div>
  );
};

export default JobSeekerOnboarding;
