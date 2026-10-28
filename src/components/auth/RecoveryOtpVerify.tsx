import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, RefreshCw, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  email: string;
  /** Where "Go to Log In" takes the user once the new password is saved. */
  loginPath: string;
  resending?: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
  onCompleted?: () => void;
}

/** Forgot password: enter the 6-digit code from the email, then set a new password. */
export const RecoveryOtpVerify = ({ email, loginPath, resending, onResend, onChangeEmail, onCompleted }: Props) => {
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const cdKey = `recovery_cd:${email.toLowerCase()}`;
  const [left, setLeft] = useState(() => {
    try {
      const end = Number(sessionStorage.getItem(cdKey));
      if (end > Date.now()) return Math.ceil((end - Date.now()) / 1000);
      sessionStorage.setItem(cdKey, String(Date.now() + 60000));
    } catch { /* ignore */ }
    return 60;
  });
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  const resend = () => {
    setLeft(60);
    try { sessionStorage.setItem(cdKey, String(Date.now() + 60000)); } catch { /* ignore */ }
    onResend();
  };

  const verify = async () => {
    setError('');
    setBusy(true);
    const { error: e } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    setBusy(false);
    if (e) setError('Wrong or expired code. Please try again or resend.');
    else setVerified(true);
  };

  const save = async () => {
    setError('');
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (e) {
      setError(e.message || 'Could not update password.');
      return;
    }
    // The reset session is only good for finishing this reset. End it so the
    // user signs in with the password they just chose.
    await supabase.auth.signOut();
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-auth-link" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your password has been updated. You can now log in with your new password.
        </p>
        <Button asChild className="h-12 w-full">
          <Link to={loginPath} onClick={onCompleted}>Go to Log In</Link>
        </Button>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="space-y-3">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4" /> Set your new password
        </p>
        <PasswordInput aria-label="New password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" />
        <PasswordInput aria-label="Confirm new password" autoComplete="new-password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-12" />
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
        <Button className="h-12 w-full" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center justify-center gap-1 text-center text-sm text-muted-foreground">
        <Mail className="h-4 w-4" /> If this email is registered, a 6-digit code was sent to
        <span className="font-medium text-foreground break-all">{email}</span>
      </p>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="h-12 text-center text-lg tracking-[0.4em] placeholder:text-sm placeholder:tracking-normal"
      />
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <Button className="h-12 w-full" disabled={code.length !== 6 || busy} onClick={verify}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Code'}
      </Button>
      <Button variant="outline" className="w-full" disabled={resending || left > 0} onClick={resend}>
        {left > 0 ? `Resend in ${left}s` : <><RefreshCw className="mr-2 h-4 w-4" /> {resending ? 'Sending...' : 'Resend Code'}</>}
      </Button>
      <Button variant="ghost" className="w-full text-sm" onClick={onChangeEmail}>
        ← Change Email
      </Button>
    </div>
  );
};

export default RecoveryOtpVerify;
