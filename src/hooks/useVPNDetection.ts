import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VPNDetectionState {
  vpnDetected: boolean;
  isChecking: boolean;
  error: string | null;
  detectionType: 'vpn' | 'proxy' | 'tor' | null;
}

export const useVPNDetection = (isAuthenticated: boolean) => {
  const [state, setState] = useState<VPNDetectionState>({
    vpnDetected: false,
    isChecking: true,
    error: null,
    detectionType: null,
  });
  const lastCheckRef = useRef<number>(0);
  const VPN_CHECK_CACHE_MS = 6 * 60 * 60 * 1000;

  const checkVPN = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      setState({ vpnDetected: false, isChecking: false, error: null, detectionType: null });
      return;
    }

    // Cache aggressively on the free plan to avoid background edge-function usage.
    const now = Date.now();
    if (!force && now - lastCheckRef.current < VPN_CHECK_CACHE_MS) {
      return;
    }

    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setState({ vpnDetected: false, isChecking: false, error: null, detectionType: null });
        return;
      }

      const res = await supabase.functions.invoke('get-ip-info', {
        method: 'GET',
      });

      if (res.error) {
        console.error('VPN check error:', res.error);
        setState({ vpnDetected: false, isChecking: false, error: 'Check failed', detectionType: null });
        return;
      }

      const data = res.data;
      const isVPN = data?.vpn_detected === true;
      const isTor = data?.is_tor === true;
      const isProxy = data?.proxy_type === 'Proxy';

      const detected = isVPN || isTor || isProxy;
      const detectionType = isTor ? 'tor' : isProxy ? 'proxy' : isVPN ? 'vpn' : null;

      lastCheckRef.current = Date.now();
      setState({ vpnDetected: detected, isChecking: false, error: null, detectionType });
    } catch (err) {
      console.error('VPN detection error:', err);
      setState({ vpnDetected: false, isChecking: false, error: 'Network error', detectionType: null });
    }
  }, [isAuthenticated]);

  // Initial check only. Manual recheck is available through the returned API.
  useEffect(() => {
    if (isAuthenticated) {
      checkVPN(false);
    }
  }, [isAuthenticated, checkVPN]);

  return {
    vpnDetected: state.vpnDetected,
    isChecking: state.isChecking,
    error: state.error,
    detectionType: state.detectionType,
    recheck: () => checkVPN(true),
  };
};
