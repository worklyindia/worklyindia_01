import { useState } from 'react';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { getCanvasFingerprint, generateFingerprint, getRecognitionDeviceProfile } from '@/utils/deviceInfo';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_ID_KEY = 'wfh_device_id';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';

export type QuickLoginResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'not_found' | 'error'; message: string };

export function useQuickLogin(userType: 'job_seeker' | 'employer') {
  const [loading, setLoading] = useState(false);

  const quickLogin = async (): Promise<QuickLoginResult> => {
    setLoading(true);
    try {
      const device_id = localStorage.getItem(DEVICE_ID_KEY);
      const fingerprint_hash = await generateFingerprint();
      const canvas_fingerprint = getCanvasFingerprint();
      const device_profile = getRecognitionDeviceProfile();

      if (!device_id && !fingerprint_hash && !canvas_fingerprint) {
        return { ok: false, reason: 'not_found', message: 'No Account Found on this device' };
      }

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/recognize-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          device_id,
          fingerprint_hash,
          canvas_fingerprint,
          device_profile,
          user_type: userType,
          action: 'quick-login',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.recognized || !data.token_hash) {
        return { ok: false, reason: 'not_found', message: 'No Account Found on this device' };
      }

      // NOTE: Do NOT write server-returned device_id into localStorage — it
      // would overwrite this install's UUID with another user's device_id and
      // cause false duplicate-account matches. device_id must stay locally
      // generated (see deviceInfo.ts).

      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (error) {
        return { ok: false, reason: 'error', message: error.message || 'Login failed' };
      }

      return { ok: true, email: data.email };
    } catch (err: any) {
      return { ok: false, reason: 'error', message: err?.message || 'Quick login failed' };
    } finally {
      setLoading(false);
    }
  };

  return { quickLogin, loading };
}
