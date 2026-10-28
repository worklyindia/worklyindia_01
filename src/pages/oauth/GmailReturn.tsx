import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { completeGmailConnect } from '@/hooks/useUserGmail';

/** Landing page for the per-user Gmail OAuth popup. */
export default function GmailReturn() {
  const [message, setMessage] = useState('Finishing Gmail connection…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: 'gmailConnectComplete' | 'gmailConnectFailed', reason?: string) => {
      // Mobile browsers often drop window.opener; also signal via storage so the original tab learns the result.
      try { localStorage.setItem('gmailConnectResult', JSON.stringify({ type, reason, t: Date.now() })); } catch { /* ignore */ }
      if (window.opener) {
        window.opener.postMessage({ type, reason }, window.location.origin);
        if (type === 'gmailConnectComplete') window.close();
        return;
      }
      if (type === 'gmailConnectComplete') {
        window.location.replace('/ai-assistant/connect/gmail/settings');
      }
    };

    const err = params.get('error') || params.get('error_description');
    if (err) {
      setMessage(err);
      notify('gmailConnectFailed', err);
      return;
    }

    const code = params.get('code');
    if (!code) {
      const reason = 'Google sign-in finished without a connection code.';
      setMessage(reason);
      notify('gmailConnectFailed', reason);
      return;
    }

    completeGmailConnect(code, params.get('state'))
      .then(() => {
        setMessage('Gmail connected! You can close this window.');
        notify('gmailConnectComplete');
      })
      .catch((e: any) => {
        const reason = e?.message || 'Could not finish the Gmail connection.';
        setMessage(reason);
        notify('gmailConnectFailed', reason);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}
