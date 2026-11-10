import { PhoneInput } from '@/components/ui/phone-input';
import { isValidE164 } from '@/lib/phone';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ReferralProfileDetails } from '@/utils/referralProfile';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import PhoneVerifyBox from '@/components/auth/PhoneVerifyBox';
import SupabaseLocationDetector from '@/components/SupabaseLocationDetector';

export const ReferralProfileForm = ({ value, onChange, disabled = false, originalPhone = '', onValidityChange }: {
  value: ReferralProfileDetails;
  onChange: (value: ReferralProfileDetails) => void;
  disabled?: boolean;
  originalPhone?: string;
  onValidityChange?: (valid: boolean) => void;
}) => {
  const { user } = useAuth();
  const valueRef = useRef(value);
  valueRef.current = value;
  const field = useCallback((key: keyof ReferralProfileDetails, next: string) => {
    const updated = { ...valueRef.current, [key]: next };
    valueRef.current = updated;
    onChange(updated);
  }, [onChange]);
  const phoneE164 = normalizePhoneE164(value.phone);
  const originalE164 = normalizePhoneE164(originalPhone);
  const phoneChanged = phoneE164 !== originalE164;
  const [phoneVerified, setPhoneVerified] = useState(() => Boolean(originalE164) && !phoneChanged);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [phoneCheckError, setPhoneCheckError] = useState('');
  const [locationValid, setLocationValid] = useState(false);
  const initialLocation = useMemo(() => ({
    fullAddress: value.precise_address, city: value.city, state: value.state,
    postalCode: value.postal_code, country: value.country,
  }), []);
  const handleLocationChange = useCallback((location: { fullAddress: string; city: string; state: string; postalCode: string; country: string }) => {
    onChange({ ...valueRef.current, precise_address: location.fullAddress, city: location.city, state: location.state, postal_code: location.postalCode, country: location.country });
  }, [onChange]);
  const handleLocationSaved = useCallback((location: { fullAddress?: string; city: string; state: string; postcode?: string; country: string }) => {
    onChange({ ...valueRef.current, precise_address: location.fullAddress || '', city: location.city, state: location.state, postal_code: location.postcode || '', country: location.country });
  }, [onChange]);

  useEffect(() => {
    setPhoneVerified(Boolean(originalE164) && phoneE164 === originalE164);
  }, [phoneE164, originalE164]);

  useEffect(() => {
    const digits = phoneE164.replace(/\D/g, '');
    if (digits.length !== 12 || !digits.startsWith('91') || !user?.id) {
      setDuplicatePhone(false); setPhoneCheckError(''); setCheckingPhone(false); return;
    }
    let active = true;
    setCheckingPhone(true); setPhoneCheckError('');
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.from('referral_profiles').select('user_id, phone').neq('user_id', user.id);
      if (!active) return;
      if (error) {
        setPhoneCheckError('Unable to verify mobile number'); setDuplicatePhone(false);
      } else {
        setDuplicatePhone((data || []).some(row => normalizePhoneE164(row.phone || '') === phoneE164));
      }
      setCheckingPhone(false);
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [phoneE164, user?.id]);

  const phoneReady = isValidE164(phoneE164) && !duplicatePhone && !checkingPhone && !phoneCheckError && phoneVerified;
  useEffect(() => onValidityChange?.(phoneReady && locationValid), [phoneReady, locationValid, onValidityChange]);

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <div className="space-y-2 text-center">
        <Label>Profile photo *</Label>
        <ProfilePhotoUpload currentPhoto={value.photo_url || undefined} skipSave
          photoFolder={user ? `profile-photos/${user.id}/referral` : undefined}
          onPhotoUpdate={url => field('photo_url', url)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ref-display-name">Display name *</Label>
        <Input id="ref-display-name" autoComplete="name" required minLength={2} maxLength={22}
          value={value.display_name} onChange={e => field('display_name', e.target.value.replace(/[^\p{L} ]/gu, '').slice(0, 22))} placeholder="Your referral name" />
        <p className="text-right text-xs text-muted-foreground">{value.display_name.length}/22</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ref-mobile">Mobile number *</Label>
        <PhoneInput id="ref-mobile" value={value.phone} onChange={v => field('phone', v)} />
        {checkingPhone && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking mobile number…</p>}
        {duplicatePhone && <p role="alert" className="text-sm text-destructive">This mobile number is already used by another referral profile.</p>}
        {phoneCheckError && <p role="alert" className="text-sm text-destructive">{phoneCheckError}</p>}
        {!phoneChanged && originalE164 && !duplicatePhone && <p className="flex items-center gap-2 text-sm text-success"><BadgeCheck className="h-4 w-4" />Mobile number verified</p>}
        {phoneChanged && !duplicatePhone && !checkingPhone && !phoneCheckError && isValidE164(phoneE164) && (
          <PhoneVerifyBox phone={phoneE164} mode="profile" verified={phoneVerified} onVerified={verified => { field('phone', verified); setPhoneVerified(true); }} />
        )}
      </div>
      <div className="space-y-3 border-t border-border pt-5">
        <h2 className="text-base font-semibold">Location</h2>
        <SupabaseLocationDetector type="referral" autoSave={false} hideSaveButton
          initialValues={initialLocation} onValidationChange={setLocationValid}
          onFormDataChange={handleLocationChange} onLocationSaved={handleLocationSaved} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ref-occupation">Occupation *</Label>
        <Input id="ref-occupation" required minLength={2} maxLength={80} value={value.occupation}
          onChange={e => field('occupation', e.target.value)} placeholder="e.g. Student, Recruiter, Self-employed" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ref-bio">About you (optional)</Label>
        <Textarea id="ref-bio" maxLength={300} rows={3} value={value.bio}
          onChange={e => field('bio', e.target.value)} placeholder="About you" />
        <p className="text-right text-xs text-muted-foreground">{value.bio.length}/300</p>
      </div>
    </fieldset>
  );
};