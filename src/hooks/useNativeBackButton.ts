import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

export const useNativeBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastRootBackAt = useRef(0);

  useEffect(() => {
    if (!isWorklyAndroidApp()) return;

    const handleBackButton = () => {
      const path = location.pathname;
      const isHome = path === '/' || path === '/welcome';

      if (!isHome) {
        lastRootBackAt.current = 0;

        // The schedule form is a full-height drawer. Always close it back to
        // the interviews list instead of relying on WebView/SPA history state,
        // which can be missing when the app is opened from a deep link.
        if (path === '/employer/schedule-interview') {
          navigate('/employer/interviews', { replace: true });
          return;
        }

        // Interview rooms should return to the interview list, not the app
        // landing page, when opened directly without a usable history entry.
        if (path.startsWith('/interview/')) {
          if (Number((window.history.state as any)?.idx) > 0) {
            navigate(-1);
          } else {
            navigate('/employer/interviews', { replace: true });
          }
          return;
        }

        if (Number((window.history.state as any)?.idx) > 0) {
          navigate(-1);
        } else {
          navigate('/', { replace: true });
        }
        return;
      }

      const now = Date.now();
      if (now - lastRootBackAt.current < 2000) {
        lastRootBackAt.current = 0;
        getWorklyAndroidBridge()?.exitApp();
        return;
      }

      lastRootBackAt.current = now;
      getWorklyAndroidBridge()?.showExitHint?.();
    };

    window.addEventListener('workly-native-back', handleBackButton);
    return () => window.removeEventListener('workly-native-back', handleBackButton);
  }, [location.pathname, navigate]);
};
