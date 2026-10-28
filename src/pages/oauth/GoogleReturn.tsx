import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRODUCT_LABELS: Record<string, string> = {
  adsense: 'Google AdSense',
  search_console: 'Google Search Console',
  analytics: 'Google Analytics',
  drive: 'Google Drive',
};

/** Landing page after Google redirects back through the secure Edge Function callback. */
export default function GoogleReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const success = params.get('success') === 'true';
  const product = params.get('product') ?? '';
  const error = params.get('error');
  const [countdown, setCountdown] = useState(2);
  const label = PRODUCT_LABELS[product] ?? 'Google';

  useEffect(() => {
    if (!success) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    const to = setTimeout(() => navigate(params.get('product') === 'business_profile' ? '/ai-assistant/connect/google_business/settings' : '/ai-assistant/connect', { replace: true }), 2000);
    return () => {
      clearInterval(t);
      clearTimeout(to);
    };
  }, [success, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        {success ? (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
            <h1 className="text-base font-semibold">{label} connected</h1>
            <p className="text-sm text-muted-foreground">
              Taking you back to AI Connect{countdown > 0 ? '…' : ''}
            </p>
            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
          </>
        ) : (
          <>
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <h1 className="text-base font-semibold">Could not connect {label}</h1>
            <p className="text-sm text-muted-foreground">
              {error || 'The authorization did not complete. Please try again.'}
            </p>
            <Button onClick={() => navigate(params.get('product') === 'business_profile' ? '/ai-assistant/connect/google_business/settings' : '/ai-assistant/connect', { replace: true })} className="w-full">
              Back to AI Connect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
