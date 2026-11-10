import { useEffect, useState, useCallback, useRef } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { useNativeHaptics } from './useNativeHaptics';

export interface OfflineState {
  isOffline: boolean;
  connectionType: string;
  wasOffline: boolean;
  canRetry: boolean;
}

export const useOfflineRecovery = (onReconnect?: () => void) => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOffline: false,
    connectionType: 'unknown',
    wasOffline: false,
    canRetry: true,
  });
  const { successHaptic } = useNativeHaptics();
  
  // Use refs to avoid stale closures and prevent infinite loops
  const onReconnectRef = useRef(onReconnect);
  const successHapticRef = useRef(successHaptic);
  
  // Keep refs updated
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);
  
  useEffect(() => {
    successHapticRef.current = successHaptic;
  }, [successHaptic]);

  const checkConnection = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback
      const isOnline = navigator.onLine;
      setOfflineState((prev) => ({
        ...prev,
        isOffline: !isOnline,
        connectionType: isOnline ? 'wifi' : 'none',
      }));
      return;
    }

    try {
      const status = await Network.getStatus();
      setOfflineState((prev) => {
        const wasOffline = prev.isOffline;
        const isOffline = !status.connected;

        // If we were offline and now online, trigger recovery
        if (wasOffline && !isOffline && onReconnectRef.current) {
          successHapticRef.current();
          setTimeout(() => {
            onReconnectRef.current?.();
          }, 500);
        }

        return {
          isOffline,
          connectionType: status.connectionType,
          wasOffline: isOffline ? true : prev.wasOffline,
          canRetry: !isOffline,
        };
      });
    } catch (error) {
      console.warn('Failed to check network status:', error);
    }
  }, []); // No dependencies - uses refs for callbacks

  useEffect(() => {
    // Initial check
    checkConnection();

    if (!Capacitor.isNativePlatform()) {
      // Web event listeners
      const handleOnline = () => checkConnection();
      const handleOffline = () => checkConnection();

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native network listener
    let listenerHandle: any;

    const setupListener = async () => {
      listenerHandle = await Network.addListener('networkStatusChange', (status) => {
        setOfflineState((prev) => {
          const wasOffline = prev.isOffline;
          const isOffline = !status.connected;

          // If we were offline and now online, trigger recovery
          if (wasOffline && !isOffline && onReconnectRef.current) {
            successHapticRef.current();
            setTimeout(() => {
              onReconnectRef.current?.();
            }, 500);
          }

          return {
            isOffline,
            connectionType: status.connectionType,
            wasOffline: isOffline ? true : prev.wasOffline,
            canRetry: !isOffline,
          };
        });
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [checkConnection]);

  return {
    ...offlineState,
    recheckConnection: checkConnection,
  };
};
