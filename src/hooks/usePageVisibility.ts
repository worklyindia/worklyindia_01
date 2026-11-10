import { useState, useEffect, useCallback } from 'react';

interface PageVisibilityState {
  isVisible: boolean;
  wasRecentlyHidden: boolean;
}

/**
 * Hook to track page visibility state
 * Used for egress optimization - pause polling/subscriptions when page is hidden
 */
export const usePageVisibility = () => {
  const [state, setState] = useState<PageVisibilityState>({
    isVisible: !document.hidden,
    wasRecentlyHidden: false,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowVisible = !document.hidden;
      
      setState(prev => ({
        isVisible: isNowVisible,
        wasRecentlyHidden: !isNowVisible ? true : prev.wasRecentlyHidden,
      }));
      
      // Reset wasRecentlyHidden after 2 seconds of being visible
      if (isNowVisible) {
        const timeout = setTimeout(() => {
          setState(prev => ({ ...prev, wasRecentlyHidden: false }));
        }, 2000);
        return () => clearTimeout(timeout);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return state;
};

/**
 * Returns optimized refetch interval based on page visibility
 * When page is hidden, returns false (disables polling)
 * When page is visible, returns the requested interval
 * 
 * @param activeInterval - Interval in ms when page is visible
 * @param idleInterval - Optional slower interval (default: same as active)
 */
export const useVisibilityBasedInterval = (
  activeInterval: number,
  idleInterval?: number
): number | false => {
  const { isVisible } = usePageVisibility();
  
  if (!isVisible) {
    return false; // Disable polling when page is hidden
  }
  
  return idleInterval ?? activeInterval;
};

/**
 * Returns dynamic interval that slows down when user is idle
 * Great for chat applications - poll faster during active use
 * 
 * @param fastInterval - Interval when actively using (e.g., 5000ms)
 * @param slowInterval - Interval when idle (e.g., 30000ms)
 * @param idleThreshold - How long before considered idle (default: 30000ms)
 */
export const useAdaptiveInterval = (
  fastInterval: number,
  slowInterval: number,
  idleThreshold: number = 30000
): number | false => {
  const { isVisible } = usePageVisibility();
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
      setIsIdle(false);
    };

    // Listen to user interactions
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, []);

  // Check for idle state
  useEffect(() => {
    const checkIdle = setInterval(() => {
      if (Date.now() - lastActivity > idleThreshold) {
        setIsIdle(true);
      }
    }, 5000);

    return () => clearInterval(checkIdle);
  }, [lastActivity, idleThreshold]);

  if (!isVisible) {
    return false; // Disable polling when page is hidden
  }

  return isIdle ? slowInterval : fastInterval;
};

/**
 * Simple hook that returns whether polling should be enabled
 * Based on page visibility and optional additional conditions
 */
export const useShouldPoll = (additionalCondition: boolean = true): boolean => {
  const { isVisible } = usePageVisibility();
  return isVisible && additionalCondition;
};
