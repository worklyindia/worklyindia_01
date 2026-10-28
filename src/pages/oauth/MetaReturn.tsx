import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { META_STATE_KEY, metaRedirectUri, metaSocialAction } from '@/components/social/MetaSocialAIConnectCard';

/** Facebook login returns here; we finish the Facebook Page / Instagram connection. */
export default function MetaReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');
  const [label, setLabel] = useState('Facebook');
  const [backTo, setBackTo] = useState('/ai-assistant/connect');
  const [support, setSupport] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Developer customer connect (hosted /connect/<channel> page): hand the result back there.
    try {
      const sub = JSON.parse(sessionStorage.getItem('wsub_connect') || 'null');
      if (sub?.slug && ['instagram', 'facebook'].includes(sub.slug)) {
        window.location.replace(`/connect/${sub.slug}${window.location.search}`);
        return;
      }
    } catch { /* ignore */ }
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(META_STATE_KEY) || '{}'); } catch { return {}; } })();
    sessionStorage.removeItem(META_STATE_KEY);
    const platform = saved.platform === 'instagram' ? 'instagram' : 'facebook';
    const returnTo = typeof saved.returnTo === 'string' && /^\/(ai-assistant\/connect|employer|owner-portal)\//.test(saved.returnTo) && !saved.returnTo.startsWith('//')
      ? saved.returnTo
      : `/ai-assistant/connect/${platform}/settings`;
    setLabel(platform === 'instagram' ? 'Instagram' : 'Facebook Page');
    setBackTo(returnTo);
    setSupport(saved.audience === 'support');
    const code = params.get('code');
    const err = params.get('error_description') || params.get('error');
    if (err || !code) { setStatus('error'); setMessage(err || 'Login was cancelled.'); return; }
    if (!saved.state || saved.state !== params.get('state')) { setStatus('error'); setMessage('Session expired. Please try again.'); return; }
    metaSocialAction({ action: 'callback', ...(saved.audience === 'support' ? { audience: 'support' } : {}), ...(platform === 'instagram' && saved.instagramLogin === true ? { instagram_login: true } : {}), platform, code, redirect_uri: metaRedirectUri() })
      .then((res) => {
        setStatus('done');
        // Open the account that was just added; the user's other accounts stay connected.
        const [path, query = ''] = returnTo.split('?');
        const q = new URLSearchParams(query);
        if (res?.account_id) q.set('account', String(res.account_id));
        const target = q.toString() ? `${path}?${q}` : path;
        setTimeout(() => navigate(target, { replace: true }), 1500);
      })
      .catch((e) => { setStatus('error'); setMessage((e as Error).message); });
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === 'working' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <h1 className="text-base font-semibold">Connecting {label}…</h1>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />
            <h1 className="text-base font-semibold">{label} connected</h1>
            <p className="text-sm text-muted-foreground">Taking you back to {support ? 'Customer Service' : 'AI Connect'}…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <h1 className="text-base font-semibold">Could not connect {label}</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <Button onClick={() => navigate(backTo, { replace: true })} className="w-full">
              Back to {support ? 'Customer Service' : 'AI Connect'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
