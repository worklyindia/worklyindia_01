import { useEffect, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmailChat from '@/pages/owner-portal/EmailChat';
import { listSupportMail, setSupportMailScope } from '@/hooks/useSupportMailChat';
import { useUserGmail } from '@/hooks/useUserGmail';
import { useUserOutlook } from '@/hooks/useUserOutlook';
import { useUserCustomEmail } from '@/hooks/useUserCustomEmail';

/** Employer email: same chat as the owner, backed by the employer's own AI Connect mailboxes. */
export default function EmployerEmailChat() {
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'connected' | 'empty'>('loading');
  // AI Connect status is the source of truth for whether any mailbox is connected.
  const gmail = useUserGmail();
  const outlook = useUserOutlook();
  const domain = useUserCustomEmail();
  const anyConnected = gmail.status.connected || outlook.status.connected || domain.status.connected;
  const statusLoading = gmail.loading || outlook.loading || domain.loading;

  useEffect(() => {
    let alive = true;
    setSupportMailScope('personal');
    listSupportMail(0, 1)
      .then(d => alive && setState(d.mailboxes.some(m => m.connected) ? 'connected' : 'empty'))
      .catch(() => alive && setState('empty'));
    return () => { alive = false; };
  }, []);

  if (state !== 'loading' || anyConnected || !statusLoading) return <EmailChat scope="personal" />;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Workly Email</title></Helmet>
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => (window.parent !== window ? window.parent.postMessage({ type: 'workly-chat:close' }, '*') : goBack(navigate, '/employer-portal'))}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-semibold">Workly Email</h1>
      </header>
      {state === 'loading' || statusLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4"><Mail className="h-8 w-8 text-primary" /></div>
          <h2 className="text-lg font-semibold">Connect your email</h2>
          <p className="text-sm text-muted-foreground">Connect Gmail, Outlook or your domain email on the AI Connect page to read and reply to emails here.</p>
          <Button className="w-full" onClick={() => navigate('/ai-assistant/connect')}>Connect email</Button>
        </div>
      )}
    </div>
  );
}
