import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog } from '@capacitor/dialog';

export const useNativeBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = async () => {
      // If on home page, show exit confirmation
      if (location.pathname === '/') {
        const { value } = await Dialog.confirm({
          title: 'Exit App',
          message: 'Are you sure you want to exit?',
          okButtonTitle: 'Exit',
          cancelButtonTitle: 'Cancel',
        });

        if (value) {
          CapacitorApp.exitApp();
        }
      } else {
        // Navigate back
        navigate(-1);
      }
    };

    let listenerHandle: any;
    
    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', handleBackButton);
    };
    
    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [location.pathname, navigate]);
};
