export interface ReferralProfileDetails {
  display_name: string;
  phone: string;
  photo_url: string;
  city: string;
  state: string;
  country: string;
  precise_address: string;
  postal_code: string;
  occupation: string;
  bio: string;
}

export const emptyReferralProfile: ReferralProfileDetails = {
  display_name: '', phone: '', photo_url: '', city: '', state: '', country: '', precise_address: '', postal_code: '', occupation: '', bio: '',
};

export const referralProfileError = (profile: Partial<ReferralProfileDetails> | null | undefined): string | null => {
  if (!profile?.photo_url?.trim()) return 'Please add your profile photo.';
  const name = profile.display_name?.trim() || '';
  if (!/^[\p{L}][\p{L} ]{1,21}$/u.test(name)) return 'Name must contain only letters and spaces (2–22 characters).';
  if (!/^\+?[1-9]\d{9,14}$/.test((profile.phone || '').replace(/[\s()-]/g, ''))) return 'Please enter a valid mobile number.';
  for (const key of ['city', 'state', 'country', 'occupation'] as const) {
    const value = profile[key]?.trim() || '';
    if (value.length < 2 || value.length > 80) return `Please enter your ${key} (2–80 characters).`;
  }
  if ((profile.precise_address?.trim() || '').length < 5 || (profile.precise_address?.trim() || '').length > 300) return 'Please enter your full address.';
  if ((profile.postal_code?.trim() || '').length < 3 || (profile.postal_code?.trim() || '').length > 12) return 'Please enter a valid postal code.';
  if ((profile.bio || '').length > 300) return 'Bio must be within 300 characters.';
  return null;
};

export const isReferralProfileComplete = (profile: Partial<ReferralProfileDetails> | null | undefined) =>
  referralProfileError(profile) === null;

export const toReferralForm = (profile: Record<string, unknown> | null | undefined): ReferralProfileDetails =>
  Object.fromEntries(Object.keys(emptyReferralProfile).map(key => [key, typeof profile?.[key] === 'string' ? profile[key] : ''])) as unknown as ReferralProfileDetails;

export const referralProfilePayload = (form: ReferralProfileDetails) => ({
  display_name: form.display_name.trim(), phone: form.phone.replace(/[\s()-]/g, ''),
  photo_url: form.photo_url.trim(), city: form.city.trim(), state: form.state.trim(),
  country: form.country.trim(), precise_address: form.precise_address.trim(), postal_code: form.postal_code.trim(),
  occupation: form.occupation.trim(), bio: form.bio.trim() || null,
});