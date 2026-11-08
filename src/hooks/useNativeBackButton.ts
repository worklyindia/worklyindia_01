import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { confirmDialog } from '@/lib/confirmDialog';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

export const useNativeBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isWorklyAndroidApp()) return;

    const handleBackButton = () => {
      if (location.pathname === '/' || location.pathname === '/welcome') {
        void confirmDialog(
          'Are you sure you want to exit Workly India? You can come back anytime.',
          {
            title: 'Exit Workly India?',
            confirmText: 'Exit app',
            cancelText: 'Stay here',
          },
        ).then((shouldExit) => {
          if (shouldExit) getWorklyAndroidBridge()?.exitApp();
        });
      } else {
        navigate(-1);
      }
    };
    window.addEventListener('workly-native-back', handleBackButton);
    return () => window.removeEventListener('workly-native-back', handleBackButton);
  }, [location.pathname, navigate]);
};
