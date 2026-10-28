import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface StatusBarOptions {
  color?: string;
  style?: 'light' | 'dark';
  overlay?: boolean;
}

export const useNativeStatusBar = (options: StatusBarOptions = {}) => {
  const {
    color = '#2563eb', // Primary blue color
    style = 'light',
    overlay = false,
  } = options;

  useEffect(() => {
    const setupStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Set status bar color (Android)
        await StatusBar.setBackgroundColor({ color });

        // Set status bar style (iOS & Android)
        await StatusBar.setStyle({
          style: style === 'light' ? Style.Dark : Style.Light,
        });

        // Set overlay mode
        if (overlay) {
          await StatusBar.setOverlaysWebView({ overlay: true });
        }

        console.log('✅ Status bar configured:', { color, style, overlay });
      } catch (error) {
        console.warn('Failed to configure status bar:', error);
      }
    };

    setupStatusBar();
  }, [color, style, overlay]);

  const setStatusBarColor = async (newColor: string) => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.setBackgroundColor({ color: newColor });
    } catch (error) {
      console.warn('Failed to set status bar color:', error);
    }
  };

  const setStatusBarStyle = async (newStyle: 'light' | 'dark') => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await StatusBar.setStyle({
        style: newStyle === 'light' ? Style.Dark : Style.Light,
      });
    } catch (error) {
      console.warn('Failed to set status bar style:', error);
    }
  };

  return {
    setStatusBarColor,
    setStatusBarStyle,
  };
};
