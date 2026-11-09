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
      const isHome = location.pathname === '/' || location.pathname === '/welcome';
      if (!isHome) {
        lastRootBackAt.current = 0;
        if (Number((window.history.state as any)?.idx) > 0) navigate(-1);
        else navigate('/', { replace: true });
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
