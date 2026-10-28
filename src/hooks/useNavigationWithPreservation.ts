import { useNavigate } from 'react-router-dom';
import { navigationMiddleware } from '@/utils/navigationMiddleware';

/**
 * Custom hook that provides navigation with automatic route preservation
 * Use this instead of useNavigate() directly for better route handling
 */
export const useNavigationWithPreservation = () => {
  const navigate = useNavigate();

  // Initialize navigation middleware
  navigationMiddleware.setNavigate(navigate);

  const navigateWithPreservation = (to: string, options?: { replace?: boolean; state?: any }) => {
    navigationMiddleware.navigateWithPreservation(to, options);
  };

  const navigateReplace = (to: string, state?: any) => {
    navigateWithPreservation(to, { replace: true, state });
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigationMiddleware.clearPreservedRoutes();
      navigate('/', { replace: true });
    }
  };

  return {
    navigate: navigateWithPreservation,
    navigateReplace,
    goBack,
    // Also expose original navigate for cases where preservation isn't needed
    navigateOriginal: navigate
  };
};