import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { completeOutlookConnect } from '@/hooks/useUserOutlook';

/** Landing page for the per-user Outlook OAuth popup. */
export default function OutlookReturn() {
  const [message, setMessage] = useState('Finishing Outlook connection…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Developer customer connect (hosted /connect/<channel> page): hand the result back there.
    try {
      const sub = JSON.parse(sessionStorage.getItem('wsub_connect') || 'null');
      if (sub?.slug && ['outlook'].includes(sub.slug)) {
        window.location.replace(`/connect/${sub.slug}${window.location.search}`);
        return;
      }
    } catch { /* ignore */ }
    const notify = (type: 'outlookConnectComplete' | 'outlookConnectFailed', reason?: string) => {
      // Mobile browsers often drop window.opener; also signal via storage so the original tab learns the result.
      try { localStorage.setItem('outlookConnectResult', JSON.stringify({ type, reason, t: Date.now() })); } catch { /* ignore */ }
      if (window.opener) {
        window.opener.postMessage({ type, reason }, window.location.origin);
        if (type === 'outlookConnectComplete') window.close();
        return;
      }
      if (type === 'outlookConnectComplete') window.location.replace('/ai-assistant/connect/outlook/settings');
    };

    const err = params.get('error_description') || params.get('error');
    if (err) {
      setMessage(err);
      notify('outlookConnectFailed', err);
      return;
    }

    const code = params.get('code');
    if (!code) {
      const reason = 'Microsoft sign-in finished without a connection code.';
      setMessage(reason);
      notify('outlookConnectFailed', reason);
      return;
    }

    completeOutlookConnect(code, params.get('state'))
      .then(() => {
        setMessage('Outlook connected! You can close this window.');
        notify('outlookConnectComplete');
      })
      .catch((e: any) => {
        const reason = e?.message || 'Could not finish the Outlook connection.';
        setMessage(reason);
        notify('outlookConnectFailed', reason);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}
