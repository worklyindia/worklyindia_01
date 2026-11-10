import { useEffect, useState } from 'react';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { getCanvasFingerprint, generateFingerprint, getRecognitionDeviceProfile } from '@/utils/deviceInfo';

const DEVICE_ID_KEY = 'wfh_device_id';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';

export interface RecognizedAccount {
  email: string;
  full_name: string;
  image_url: string;
}

export function useDeviceRecognition(userType: 'job_seeker' | 'employer') {
  const [recognized, setRecognized] = useState<RecognizedAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deviceId = localStorage.getItem(DEVICE_ID_KEY);
        const fingerprintHash = await generateFingerprint();
        const canvasFingerprint = getCanvasFingerprint();
        const deviceProfile = getRecognitionDeviceProfile();

        if (!deviceId && !fingerprintHash && !canvasFingerprint) {
          if (!cancelled) setLoading(false);
          return;
        }

        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/recognize-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
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
          if (!cancelled && data.recognized && data.email && data.quick_login_enabled !== false) {
            // NOTE: Do NOT write server-returned device_id into localStorage.
            // Doing so cross-contaminates device_id between different users who
            // share the same phone (or same browser fingerprint family), which
            // then triggers false "duplicate account" blocks. device_id MUST
            // remain a locally generated per-install UUID (see deviceInfo.ts).
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
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userType]);

  return { recognized, loading };
}
