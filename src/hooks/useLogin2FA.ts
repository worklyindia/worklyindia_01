import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Login2FAResult {
  required: boolean;
  userId: string | null;
  telegramConnected: boolean;
  userType: 'job_seeker' | 'employer';
  twoFactorMethod: 'telegram' | 'google_authenticator' | 'passkey' | 'push_otp' | 'email_otp' | null;
  totpEnabled: boolean;
  passkeyEnabled: boolean;
  pushOtpEnabled: boolean;
  emailOtpEnabled: boolean;
}

interface UseLogin2FAOptions {
  userType: 'job_seeker' | 'employer';
}

export const useLogin2FA = ({ userType }: UseLogin2FAOptions) => {
  const [isChecking, setIsChecking] = useState(false);

  const check2FABeforeLogin = useCallback(async (email: string): Promise<Login2FAResult> => {
    setIsChecking(true);
    
    try {
      console.log(`[2FA] Checking ${userType} 2FA for email:`, email);
      
      // Call edge function to check 2FA status (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('unified-2fa', {
        body: { action: 'check-login', email, userType }
      });

      if (error) {
        console.error('[2FA] Edge function error:', error);
        return { required: false, userId: null, telegramConnected: false, userType, twoFactorMethod: null, totpEnabled: false, passkeyEnabled: false, pushOtpEnabled: false, emailOtpEnabled: false };
      }

      console.log(`[2FA] Result (${userType}):`, data);

      // Passkeys are device-bound and are NOT a login 2FA step.
      // Push is only a delivery channel for the same OTP, never its own method.
      const telegramConnected = data?.telegramConnected ?? false;
      const totpEnabled = data?.totpEnabled ?? false;
      const emailOtpEnabled = data?.emailOtpEnabled ?? false;
      const hasRealMethod = telegramConnected || totpEnabled || emailOtpEnabled;

      let twoFactorMethod = data?.twoFactorMethod ?? null;
      if (twoFactorMethod === 'passkey' || twoFactorMethod === 'push_otp') {
        twoFactorMethod = totpEnabled
          ? 'google_authenticator'
          : telegramConnected
            ? 'telegram'
            : emailOtpEnabled
              ? 'email_otp'
              : null;
      }

      return {
        required: (data?.required ?? false) && hasRealMethod,
        userId: data?.userId ?? null,
        telegramConnected,
        userType,
        twoFactorMethod,
        totpEnabled,
        passkeyEnabled: false,
        pushOtpEnabled: false,
        emailOtpEnabled,
      };
    } catch (error) {
      console.error('Error checking 2FA for login:', error);
      return { required: false, userId: null, telegramConnected: false, userType, twoFactorMethod: null, totpEnabled: false, passkeyEnabled: false, pushOtpEnabled: false, emailOtpEnabled: false };
    } finally {
      setIsChecking(false);
    }
  }, [userType]);

  return {
    check2FABeforeLogin,
    isChecking
  };
};
