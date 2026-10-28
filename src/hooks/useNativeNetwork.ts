import { useEffect, useState } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';

export const useNativeNetwork = (showAlerts = true) => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback for web
      setIsOnline(navigator.onLine);
      return;
    }

    const checkNetworkStatus = async () => {
      try {
        const status: ConnectionStatus = await Network.getStatus();
        setIsOnline(status.connected);
        setConnectionType(status.connectionType);
        console.log('📡 Network status:', status);
      } catch (error) {
        console.warn('Failed to get network status:', error);
      }
    };

    // Initial check
    checkNetworkStatus();

    let listenerHandle: any;

    // Listen for network changes
    const setupListener = async () => {
      listenerHandle = await Network.addListener('networkStatusChange', async (status) => {
        console.log('📡 Network status changed:', status);
        setIsOnline(status.connected);
        setConnectionType(status.connectionType);

        if (showAlerts) {
          if (!status.connected) {
            await Dialog.alert({
              title: 'No Internet Connection',
              message: 'You are currently offline. Some features may not work.',
              buttonTitle: 'OK',
            });
          } else {
            // Show brief toast or notification when back online
            console.log('✅ Back online!');
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [showAlerts]);

  return {
    isOnline,
    connectionType,
  };
};
