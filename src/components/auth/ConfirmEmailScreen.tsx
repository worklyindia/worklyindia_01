import { useEffect, useState } from 'react';
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { verifySignupEmailOtp } from '@/lib/signupEmailOtp';

interface ConfirmEmailScreenProps {
  email: string;
  /** Optional destination retained for resend compatibility. */
  redirectUrl?: string;
  onBack: () => void;
}

/**
 * Shown only when Supabase "Confirm email" is turned ON, i.e. sign-up returned
 * a user but no session. If confirmation is OFF the caller never renders this.
 */
const ConfirmEmailScreen = ({ email, redirectUrl, onBack }: ConfirmEmailScreenProps) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verified || verifying || sending) return;
    setVerifying(true);
    setError('');
    try {
      await verifySignupEmailOtp(supabase, email, code);
      // Retain the screen until the audience auth/profile redirect unmounts it.
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (verified || sending || verifying || cooldown > 0) return;
    setSending(true);
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectUrl || `${window.location.origin}/` },
      });
      if (resendError) {
        setError(resendError.message || 'Could not send the email. Please try again.');
      } else {
        setSent(true);
        setCode('');
        setCooldown(60);
      }
    } catch {
      setError('Could not send the email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (verified) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background" role="status" aria-label="Opening your account">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
      <div className="flex min-h-full w-full flex-col items-center px-5 pb-10 pt-4">
        <div className="flex w-full max-w-md items-center">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-10 flex w-full max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary shadow-[0_12px_30px_-8px_hsl(var(--primary)/0.55)]">
            <Mail className="h-11 w-11 text-primary-foreground" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify Your Email</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Enter the 6-digit verification code sent to
          </p>
          <p className="mt-1 text-base font-semibold text-foreground break-all">{email}</p>

          <form onSubmit={verify} className="mt-8 w-full space-y-4">
            <InputOTP
              aria-label="Email verification code"
              maxLength={6}
              value={code}
              onChange={(value) => { setCode(value.replace(/\D/g, '')); setError(''); }}
              disabled={verifying || sending}
              autoFocus
            >
              <InputOTPGroup className="w-full">
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-14 flex-1 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>

            {sent && (
              <p className="flex items-center justify-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> A new verification code has been sent.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-primary to-secondary"
              disabled={code.length !== 6 || verifying || sending}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                'Verify & Continue'
              )}
            </Button>
          </form>

          <div className="mt-4 w-full space-y-3">
            <Button
              type="button"
              variant="ghost"
              onClick={resend}
              disabled={sending || verifying || cooldown > 0}
              className="w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Can&apos;t find the email? Check your Spam or Promotions folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmailScreen;
