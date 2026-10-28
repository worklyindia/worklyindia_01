import { useState, useEffect } from 'react';
import { ChevronDown, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SafeAvatarImage } from '@/components/ui/safe-image';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { getCanvasFingerprint, generateFingerprint, getRecognitionDeviceProfile } from '@/utils/deviceInfo';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';
import { normalizeImageUrl } from '@/utils/imageUrl';

interface DeviceRecognitionBannerProps {
  userType: 'job_seeker' | 'employer';
  onEmailRecognized: (email: string) => void;
}

const DISMISS_KEY = 'device_recognition_dismissed';
const DEVICE_ID_KEY = 'wfh_device_id';

const DeviceRecognitionBanner = ({ userType, onEmailRecognized }: DeviceRecognitionBannerProps) => {
  const navigate = useNavigate();
  const { data: appSettings } = useAppSettings();
  const [recognized, setRecognized] = useState<{ email: string; full_name: string; image_url: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [deviceData, setDeviceData] = useState<{ deviceId: string | null; fingerprintHash: string | null; canvasFingerprint: string | null }>({
    deviceId: null, fingerprintHash: null, canvasFingerprint: null
  });

  useEffect(() => {
    // No session check — always show on refresh

    const recognize = async () => {
      try {
        const deviceId = localStorage.getItem(DEVICE_ID_KEY);
        const fingerprintHash = await generateFingerprint();
        const canvasFingerprint = getCanvasFingerprint();
        const deviceProfile = getRecognitionDeviceProfile();

        setDeviceData({ deviceId, fingerprintHash, canvasFingerprint });

        if (!deviceId && !fingerprintHash && !canvasFingerprint) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/recognize-device`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
          },
          body: JSON.stringify({
            device_id: deviceId,
            fingerprint_hash: fingerprintHash,
            canvas_fingerprint: canvasFingerprint,
            device_profile: deviceProfile,
            user_type: userType,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.recognized && data.email && data.quick_login_enabled !== false) {
            // Do NOT persist server-returned device_id into localStorage:
            // it overwrites this install's UUID with another user's device_id
            // and causes false duplicate-account matches across users who
            // share the same phone or browser fingerprint family.
            setRecognized({
              email: data.email,
              full_name: data.full_name || '',
              image_url: data.image_url || '',
            });
          }
        }
      } catch (err) {
        console.error('Device recognition error:', err);
      } finally {
        setLoading(false);
      }
    };

    recognize();
  }, [userType]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleQuickLogin = async () => {
    if (!recognized?.email) return;
    setLoggingIn(true);

    try {
      // Call edge function with quick-login action
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/recognize-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
        },
        body: JSON.stringify({
          device_id: deviceData.deviceId,
          fingerprint_hash: deviceData.fingerprintHash,
          canvas_fingerprint: deviceData.canvasFingerprint,
          device_profile: getRecognitionDeviceProfile(),
          user_type: userType,
          action: 'quick-login',
        }),
      });

      if (!res.ok) throw new Error('Quick login request failed');

      const data = await res.json();

      if (data.token_hash) {
        // Do NOT persist server-returned device_id (see comment above) — it
        // would cross-contaminate device IDs between users on the same phone.
        // Verify OTP with the token hash to sign in
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (error) {
          console.error('OTP verification error:', error);
          // Fallback: fill email
          onEmailRecognized(recognized.email);
          handleDismiss();
        }
        // On success, the auth state listener in Auth/EmployerAuth will handle redirect
      } else {
        // Fallback: fill email
        onEmailRecognized(recognized.email);
        handleDismiss();
      }
    } catch (err) {
      console.error('Quick login error:', err);
      onEmailRecognized(recognized.email);
      handleDismiss();
    } finally {
      setLoggingIn(false);
    }
  };

  // Check if Quick Login is enabled for this user type
  const quickLoginKey = userType === 'employer' ? 'quick_login_employer' : 'quick_login_job_seeker';
  const isQuickLoginEnabled = appSettings?.[quickLoginKey] !== 'false';

  if (loading || dismissed || !recognized || !isQuickLoginEnabled) return null;

  const initials = recognized.full_name
    ? recognized.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : recognized.email[0].toUpperCase();

  const isEmployer = userType === 'employer';

  return (
    <Sheet open={!dismissed && !!recognized} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 overflow-hidden border-0 shadow-2xl [&>button]:hidden"
      >
        {/* Header gradient */}
        <div className={`h-24 relative bg-gradient-to-r from-primary to-secondary`}>
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1.5 bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <ChevronDown className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Avatar - overlapping header */}
        <div className="flex flex-col items-center -mt-12 px-6 pb-6">
          <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
            {recognized.image_url ? (
              <SafeAvatarImage
                src={normalizeImageUrl(recognized.image_url)}
                alt={recognized.full_name || 'Profile'}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <h2 className="mt-4 text-lg font-bold text-foreground">Welcome back!</h2>
          {recognized.full_name && (
            <p className="text-base font-semibold text-foreground mt-1">{recognized.full_name}</p>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">{recognized.email}</p>

          <Button
            size="lg"
            onClick={handleQuickLogin}
            disabled={loggingIn}
            className="mt-6 w-full rounded-xl text-base font-semibold shadow-md bg-gradient-to-r from-primary to-secondary text-primary-foreground"
          >
            {loggingIn ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5 mr-2" />
                Quick Login
              </>
            )}
          </Button>

          <button
            onClick={handleDismiss}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Not you? Use a different account
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DeviceRecognitionBanner;
