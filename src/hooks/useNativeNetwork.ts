import { useEffect, useState } from 'react';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

export const useNativeNetwork = (_showAlerts = false) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const update = () => {
      const bridge = getWorklyAndroidBridge();
      if (bridge) {
        const connected = bridge.isNetworkConnected();
        setIsOnline(connected);
        setConnectionType(connected ? 'android' : 'none');
      } else {
        setIsOnline(navigator.onLine);
        setConnectionType(navigator.onLine ? 'web' : 'none');
      }
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('workly-native-network-change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('workly-native-network-change', update);
    };
  }, []);

  return { isOnline, connectionType };
};
