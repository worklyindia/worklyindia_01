import { useEffect, useRef, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { SignupOtpPage } from '@/hooks/useSignupEmailOtpSetting';

interface Props {
  email: string;
  name: string;
  page: SignupOtpPage;
  onVerified: () => void;
}

/** Sends a code to the signup email and verifies it. Auto-sends once when shown. */
export const EmailOtpVerifyBox = ({ email, name, page, onVerified }: Props) => {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState('');
  const autoSent = useRef(false);
  const lastVerifiedCode = useRef('');

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const send = async () => {
    setError('');
    setSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('email-api/signup-email-otp', {
        body: { action: 'send', page, email, name },
      });
      if (fnErr || !data?.success) {
        let msg = data?.error;
        try { msg = msg || (await (fnErr as any)?.context?.json())?.error; } catch { /* ignore */ }
        setError(msg || 'Could not send the code');
        return;
      }
      setSent(true);
      setLeft(data.cooldown || 60);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value = code) => {
    const normalizedCode = value.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6 || verifying || lastVerifiedCode.current === normalizedCode) return;
    lastVerifiedCode.current = normalizedCode;
    setError('');
    setVerifying(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('email-api/signup-email-otp', {
        body: { action: 'verify', page, email, code: normalizedCode },
      });
      if (data?.verified) { onVerified(); return; }
      let msg = data?.error;
      try { msg = msg || (await (fnErr as any)?.context?.json())?.error; } catch { /* ignore */ }
      lastVerifiedCode.current = '';
      setError(msg || 'Wrong code');
    } catch (error) {
      lastVerifiedCode.current = '';
      setError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" /> Code sent to <span className="font-medium text-foreground break-all">{email}</span>
      </p>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(next);
          if (next.length === 6) void verify(next);
        }}
        className="h-12 text-center text-lg tracking-[0.4em] placeholder:text-sm placeholder:tracking-normal"
      />
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <Button type="button" className="h-12 w-full" disabled={code.length !== 6 || verifying} onClick={verify}>
        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Create Account'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={sending || left > 0} onClick={send}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : left > 0 ? `Resend in ${left}s` : sent ? 'Resend code' : 'Send code'}
      </Button>
    </div>
  );
};

export default EmailOtpVerifyBox;
