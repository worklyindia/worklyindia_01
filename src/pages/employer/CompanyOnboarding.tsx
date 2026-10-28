import { supabase } from '@/integrations/supabase/client';
import { triggerPushEvent } from '@/hooks/usePushTrigger';
import { linkSignupVerifiedPhone } from '@/lib/signupPhoneProof';
import { onboardingPhoneAllowed } from '@/lib/onboardingPhone';
import { useOnboardingPhoneVerification } from '@/hooks/useOnboardingPhoneVerification';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  UserRound,
  LogOut,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import SupabaseLocationDetector from '@/components/SupabaseLocationDetector';
import { NativeFeedbackButton } from '@/components/NativeFeedbackButton';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { businessTypeLabels } from '@/utils/businessTypeUtils';
import { usePhoneValidation } from '@/hooks/usePhoneValidation';
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from 'sonner';
import {
  markOnboardingComplete,
  saveOnboardingDraft,
  loadOnboardingDraft,
  isOnboardingComplete,
} from '@/utils/onboardingStatus';

interface CompanyForm {
  logo_url: string;
  company_name: string;
  business_type: string;
  company_details: string;
  phone: string;
  whatsapp_number: string;
  hr_contact_name: string;
  location: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const emptyForm: CompanyForm = {
  logo_url: '',
  company_name: '',
  business_type: '',
  company_details: '',
  phone: '',
  whatsapp_number: '',
  hr_contact_name: '',
  location: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

const NAME_LIMIT = 22;
const DETAILS_LIMIT = 120;
const isFullNumber = (value: string) => /^\+91\d{10}$/.test((value || '').replace(/\s/g, ''));
const nameInput = (value: string) => value.replace(/[0-9]/g, '').slice(0, NAME_LIMIT);

const CompanyOnboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, company, updateCompany, signOut } = useEmployerAuth();

  const redirect = searchParams.get('redirect');
  const destination = redirect ? decodeURIComponent(redirect) : '/employer-portal';

  const draftRef = useRef(loadOnboardingDraft<CompanyForm>('employer'));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanyForm>(() => ({ ...emptyForm, ...draftRef.current }));

  const {
    phone,
    setPhone,
    isChecking: isCheckingPhone,
    isAvailable: isPhoneAvailable,
    error: phoneError,
    isDuplicate: isPhoneDuplicate,
  } = usePhoneValidation('employer', user?.id, company?.id);

  // Number verified at signup lives on the login account: show it locked, change only from Settings.
  const signupMeta = ((user as any)?.user_metadata || {}) as { mobile_number?: string; phone_verified?: boolean };
  const signupDigits = String(signupMeta.mobile_number || '').replace(/\D/g, '');
  const signupPhone = signupDigits.length === 10 ? `+91${signupDigits}` : signupDigits.length >= 11 ? `+${signupDigits}` : '';
  const { authPhone, phoneLocked, phoneVerifyEnabled, phoneVerifyLoading, onVerified } =
    useOnboardingPhoneVerification(user, 'phone_verify_employer_signup');

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
    const p = authPhone || draftRef.current.phone || signupPhone || (company as any)?.phone || '';
    if (p || company) {
      if (p) setPhone(p);
      seeded.current = true;
    }
  }, [company, authPhone, signupPhone, setPhone]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.phone === phone && prev.whatsapp_number === phone) return prev;
      const next = { ...prev, phone, whatsapp_number: phone };
      saveOnboardingDraft('employer', next);
      return next;
    });
  }, [phone]);

  useEffect(() => {
    if (isOnboardingComplete('employer')) {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate]);

  // Database wins: if the company profile is already complete on the server,
  // restore the local flag so this screen never shows again.
  useEffect(() => {
    if (company && (company as any).is_profile_complete) {
      markOnboardingComplete('employer');
      navigate(destination, { replace: true });
    }
  }, [company, destination, navigate]);

  useEffect(() => {
    if (!company) return;
    setForm((prev) => {
      const next = {
        ...prev,
        logo_url: prev.logo_url || (company as any).logo_url || '',
        company_name: prev.company_name || nameInput(company.company_name || ''),
        business_type: prev.business_type || (company as any).business_type || '',
        company_details: prev.company_details || (company.company_details || '').slice(0, DETAILS_LIMIT),
        hr_contact_name: prev.hr_contact_name || nameInput(company.hr_contact_name || ''),
        location: prev.location || (company as any).location || '',
        city: prev.city || company.city || '',
        state: prev.state || (company as any).state || '',
        postal_code: prev.postal_code || company.postal_code || '',
        country: prev.country || (company as any).country || '',
      };
      saveOnboardingDraft('employer', next);
      return next;
    });
  }, [company]);

  const setField = (key: keyof CompanyForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      saveOnboardingDraft('employer', next);
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
      saveOnboardingDraft('employer', next);
      return next;
    });
  }, []);

  // Setup counts as complete ONLY when every field on this page is filled.
  const canSubmit = useMemo(
    () =>
      !!form.logo_url &&
      form.company_name.trim().length >= 2 &&
      !!form.business_type &&
      form.company_details.trim().length >= 2 &&
      form.hr_contact_name.trim().length >= 2 &&
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
      const { error } = await updateCompany({
        company_name: form.company_name.trim(),
        company_details: form.company_details.trim(),
        whatsapp_number: phone.trim(),
        phone: phone.trim(),
        hr_contact_name: form.hr_contact_name.trim(),
        is_profile_complete: true,
        email: user.email,
        logo_url: form.logo_url,
        business_type: form.business_type,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        country: form.country,
        location: form.location,
      } as any);

      if (error) throw error;

      if (user?.id) void triggerPushEvent('push_employer_signup_welcome', user.id, 'employer', form.company_name || undefined, { company_name: form.company_name, company: form.company_name });
      markOnboardingComplete('employer');
      toast.success('Company setup complete');
      navigate(destination, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Could not save. Please try again.');
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
            currentPhoto={form.logo_url}
            onPhotoUpdate={(url) => setField('logo_url', url)}
            useEmployerContext
          />
          {!form.logo_url && <p className="text-xs text-destructive">Company logo is required</p>}
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Company name *
            </Label>
            <Input
              value={form.company_name}
              maxLength={NAME_LIMIT}
              onChange={(e) => setField('company_name', nameInput(e.target.value))}
              placeholder="Your company name"
            />
            <p className="text-xs text-muted-foreground">
              {form.company_name.length}/{NAME_LIMIT} characters
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Business type *</Label>
            <Select value={form.business_type} onValueChange={(v) => setField('business_type', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(businessTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <FileText className="w-3.5 h-3.5 text-primary" /> Short description *
            </Label>
            <Textarea
              rows={4}
              value={form.company_details}
              maxLength={DETAILS_LIMIT}
              onChange={(e) => setField('company_details', e.target.value.slice(0, DETAILS_LIMIT))}
              placeholder="What does your company do..."
            />
            <p className="text-xs text-muted-foreground">
              {form.company_details.length}/{DETAILS_LIMIT} characters
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4">
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
            type="company"
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

export default CompanyOnboarding;
