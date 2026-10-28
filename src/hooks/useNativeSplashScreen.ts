import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export const useNativeSplashScreen = () => {
  useEffect(() => {
    const hideSplash = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Wait a bit to ensure React has rendered
          await new Promise(resolve => setTimeout(resolve, 500));
          await SplashScreen.hide({ fadeOutDuration: 300 });
          console.log('✅ Native splash screen hidden');
        } catch (error) {
          console.warn('Failed to hide splash screen:', error);
        }
      }
    };

    hideSplash();
  }, []);
};
