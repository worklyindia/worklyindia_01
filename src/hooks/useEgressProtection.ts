import { useState } from 'react';

interface EgressState {
  isLowBandwidthMode: boolean;
  isCriticalMode: boolean;
  egressPercentage: number | null;
  lastChecked: Date | null;
  shouldDisableRealtime: boolean;
  shouldDisablePolling: boolean;
}

// Always enable low-bandwidth mode on free plan to protect IO/egress budget
let cachedEgressState: EgressState = {
  isLowBandwidthMode: true, // Default ON for free plan
  isCriticalMode: true,
  egressPercentage: 100,
  lastChecked: null,
  shouldDisableRealtime: true,
  shouldDisablePolling: true,
};

/**
 * OPTIMIZED: No longer calls edge function to check egress
 * Always runs in low-bandwidth mode on free plan to protect Disk IO
 * Saves 1 edge function invocation every 5 minutes
 */
export const useEgressProtection = () => {
  const [state] = useState<EgressState>(cachedEgressState);

  return {
    ...state,
    checkEgressUsage: async () => cachedEgressState,
  };
};

export const getOptimizedInterval = (
  normalInterval: number,
  slowInterval?: number
): number | false => {
  // Free-plan guard: prefer manual refresh over automatic polling.
  return false;
};

export const shouldEnableRealtime = (): boolean => {
  return !cachedEgressState.shouldDisableRealtime;
};

export const getPollingMultiplier = (): number => {
  return 12; // Free-plan mode: cache aggressively and poll rarely.
};
