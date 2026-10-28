import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getPendingReferralCode, clearPendingReferralCode } from '@/utils/pendingReferral';

/**
 * Applies a referral code that was entered (or arrived via ?ref=) before signup.
 * The code survives page reloads / email confirmation because it is stored in
 * localStorage, so the referral relationship (and the referrer's notification)
 * is created as soon as the new user has a session — from any page.
 */
const PendingReferralApplier = () => {
  const { user, loading } = useAuth();
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user?.id) return;
    if (attemptedFor.current === user.id) return;

    const code = getPendingReferralCode();
    if (!code) return;

    attemptedFor.current = user.id;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-referral-relationship', {
          body: { referral_code: code, referred_user_id: user.id },
        });

        // Clear on success and on permanent failures (invalid code, self-referral,
        // already referred) so we don't retry forever.
        const message = (data?.error || error?.message || '').toLowerCase();
        const permanent =
          data?.success === true ||
          message.includes('invalid') ||
          message.includes('yourself') ||
          message.includes('already');

        if (permanent) clearPendingReferralCode();
      } catch {
        /* keep the code stored and retry on the next session */
      }
    })();
  }, [user, loading]);

  return null;
};

export default PendingReferralApplier;
