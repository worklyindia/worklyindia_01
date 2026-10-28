import { supabase } from '@/integrations/supabase/client';

/**
 * Cleans a typed/pasted/autofilled identifier: removes zero-width and other
 * invisible characters, non-breaking spaces and stray whitespace, and
 * lowercases email addresses. Keeps mobile numbers untouched apart from spaces.
 */
export const sanitizeIdentifier = (value: string) => {
  const cleaned = (value || '')
    // zero-width space/joiner, BOM, soft hyphen, LTR/RTL marks
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
  return cleaned.includes('@') ? cleaned.replace(/\s+/g, '').toLowerCase() : cleaned;
};

/** True when the typed value looks like a mobile number instead of an email. */
export const isPhoneIdentifier = (value: string) => {
  const v = sanitizeIdentifier(value);
  if (!v || v.includes('@')) return false;
  const digits = v.replace(/\D/g, '');
  return /^[+\d\s()-]+$/.test(v) && digits.length >= 10 && digits.length <= 15;
};

export const normalizePhoneIdentifier = (value: string) => (value || '').replace(/\D/g, '');

/**
 * True as soon as the typed value starts looking like a phone number
 * (digits/symbols only, no letters, no @). Used to swap the login field's
 * email icon for a country picker while the user is still typing.
 */
export const looksLikePhoneInput = (value: string) => {
  const v = (value || '').trim();
  if (!v || v.includes('@')) return false;
  return /^[+\d\s()-]+$/.test(v) && /\d/.test(v);
};

/**
 * Signs in with either an email address or a mobile number.
 * Mobile numbers are resolved to the account email server-side.
 */
export const signInWithIdentifier = async (
  identifier: string,
  password: string
): Promise<{ error: any }> => {
  const value = sanitizeIdentifier(identifier);

  if (!isPhoneIdentifier(value)) {
    const { error } = await supabase.auth.signInWithPassword({ email: value, password });
    return { error };
  }

  const { data, error } = await supabase.functions.invoke('unified-ai-tricks', {
    body: { action: 'phone_password_login', phone: normalizePhoneIdentifier(value), password },
  });


  if (error) {
    return { error: { message: 'Invalid login credentials' } };
  }
  if (!data?.access_token || !data?.refresh_token) {
    return { error: { message: data?.error || 'Invalid login credentials' } };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  return { error: sessionError };
};
