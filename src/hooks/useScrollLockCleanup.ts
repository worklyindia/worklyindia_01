import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Comprehensive scroll lock cleanup hook
 * Prevents page from getting stuck in a non-scrollable state
 * Handles: Radix UI modals, Tidio widget, route changes, user interactions
 */
export const useScrollLockCleanup = () => {
  const location = useLocation();
  const stuckTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Force unlock scroll - comprehensive cleanup
  const forceUnlockScroll = useCallback(() => {
    // Reset body styles
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    
    // Reset html styles
    document.documentElement.style.overflow = '';
    document.documentElement.style.position = '';
    
    // Remove Radix UI scroll lock attributes
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.removeAttribute('data-scroll-locked');
    
    // Remove any stuck Radix popper wrappers that might block scroll
    const stuckPoppers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
    stuckPoppers.forEach((popper) => {
      // Only remove if it's orphaned (no visible content)
      if (!popper.querySelector('[data-state="open"]')) {
        popper.remove();
      }
    });

    // Remove vaul drawer body styles
    document.body.style.setProperty('--removed-body-scroll-bar-size', '');
    
    // Reset stuck counter
    stuckTimeRef.current = 0;
  }, []);

  // Check if scroll is stuck
  const isScrollStuck = useCallback(() => {
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const hasScrollLock = document.body.hasAttribute('data-scroll-locked');
    
    return bodyOverflow === 'hidden' || htmlOverflow === 'hidden' || hasScrollLock;
  }, []);

  // Cleanup on route changes
  useEffect(() => {
    const timer = setTimeout(forceUnlockScroll, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, forceUnlockScroll]);

  // Periodic check every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (isScrollStuck()) {
        stuckTimeRef.current += 5;
        // If stuck for more than 5 seconds with no open modals, force unlock
        if (stuckTimeRef.current >= 5) {
          const hasOpenModal = document.querySelector('[data-state="open"][role="dialog"]');
          const hasOpenSheet = document.querySelector('[data-state="open"][data-vaul-drawer]');
          
          if (!hasOpenModal && !hasOpenSheet) {
            console.log('[ScrollLockCleanup] Force unlocking stuck scroll');
            forceUnlockScroll();
          }
        }
      } else {
        stuckTimeRef.current = 0;
      }
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScrollStuck, forceUnlockScroll]);

  // User interaction recovery - click/touch
  useEffect(() => {
    const handleInteraction = () => {
      if (isScrollStuck()) {
        const hasOpenModal = document.querySelector('[data-state="open"][role="dialog"]');
        const hasOpenSheet = document.querySelector('[data-state="open"][data-vaul-drawer]');
        
        // Only force unlock if no modals are actually open
        if (!hasOpenModal && !hasOpenSheet) {
          forceUnlockScroll();
        }
      }
    };

    // Debounced interaction handler
    let interactionTimeout: NodeJS.Timeout;
    const debouncedInteraction = () => {
      clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(handleInteraction, 500);
    };

    document.addEventListener('click', debouncedInteraction, { passive: true });
    document.addEventListener('touchstart', debouncedInteraction, { passive: true });

    return () => {
      document.removeEventListener('click', debouncedInteraction);
      document.removeEventListener('touchstart', debouncedInteraction);
      clearTimeout(interactionTimeout);
    };
  }, [isScrollStuck, forceUnlockScroll]);

  // Browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setTimeout(forceUnlockScroll, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [forceUnlockScroll]);

  // Tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          if (isScrollStuck()) {
            const hasOpenModal = document.querySelector('[data-state="open"][role="dialog"]');
            if (!hasOpenModal) {
              forceUnlockScroll();
            }
          }
        }, 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isScrollStuck, forceUnlockScroll]);

  // Initial cleanup on mount
  useEffect(() => {
    const timer = setTimeout(forceUnlockScroll, 500);
    return () => clearTimeout(timer);
  }, [forceUnlockScroll]);
};
