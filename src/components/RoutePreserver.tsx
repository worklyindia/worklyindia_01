import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';

/**
 * RoutePreserver component handles route restoration after authentication
 * Prevents users from being redirected to home page after refresh
 * Fixed to prevent React hooks rule violations and navigation conflicts
 */
const RoutePreserver = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: employerUser, loading: employerLoading } = useEmployerAuth();
  
  // Navigation state management to prevent multiple clicks
  const [isNavigating, setIsNavigating] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const hasRestoredRef = useRef(false);

  // Track when auth contexts are fully initialized
  useEffect(() => {
    if (!authLoading && !employerLoading && !authInitialized) {
      console.log('🔄 Auth contexts initialized, ready for route restoration');
      setAuthInitialized(true);
    }
  }, [authLoading, employerLoading, authInitialized]);

  useEffect(() => {
    // CRITICAL: Clear preserved routes immediately when user intentionally navigates to home
    // This must run before any restoration logic
    if (location.pathname === '/' && authInitialized) {
      try {
        const currentPreservedRoute = sessionStorage.getItem('preservedRoute');
        const currentPreservedEmployerRoute = sessionStorage.getItem('preservedEmployerRoute');
        const currentAppInitRoute = sessionStorage.getItem('appInitRoute');
        
        // If user is on home page and there are preserved routes, clear them immediately
        if (currentPreservedRoute || currentPreservedEmployerRoute || currentAppInitRoute) {
          console.log('🔄 User on home - clearing ALL preserved routes immediately');
          sessionStorage.removeItem('preservedRoute');
          sessionStorage.removeItem('preservedEmployerRoute');
          sessionStorage.removeItem('appInitRoute');
          
          // Mark as restored to prevent any further restoration attempts
          hasRestoredRef.current = true;
        }
        
        // Don't proceed with restoration if user is intentionally on home page
        return;
      } catch (e) {
        console.warn('Could not clear preserved routes:', e);
      }
    }

    // Prevent route restoration if:
    // 1. Auth is still loading
    // 2. Not on home page  
    // 3. Already navigating
    // 4. Already restored once
    // 5. Payment is in progress (CRITICAL - prevents closing Razorpay popup)
    const isPaymentInProgress = (): boolean => {
      try { 
        return sessionStorage.getItem('payment_in_progress') === 'true';
      } catch { return false; }
    };
    
    if (!authInitialized || location.pathname !== '/' || isNavigating || hasRestoredRef.current || isPaymentInProgress()) {
      if (isPaymentInProgress()) {
        console.log('🔒 RoutePreserver: Payment in progress, blocking route restoration');
      }
      return;
    }

    // Add delay to ensure all components are mounted and stable
    const restoreTimer = setTimeout(() => {
      try {
        console.log('🔄 Attempting route restoration...');
        
        // Check for preserved routes with fallback handling
        let preservedRoute: string | null = null;
        let preservedEmployerRoute: string | null = null;
        let appInitRoute: string | null = null;
        
        // Safely get preserved routes
        try {
          preservedRoute = sessionStorage.getItem('preservedRoute');
          preservedEmployerRoute = sessionStorage.getItem('preservedEmployerRoute');
          appInitRoute = sessionStorage.getItem('appInitRoute');
        } catch (storageError) {
          console.warn('🔄 Storage access error:', storageError);
          return;
        }

        let routeToRestore: string | null = null;

        // Enhanced route restoration logic with better employer portal handling
        if (employerUser && preservedEmployerRoute && preservedEmployerRoute !== '/') {
          routeToRestore = preservedEmployerRoute;
          try {
            sessionStorage.removeItem('preservedEmployerRoute');
            // Also preserve any hash/query params for employer dashboard tabs
            if (preservedEmployerRoute.includes('employer-portal') || preservedEmployerRoute.includes('company-')) {
              console.log('🔄 Restoring employer portal route with state preservation');
            }
          } catch (e) {
            console.warn('Could not clear preserved employer route:', e);
          }
        } else if (authUser && preservedRoute && preservedRoute !== '/') {
          routeToRestore = preservedRoute;
          try {
            sessionStorage.removeItem('preservedRoute');
          } catch (e) {
            console.warn('Could not clear preserved route:', e);
          }
        } else if ((authUser || employerUser) && appInitRoute && appInitRoute !== '/') {
          routeToRestore = appInitRoute;
          try {
            sessionStorage.removeItem('appInitRoute');
          } catch (e) {
            console.warn('Could not clear app init route:', e);
          }
        }

        // Public routes work via direct URL - don't need auth-based restoration
        // These routes should be accessible without login so no need to restore after auth
        const authOnlyRoutes = ['/dashboard', '/messages', '/saved-jobs', '/applications', '/referrals', '/notifications', '/employer-portal', '/settings', '/profile'];
        const isAuthProtectedRoute = authOnlyRoutes.some(route => routeToRestore?.startsWith(route));

        // Never auto-restore onboarding/setup flows
        const forbiddenRestoreRoutes = ['/profile-setup', '/company-profile-setup', '/JobSeeker/Profile/Edit', '/Employer/Profile/Edit', '/JobSeeker/Setup', '/Employer/Setup'];
        const isForbiddenRoute = forbiddenRestoreRoutes.some(route => routeToRestore?.startsWith(route));
        
        // Only restore auth-protected routes after login
        const isValidRoute = routeToRestore && 
            routeToRestore !== '/' && 
            routeToRestore !== location.pathname &&
            !routeToRestore.includes('/auth') && // Avoid auth loops
            !routeToRestore.includes('/employer-auth') && // Avoid employer auth loops
            isAuthProtectedRoute && // Only restore auth-protected routes
            !isForbiddenRoute && // Don't restore profile setup routes
            routeToRestore.length < 200; // Prevent malformed URLs

        if (isValidRoute) {
          console.log('🔄 Restoring validated route:', routeToRestore);
          setIsNavigating(true);
          hasRestoredRef.current = true;
          
          // Use replace to avoid back button issues
          navigate(routeToRestore, { replace: true });
          
          // Reset navigation state with slightly longer delay for complex routes
          setTimeout(() => {
            if (mountedRef.current) {
              setIsNavigating(false);
            }
          }, 300);
        } else {
          console.log('🔄 No valid route to restore');
        }
      } catch (error) {
        console.error('🔄 Error during route restoration:', error);
        
        // Report error to monitoring
        import('../utils/errorMonitoring').then(({ handleNavigationError }) => {
          handleNavigationError(error, 'RoutePreserver');
        });
        
        // Reset state on error
        setIsNavigating(false);
        
        // Clear potentially problematic routes
        try {
          sessionStorage.removeItem('preservedRoute');
          sessionStorage.removeItem('preservedEmployerRoute');
          sessionStorage.removeItem('appInitRoute');
        } catch (e) {
          console.warn('Could not clear routes after error:', e);
        }
      }
    }, 150); // Slightly longer delay for stability

    return () => {
      clearTimeout(restoreTimer);
    };
  }, [authInitialized, location.pathname, navigate, authUser, employerUser, isNavigating]);

  // Additional effect to handle mount tracking
  const mountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return null; // This component doesn't render anything
};

export default RoutePreserver;