import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVPNDetection } from '@/hooks/useVPNDetection';
import { useAccountBlockCheck } from '@/hooks/useAccountBlockCheck';
import { VPNBlockScreen } from '@/components/VPNBlockScreen';
import { BlockedAccountScreen } from '@/components/BlockedAccountScreen';
import { autoCollectDeviceInfo } from '@/utils/autoDeviceInfoCollector';
import { supabase } from '@/integrations/supabase/client';

interface VPNGuardProps {
  children: React.ReactNode;
}

/**
 * Auth and password-recovery screens stay visible while the background
 * account-block check runs. The recovery flow keeps its current step
 * (code sent -> new password) in this page's state, so swapping the page for
 * a spinner would drop the user back on the email form right after they
 * verify the code. A blocked account still gets the block screen.
 */
const AUTH_FLOW_PATHS = [
  '/auth',
  '/signup',
  '/forgot-password',
  '/employer-auth',
  '/employer-signup',
  '/employer-forgot-password',
  '/reset-password',
  '/verify-email-change',
  '/profile-setup',
];

const isAuthFlowPath = (pathname: string) => {
  const path = (pathname.replace(/\/+$/, '') || '/').toLowerCase();
  return AUTH_FLOW_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
};


export const VPNGuard = ({ children }: VPNGuardProps) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const location = useLocation();
  const { vpnDetected, isChecking: vpnChecking, recheck, detectionType } = useVPNDetection(isAuthenticated);
  const { isBlocked, isChecking: blockChecking, reason, originalAccountHint, matchedSignals, confidenceScore, initialCheckDone, forceRecheck } = useAccountBlockCheck(isAuthenticated);

  const isAuthPage = location.pathname === '/auth' || location.pathname.startsWith('/auth');

  // NOTE: Real-time duplicate/device check on profile edit pages has been removed.
  // Block screen will only appear from the normal background account-block check,
  // not as a forced recheck when opening Job Seeker / Employer profile edit pages.

  // VPN blocking disabled for now - can be re-enabled later
  // if (vpnDetected && (isAuthenticated || isAuthPage)) {
  //   return <VPNBlockScreen onCheckAgain={recheck} isChecking={vpnChecking} detectionType={detectionType} />;
  // }

  // Don't check account block if not authenticated
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Wait only for the FIRST block check — don't show spinner on background
  // retries, and never on auth/recovery pages (see AUTH_FLOW_PATHS above).
  if (!initialCheckDone && blockChecking && !isAuthFlowPath(location.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Show blocked account screen (higher priority after VPN)
  if (isBlocked) {
    return (
      <BlockedAccountScreen
        reason={reason || 'Your account has been blocked due to duplicate account detection.'}
        originalAccountHint={originalAccountHint}
        matchedSignals={matchedSignals || undefined}
        confidenceScore={confidenceScore || undefined}
      />
    );
  }

  return <>{children}</>;
};
