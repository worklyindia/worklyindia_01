import { useCallback, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { usePhoneVerifySetting, type PhoneVerifyKey } from '@/hooks/usePhoneVerifySetting';
import { verifiedOnboardingPhone } from '@/lib/onboardingPhone';

/** Shared owner switch and account-scoped confirmed phone for both setup pages. */
export function useOnboardingPhoneVerification(user: User | null, key: PhoneVerifyKey) {
  const { phoneVerifyEnabled, phoneVerifyLoading } = usePhoneVerifySetting(key);
  const [confirmed, setConfirmed] = useState<{ userId: string; phone: string } | null>(null);
  const authPhone = verifiedOnboardingPhone(user) || (confirmed?.userId === user?.id ? confirmed?.phone || '' : '');
  const onVerified = useCallback((phone: string) => {
    if (user?.id) setConfirmed({ userId: user.id, phone });
  }, [user?.id]);
  return { authPhone, phoneLocked: Boolean(authPhone), phoneVerifyEnabled, phoneVerifyLoading, onVerified };
}