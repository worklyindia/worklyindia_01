import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Loader2, RefreshCw, Send, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import useWebOTP from '@/hooks/useWebOTP';
import { normalizePhoneE164 } from '@/hooks/usePhoneOtpLogin';
import { saveSignupPhoneProof } from '@/lib/signupPhoneProof';
import { verifyAccountPhoneOtp } from '@/lib/onboardingPhone';
import { isValidE164 } from '@/lib/phone';

const COOLDOWN_SECONDS = 60;
const STORAGE_PREFIX = 'phone_verify_cooldown:';
const STATE_PREFIX = 'phone_verify_state:';

const SLOT_CLASS = cn(
  'flex-1 min-w-0 h-12 md:h-14 text-base sm:text-lg md:text-xl font-bold rounded-lg border-2 transition-all duration-200',
  'bg-background hover:border-primary/50',
  'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
);

/** Convert Supabase/Twilio provider errors into short user-friendly text. */
const friendlySendError = (err: any): string => {
  if (!err) return 'Failed to send OTP';
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_rate_limit')) {
    return 'Too many attempts. Please try again later.';
  }
  if (msg.includes('not authorized') || msg.includes('forbidden') || msg.includes('not allowed')) {
    return 'Phone verification not allowed. Contact support.';
  }
  if (msg.includes('provider') || msg.includes('twilio') || msg.includes('messagebird') || msg.includes('vonage')) {
    return 'OTP service is busy. Please try again later.';
  }
  if (msg.includes('phone_change') || msg.includes('unable to send') || msg.includes('invalid phone')) {
    return 'Unable to send OTP to this number. Check the number and try again.';
  }
  return err.message || 'Failed to send OTP';
};

const readCooldown = (phone: string): number => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + phone);
    if (!raw) return 0;
    const left = Math.ceil((parseInt(raw, 10) - Date.now()) / 1000);
    return left > 0 ? Math.min(left, COOLDOWN_SECONDS) : 0;
  } catch {
    return 0;
  }
};

const readVerificationState = (mode: 'signup' | 'profile', phone: string): { otpSent?: boolean } => {
  try {
    const raw = localStorage.getItem(`${STATE_PREFIX}${mode}:${phone}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeVerificationState = (mode: 'signup' | 'profile', phone: string, otpSent: boolean) => {
  try {
    if (otpSent) {
      localStorage.setItem(`${STATE_PREFIX}${mode}:${phone}`, JSON.stringify({ otpSent: true }));
    } else {
      localStorage.removeItem(`${STATE_PREFIX}${mode}:${phone}`);
    }
  } catch { /* storage blocked */ }
};

interface PhoneVerifyBoxProps {
  /** Raw phone typed by the user (any format) */
  phone: string;
  /** signup = no session yet, profile = signed-in phone change */
  mode?: 'signup' | 'profile';
  verified: boolean;
  onVerified: (phoneE164: string) => void;
  className?: string;
  /** Send the code automatically as soon as the number looks valid */
  autoSend?: boolean;
  /** Optional guard run right before sending the code. Return an error string to block the send. */
  onBeforeSend?: (phoneE164: string) => Promise<string | null>;
}

/**
 * SMS OTP verification box (Supabase phone auth).
 * Shown only when the owner has switched `phone_verify_enabled` ON.
 * Visual layout matches the WhatsApp OTP box.
 */
export const PhoneVerifyBox = ({
  phone,
  mode = 'signup',
  verified,
  onVerified,
  className = '',
  autoSend = true,
  onBeforeSend,
}: PhoneVerifyBoxProps) => {
  const e164 = normalizePhoneE164(phone);
  const isPhoneValid = isValidE164(e164);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() => readCooldown(e164));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Manual-send pages always start with the Send OTP button; boxes appear only after a successful send.
  // A code that was actually sent (still within its cooldown) survives a remount.
  const [otpSent, setOtpSent] = useState(() => readVerificationState(mode, e164).otpSent === true && (autoSend || readCooldown(e164) > 0));
  const [error, setError] = useState('');
  const hasSentRef = useRef(false);
  const lastPhoneRef = useRef(e164);

  useEffect(() => {
    if (e164 === lastPhoneRef.current) return;
    lastPhoneRef.current = e164;
    hasSentRef.current = false;
    setOtp('');
    setError('');
    const left = readCooldown(e164);
    setSecondsLeft(left);
    setOtpSent(autoSend && (left > 0 || readVerificationState(mode, e164).otpSent === true));
  }, [e164]);

  useEffect(() => {
    writeVerificationState(mode, e164, otpSent);
  }, [e164, mode, otpSent]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft(readCooldown(e164)), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft, e164]);

  const sendOtp = useCallback(async () => {
    setError('');
    if (!isPhoneValid) {
      setError('Enter a valid mobile number');
      return;
    }
    if (readCooldown(e164) > 0) return;
    setSending(true);
    try {
      if (onBeforeSend) {
        const blockReason = await onBeforeSend(e164);
        if (blockReason) {
          setError(blockReason);
          return;
        }
      }
      const { error: sendError } =
        mode === 'profile'
          ? await supabase.auth.updateUser({ phone: e164 })
          : await supabase.auth.signInWithOtp({ phone: e164 });
      if (sendError) {
        setError(friendlySendError(sendError));
        return;
      }
      try {
        localStorage.setItem(STORAGE_PREFIX + e164, String(Date.now() + COOLDOWN_SECONDS * 1000));
      } catch { /* storage blocked */ }
      setSecondsLeft(COOLDOWN_SECONDS);
      setOtpSent(true);
    } catch (err) {
      setError(friendlySendError(err));
    } finally {
      setSending(false);
    }
  }, [e164, mode, isPhoneValid, onBeforeSend]);

  // Auto-send once the number looks valid (same behaviour as the WhatsApp box)
  useEffect(() => {
    if (!autoSend || verified || !isPhoneValid || hasSentRef.current || otpSent || sending) return;
    hasSentRef.current = true;
    void sendOtp();
  }, [autoSend, verified, isPhoneValid, otpSent, sending, sendOtp]);

  // Chrome Android SMS auto-fill
  useWebOTP((code) => setOtp(code), otpSent && !verified);

  const verify = useCallback(async (code: string) => {
    setVerifying(true);
    setError('');
    try {
      if (mode === 'profile') {
        await verifyAccountPhoneOtp(supabase, e164, code);
      } else {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          phone: e164, token: code, type: 'sms',
        });
        if (verifyError) throw verifyError;
        saveSignupPhoneProof(verifyData?.user?.id, e164);
      }
      try { localStorage.removeItem(STORAGE_PREFIX + e164); } catch { /* ignore */ }
      writeVerificationState(mode, e164, false);
      // Report success immediately. Waiting for signOut first fires auth-state
      // listeners which can remount the page and make verification appear to
      // work only after a refresh.
      onVerified(e164);
      // Signup verification creates a temporary phone session. Remove it only
      // after React has received the verified state and the draft is persisted.
      if (mode === 'signup') {
        window.setTimeout(() => {
          void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        }, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP');
      setOtp('');
    } finally {
      setVerifying(false);
    }
  }, [e164, mode, onVerified]);

  useEffect(() => {
    if (otp.length === 6 && !verifying) void verify(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (verified) {
    return (
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
        className
      )}>
        <BadgeCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">Mobile number verified</span>
      </div>
    );
  }

  if (!isPhoneValid) return null;

  const showManualSendButton = !otpSent && !sending;

  // Before the code is sent: only a right-aligned blue Send OTP button
  if (!otpSent) {
    return (
      <div className={cn('space-y-2 pt-2', className)}>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!showManualSendButton}
            onClick={() => { hasSentRef.current = true; void sendOtp(); }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-destructive text-right">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn(
      'space-y-4 pt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
      className
    )}>
      <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your number</p>


      {/* OTP Input - 3-3 grouped */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Enter OTP</Label>
        <div className="flex w-full">
          <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifying} className="gap-2" containerClassName="w-full">
            <InputOTPGroup className="flex-1 gap-2">
              {[0, 1, 2].map((i) => (
                <InputOTPSlot key={i} index={i} className={cn(SLOT_CLASS, otp[i] && 'border-primary/60 bg-primary/5')} />
              ))}
            </InputOTPGroup>
            <div className="flex items-center px-0.5 sm:px-1 md:px-2">
              <div className="w-2 sm:w-3 md:w-4 h-0.5 bg-muted-foreground/40 rounded-full" />
            </div>
            <InputOTPGroup className="flex-1 gap-2">
              {[3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className={cn(SLOT_CLASS, otp[i] && 'border-primary/60 bg-primary/5')} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {verifying && (
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setOtp(''); void sendOtp(); }}
          disabled={secondsLeft > 0 || sending}
          className="gap-1.5 text-xs font-medium hover:bg-primary/10 hover:text-primary"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', sending && 'animate-spin')} />
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend OTP'}
        </Button>
        <span className="text-xs text-muted-foreground">Expires in a few minutes</span>
      </div>
    </div>
  );
};

export default PhoneVerifyBox;
