import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AccountChangeFrame } from '@/components/auth/AccountChangeFrame';
import { StandardSheetHeader } from '@/components/StandardSheetHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChangeEmailDialogProps {
  children?: React.ReactNode;
  standalone?: boolean;
  currentEmail?: string;
  onEmailChange: (newEmail: string) => Promise<{ error: any }>;
}

export function ChangeEmailDialog({ children, standalone, currentEmail, onEmailChange }: ChangeEmailDialogProps) {
  const navigate = useNavigate();
  const fallback = useLocation().pathname.startsWith('/employer') ? '/employer-settings' : '/settings';
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [needsCurrent, setNeedsCurrent] = useState(Boolean(currentEmail));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cdKey = `email_change_cd:${currentEmail?.toLowerCase() || ''}`;
  const [left, setLeft] = useState(() => { try { return Math.max(0, Math.ceil((Number(sessionStorage.getItem(cdKey)) - Date.now()) / 1000)); } catch { return 0; } });
  useEffect(() => { if (left <= 0) return; const id = window.setTimeout(() => setLeft(s => s - 1), 1000); return () => window.clearTimeout(id); }, [left]);
  const startCd = () => { setLeft(60); try { sessionStorage.setItem(cdKey, String(Date.now() + 60000)); } catch { /* ignore */ } };
  const { toast } = useToast();
  const pendingKey = `pending_email_change:${currentEmail?.toLowerCase() || ''}`;

  const persist = (email: string, current: boolean) => {
    try { sessionStorage.setItem(pendingKey, JSON.stringify({ email, current, sequenceVersion: 2, ts: Date.now() })); } catch { /* storage unavailable */ }
  };
  const clear = () => {
    try { sessionStorage.removeItem(pendingKey); localStorage.removeItem('pending_email_change'); } catch { /* storage unavailable */ }
  };
  useEffect(() => {
    if (!currentEmail) return;
    try {
      const raw = sessionStorage.getItem(pendingKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.email !== 'string' || Date.now() - draft.ts > 15 * 60 * 1000) {
        sessionStorage.removeItem(pendingKey);
        return;
      }
      setNewEmail(draft.email);
      setSent(true);
      setNeedsCurrent(draft.sequenceVersion === 2 ? draft.current === true : true);
      if (!standalone) setOpen(true);
    } catch { /* ignore invalid draft */ }
  }, [currentEmail, pendingKey, standalone]);

  const close = () => {
    if (standalone) navigate(fallback);
    else setOpen(false);
  };
  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!sent && email !== confirmEmail.trim().toLowerCase()) return setError('Email addresses do not match.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.');
    if (email === currentEmail?.toLowerCase()) return setError('Enter a different email address.');
    setError('');
    setBusy(true);
    try {
      const result = await onEmailChange(email);
      if (result.error) throw result.error;
      setNewEmail(email);
      startCd();
      setSent(true);
      setCode('');
      // Resends can renew both challenges; verify the current inbox first.
      const currentFirst = Boolean(currentEmail);
      setNeedsCurrent(currentFirst);
      persist(email, currentFirst);
      toast({ title: 'Verification code requested', description: currentFirst ? 'Check your current email address, including spam or junk.' : 'Check your new email address, including spam or junk.' });
    } catch (e: any) {
      setError(e?.message || 'Could not send the code. Please try again.');
    } finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6 || busy) return;
    setError('');
    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: needsCurrent ? currentEmail || '' : newEmail,
        token: code,
        type: 'email_change',
      });
      if (otpError) throw otpError;
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (data.user?.email?.toLowerCase() !== newEmail.toLowerCase()) {
        const nextIsCurrent = !needsCurrent;
        setNeedsCurrent(nextIsCurrent);
        setCode('');
        persist(newEmail, nextIsCurrent);
        return;
      }
      clear();
      setSent(false);
      setNeedsCurrent(false);
      setCode('');
      setNewEmail('');
      setConfirmEmail('');
      toast({ title: 'Email address updated', description: 'Your new email address is verified.' });
      close();
    } catch (e: any) {
      setError(e?.message || 'The code is wrong or expired. Please try the latest code.');
    } finally { setBusy(false); }
  };

  return <AccountChangeFrame standalone={standalone} title="Change Email Address" fallback={fallback} open={open} onOpenChange={setOpen} trigger={children}>
    {!standalone && <StandardSheetHeader title="Change Email Address" onClose={close} />}
    {!sent ? <form onSubmit={send} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="current-email">Current Email</Label><Input id="current-email" value={currentEmail || ''} disabled /></div>
      <div className="space-y-2"><Label htmlFor="new-email">New Email Address</Label><Input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setError(''); }} required disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-email">Confirm New Email</Label><Input id="confirm-email" type="email" value={confirmEmail} onChange={e => { setConfirmEmail(e.target.value); setError(''); }} required disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full h-12">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}</Button>
    </form> : <form onSubmit={verify} className="space-y-5">
      <p className="text-sm text-muted-foreground">{needsCurrent ? 'Enter the code sent to your current email:' : 'Enter the code sent to your new email:'}</p>
      <p className="font-medium break-all">{needsCurrent ? currentEmail : newEmail}</p>
      <div className="space-y-2"><Label htmlFor="email-change-code">{needsCurrent ? 'Current email code' : 'New email code'}</Label><Input id="email-change-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit code" value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} className="h-12 text-center text-lg" disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      <Button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Code'}</Button>
      <Button type="button" variant="outline" onClick={() => send()} disabled={busy || left > 0} className="w-full">{left > 0 ? `Resend in ${left}s` : <><RefreshCw className="mr-2 h-4 w-4" />Resend Code</>}</Button>
      {currentEmail && <Button type="button" variant="ghost" disabled={busy} onClick={() => { const current = !needsCurrent; setNeedsCurrent(current); persist(newEmail, current); setCode(''); setError(''); }} className="w-full">{needsCurrent ? 'Use new email code' : 'Use current email code'}</Button>}
      <Button type="button" variant="ghost" disabled={busy} onClick={() => { clear(); setSent(false); setNeedsCurrent(false); setCode(''); setError(''); }} className="w-full">Change Email</Button>
    </form>}
  </AccountChangeFrame>;
}
