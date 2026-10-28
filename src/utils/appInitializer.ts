import { navigationMiddleware } from './navigationMiddleware';
import { isProduction } from '@/config/domainConfig';

// Enhanced app initialization utilities with route preservation
export const initializeApp = () => {
  // Enhanced route preservation on app initialization
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  
  // Only exclude auth routes from preservation - public routes like /job/ should work via direct URL
  if (currentPath !== '/' && !currentPath.includes('/auth') && !currentPath.includes('/employer-auth')) {
    try {
      // Use the navigation middleware for consistent route handling
      navigationMiddleware.handlePageRefresh();
      
      // Fallback to old method if needed (only for non-public routes)
      sessionStorage.setItem('appInitRoute', currentPath);
    } catch (e) {
      console.warn('Failed to preserve route on app init:', e);
    }
  }
};

// Hide loading fallbacks safely
export const hideLoadingFallback = () => {
  // Hide the 3D loading screen via global function
  if (typeof window !== 'undefined' && (window as any).__hideLoadingScreen) {
    (window as any).__hideLoadingScreen();
  }

  const elements = ['loading-fallback', 'static-hero'];
  elements.forEach(id => {
    try {
      const element = document.getElementById(id);
      if (element && !element.classList.contains('hidden')) {
        element.classList.add('hidden');
        setTimeout(() => {
          if (element?.style) {
            element.style.display = 'none';
          }
        }, 150);
      }
    } catch (error) {
      console.warn(`Could not hide loading element ${id}:`, error);
    }
  });
};

// Initialize performance utilities only in production
export const initializePerformanceUtils = async () => {
  if (process.env.NODE_ENV === 'production' && isProduction()) {
    try {
      const { preloadResources } = await import("./performance");
      preloadResources();
      // Root scope belongs to the Firebase messaging worker only — registering
      // another worker here breaks push images and action buttons.
    } catch (error) {
      console.warn('Performance utilities failed to load:', error);
    }
  }
};

// Initialize error monitoring
export const initializeErrorMonitoring = async () => {
  try {
    const { initializeErrorMonitoring } = await import('./errorMonitoring');
    initializeErrorMonitoring();
  } catch (error) {
    console.warn('Error monitoring failed to initialize:', error);
  }
};