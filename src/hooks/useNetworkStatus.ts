import { useEffect, useState } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isSlow: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlow: false,
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
  });

  useEffect(() => {
    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      const effectiveType = connection?.effectiveType || 'unknown';
      const downlink = connection?.downlink || 0;
      const rtt = connection?.rtt || 0;
      
      // Consider network slow if 2G or slow-2g
      const isSlow = effectiveType === 'slow-2g' || 
                     effectiveType === '2g' || 
                     downlink < 0.5 ||
                     rtt > 500;

      setNetworkStatus({
        isOnline: navigator.onLine,
        isSlow,
        effectiveType,
        downlink,
        rtt,
      });
    };

    const handleOnline = () => {
      updateNetworkStatus();
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: false }));
    };

    // Initial check
    updateNetworkStatus();

    // Listen for connection changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  return networkStatus;
};
