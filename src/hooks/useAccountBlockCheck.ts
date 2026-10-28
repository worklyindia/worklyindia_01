import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AccountBlockState {
  isBlocked: boolean;
  isChecking: boolean;
  reason: string | null;
  originalAccountHint: string | null;
  matchedSignals: string[] | null;
  confidenceScore: number | null;
}

const DEFAULT_REASON = 'Your account has been blocked because it was identified as a duplicate account. Only one account per person is allowed. If you already have an account, please use that account instead.';

const UNBLOCKED_STATE: AccountBlockState = {
  isBlocked: false,
  isChecking: false,
  reason: null,
  originalAccountHint: null,
  matchedSignals: null,
  confidenceScore: null,
};

export const useAccountBlockCheck = (isAuthenticated: boolean) => {
  const [state, setState] = useState<AccountBlockState>({
    ...UNBLOCKED_STATE,
    isChecking: true,
  });
  const retryTimersRef = useRef<number[]>([]);
  const initialCheckDoneRef = useRef(false);

  const clearRetryTimers = useCallback(() => {
    retryTimersRef.current.forEach((timer) => clearTimeout(timer));
    retryTimersRef.current = [];
  }, []);

  const checkBlock = useCallback(async () => {
    if (!isAuthenticated) {
      clearRetryTimers();
      setState(UNBLOCKED_STATE);
      return;
    }

    // Only flip isChecking on the very first run — keep background re-checks silent
    // so opening profile edit pages doesn't cause any visible refresh/flash.
    if (!initialCheckDoneRef.current) {
      setState((prev) => ({ ...prev, isChecking: true }));
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setState(UNBLOCKED_STATE);
        return;
      }

      const { data, error } = await supabase
        .from('blocked_accounts' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Block check error:', error);
        setState(UNBLOCKED_STATE);
        return;
      }

      if (!data) {
        setState(UNBLOCKED_STATE);
        return;
      }

      // Check if screen block is enabled globally
      const { data: screenBlockSetting } = await supabase
        .from('app_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'duplicate_screen_block')
        .maybeSingle();

      const screenBlockEnabled = !screenBlockSetting || (screenBlockSetting as any).setting_value !== 'false';
      
      if (!screenBlockEnabled) {
        // Screen block is OFF — don't show blocked screen
        setState(UNBLOCKED_STATE);
        return;
      }

      const blockData = data as any;
      const signals = blockData.block_signals || {};

      const matchedSignals: string[] = [];
      if (signals.matched_device_id) matchedSignals.push('Device ID');
      if (signals.matched_fingerprint) matchedSignals.push('Browser Fingerprint');
      if (signals.matched_canvas) matchedSignals.push('Canvas Fingerprint');
      if (signals.matched_ip) matchedSignals.push('IP Address');
      if (signals.matched_audio) matchedSignals.push('Audio Fingerprint');

      let reason = DEFAULT_REASON;
      if (matchedSignals.length > 0) {
        reason = `${DEFAULT_REASON} Matched signals: ${matchedSignals.join(', ')}.`;
      }

      // Validate original_email_hint — follow chain to find truly unblocked original
      let validOriginalHint: string | null = null;
      if (signals.original_email_hint && blockData.original_user_id) {
        try {
          const { data: originalBlock } = await supabase
            .from('blocked_accounts' as any)
            .select('original_user_id, block_signals, is_active')
            .eq('user_id', blockData.original_user_id)
            .eq('is_active', true)
            .maybeSingle();

          if (originalBlock) {
            // The "original" is also blocked — follow chain up to 5 levels
            let currentUserId = (originalBlock as any).original_user_id;
            let foundValid = false;
            for (let i = 0; i < 5 && currentUserId; i++) {
              const { data: chainBlock } = await supabase
                .from('blocked_accounts' as any)
                .select('original_user_id, block_signals, is_active')
                .eq('user_id', currentUserId)
                .eq('is_active', true)
                .maybeSingle();

              if (!chainBlock) {
                // This user is NOT blocked — use the hint from the chain block's signals
                const chainHint = (originalBlock as any).block_signals?.original_email_hint as string | undefined;
                validOriginalHint = chainHint || (signals.original_email_hint as string) || null;
                foundValid = true;
                break;
              }
              currentUserId = (chainBlock as any).original_user_id;
            }
            if (!foundValid) {
              validOriginalHint = null;
            }
          } else {
            // Original user is NOT blocked — use the hint already stored in block_signals directly (full email)
            validOriginalHint = (signals.original_email_hint as string) || null;
          }
        } catch (err) {
          console.error('Error validating original account hint:', err);
        }
      }

      setState({
        isBlocked: true,
        isChecking: false,
        reason,
        originalAccountHint: validOriginalHint,
        matchedSignals,
        confidenceScore: signals.confidence_score || null,
      });
      initialCheckDoneRef.current = true;
    } catch (err) {
      console.error('Account block check failed:', err);
      initialCheckDoneRef.current = true;
      setState(UNBLOCKED_STATE);
    }
  }, [isAuthenticated, clearRetryTimers]);

  // Check on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      initialCheckDoneRef.current = false;
      setState(UNBLOCKED_STATE);
      return;
    }
    checkBlock();
  }, [isAuthenticated, checkBlock]);

  // Listen for device-block-detected events from autoDeviceInfoCollector
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      // blocked can be true/null when backend blocked but response parse was partial
      if (detail?.blocked !== false) {
        console.log('🚫 device-block-detected event received — rechecking block status');
        checkBlock();
      }
    };

    window.addEventListener('device-block-detected', handler);
    return () => window.removeEventListener('device-block-detected', handler);
  }, [checkBlock]);

  // Force recheck method that always runs regardless of state
  const forceRecheck = useCallback(() => {
    if (isAuthenticated) {
      console.log('🔄 Force re-checking account block status');
      checkBlock();
    }
  }, [isAuthenticated, checkBlock]);

  return {
    ...state,
    initialCheckDone: initialCheckDoneRef.current,
    recheck: checkBlock,
    forceRecheck,
  };
};
