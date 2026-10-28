import { useCallback } from 'react';
import { useNativeHaptics } from './useNativeHaptics';

/**
 * Combined hook for native app feel
 * Provides haptic feedback for common interactions
 */
export const useNativeFeel = () => {
  const haptics = useNativeHaptics();

  const tapFeedback = useCallback(() => {
    haptics.lightImpact();
  }, [haptics]);

  const successFeedback = useCallback(() => {
    haptics.successHaptic();
  }, [haptics]);

  const errorFeedback = useCallback(() => {
    haptics.errorHaptic();
  }, [haptics]);

  const notificationFeedback = useCallback(() => {
    haptics.mediumImpact();
  }, [haptics]);

  const swipeFeedback = useCallback(() => {
    haptics.selectionHaptic();
  }, [haptics]);

  const heavyTapFeedback = useCallback(() => {
    haptics.heavyImpact();
  }, [haptics]);

  const messageSentFeedback = useCallback(() => {
    haptics.lightImpact();
  }, [haptics]);

  const messageReceivedFeedback = useCallback(() => {
    haptics.lightImpact();
  }, [haptics]);

  const refreshStartFeedback = useCallback(() => {
    haptics.lightImpact();
  }, [haptics]);

  const refreshTriggerFeedback = useCallback(() => {
    haptics.mediumImpact();
  }, [haptics]);

  const refreshSuccessFeedback = useCallback(() => {
    haptics.successHaptic();
  }, [haptics]);

  const refreshErrorFeedback = useCallback(() => {
    haptics.errorHaptic();
  }, [haptics]);

  return {
    tapFeedback,
    successFeedback,
    errorFeedback,
    notificationFeedback,
    swipeFeedback,
    heavyTapFeedback,
    messageSentFeedback,
    messageReceivedFeedback,
    refreshStartFeedback,
    refreshTriggerFeedback,
    refreshSuccessFeedback,
    refreshErrorFeedback,
    haptics,
  };
};
