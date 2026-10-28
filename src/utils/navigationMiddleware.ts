import { NavigateFunction } from 'react-router-dom';

/**
 * Navigation middleware to preserve routes and handle state management
 */
export class NavigationMiddleware {
  private static instance: NavigationMiddleware;
  private navigate?: NavigateFunction;
  
  static getInstance(): NavigationMiddleware {
    if (!NavigationMiddleware.instance) {
      NavigationMiddleware.instance = new NavigationMiddleware();
    }
    return NavigationMiddleware.instance;
  }

  setNavigate(navigate: NavigateFunction) {
    this.navigate = navigate;
  }

  /**
   * Save current route before navigation
   */
  private preserveCurrentRoute() {
    try {
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      
      // Don't preserve auth routes or home page
      if (currentPath === '/' || currentPath.includes('/auth') || currentPath.includes('/employer-auth')) {
        return;
      }

      // Determine if this is an employer route
      if (currentPath.includes('/employer-') || currentPath.includes('/company-') || currentPath.includes('/post-')) {
        sessionStorage.setItem('preservedEmployerRoute', currentPath);
        console.log('🔄 Preserved employer route:', currentPath);
      } else {
        sessionStorage.setItem('preservedRoute', currentPath);
        console.log('🔄 Preserved user route:', currentPath);
      }
    } catch (error) {
      console.warn('Failed to preserve current route:', error);
    }
  }

  /**
   * Navigate with route preservation
   */
  navigateWithPreservation(to: string, options?: { replace?: boolean; state?: any }) {
    // Preserve current route before navigating
    this.preserveCurrentRoute();
    
    if (this.navigate) {
      this.navigate(to, options);
    } else {
      console.warn('Navigate function not available, falling back to window.location');
      window.location.href = to;
    }
  }

  /**
   * Handle page refresh scenario
   */
  handlePageRefresh() {
    try {
      // CRITICAL: Skip if payment is in progress
      const isPaymentInProgress = sessionStorage.getItem('payment_in_progress') === 'true';
      if (isPaymentInProgress) {
        console.log('🔒 NavigationMiddleware: Payment in progress, skipping refresh handling');
        return;
      }
      
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      
      // IMPORTANT: Don't preserve routes when already on home page
      // This prevents the double-click issue when user is on home page and refreshes
      if (currentPath === '/' || currentPath.includes('/auth') || currentPath.includes('/employer-auth')) {
        console.log('🔄 Not preserving route - already on home/auth page');
        return;
      }

      // Don't preserve public routes that should always be fresh
      const publicRoutes = ['/jobs', '/job/', '/company-profile', '/company-directory', '/companies'];
      const isPublicRoute = publicRoutes.some(route => currentPath.includes(route));
      if (isPublicRoute) {
        console.log('🔄 Not preserving route - public route:', currentPath);
        return;
      }

      // Only preserve on page load if not on home or auth pages
      if (currentPath.includes('/employer-') || currentPath.includes('/company-') || currentPath.includes('/post-')) {
        sessionStorage.setItem('preservedEmployerRoute', currentPath);
        console.log('🔄 Page refresh - preserved employer route:', currentPath);
      } else {
        sessionStorage.setItem('preservedRoute', currentPath);
        console.log('🔄 Page refresh - preserved user route:', currentPath);
      }
    } catch (error) {
      console.warn('Failed to handle page refresh:', error);
    }
  }

  /**
   * Clear all preserved routes
   */
  clearPreservedRoutes() {
    try {
      sessionStorage.removeItem('preservedRoute');
      sessionStorage.removeItem('preservedEmployerRoute');
      sessionStorage.removeItem('appInitRoute');
    } catch (error) {
      console.warn('Failed to clear preserved routes:', error);
    }
  }
}

export const navigationMiddleware = NavigationMiddleware.getInstance();