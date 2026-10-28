import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Phone (SMS) OTP login via Supabase Auth phone provider (Twilio).
 * Cooldown is persisted in localStorage so a page refresh cannot bypass it.
 */

const COOLDOWN_SECONDS = 60;
const STORAGE_PREFIX = 'phone_otp_cooldown:';

/** Detects whether the typed identifier is a phone number instead of an email. */
export const isPhoneIdentifier = (value: string): boolean => {
  const v = (value || '').trim();
  if (!v || v.includes('@')) return false;
  const digits = v.replace(/\D/g, '');
  return /^\+?[\d\s-]+$/.test(v) && digits.length >= 6;
};

/** Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export const normalizePhoneE164 = (value: string): string => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
};

const readCooldown = (phone: string): number => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + phone);
    if (!raw) return 0;
    const until = parseInt(raw, 10);
    const left = Math.ceil((until - Date.now()) / 1000);
    return left > 0 ? Math.min(left, COOLDOWN_SECONDS) : 0;
  } catch {
    return 0;
  }
};

export const usePhoneOtpLogin = (rawPhone: string) => {
  const phone = normalizePhoneE164(rawPhone);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<number | null>(null);

  // Re-sync countdown whenever the phone changes (and on mount / refresh)
  useEffect(() => {
    if (!phone) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(readCooldown(phone));
    setOtpSent(readCooldown(phone) > 0);
  }, [phone]);

  // Tick
  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft(() => readCooldown(phone));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [secondsLeft, phone]);

  const sendOtp = useCallback(async (): Promise<boolean> => {
    setError('');
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid mobile number');
      return false;
    }
    if (readCooldown(phone) > 0) return false;

    setSending(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone });
      if (sendError) {
        setError(sendError.message || 'Failed to send OTP');
        return false;
      }
      try {
        localStorage.setItem(
          STORAGE_PREFIX + phone,
          String(Date.now() + COOLDOWN_SECONDS * 1000)
        );
      } catch { /* storage blocked — cooldown stays in-memory */ }
      setSecondsLeft(COOLDOWN_SECONDS);
      setOtpSent(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
      return false;
    } finally {
      setSending(false);
    }
  }, [phone]);

  const verifyOtp = useCallback(async (token: string): Promise<boolean> => {
    setError('');
    const code = (token || '').replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP');
      return false;
    }
    setVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message || 'Invalid or expired OTP');
        return false;
      }
      try { localStorage.removeItem(STORAGE_PREFIX + phone); } catch { /* ignore */ }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      return false;
    } finally {
      setVerifying(false);
    }
  }, [phone]);

  return {
    phone,
    secondsLeft,
    canSend: secondsLeft === 0 && !sending,
    sending,
    verifying,
    otpSent,
    error,
    setError,
    sendOtp,
    verifyOtp,
  };
};

export default usePhoneOtpLogin;
