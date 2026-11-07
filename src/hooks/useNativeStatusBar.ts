import { useEffect } from 'react';
import { getWorklyAndroidBridge, isWorklyAndroidApp } from '@/lib/nativeAppBridge';

interface StatusBarOptions {
  color?: string;
  style?: 'light' | 'dark';
  overlay?: boolean;
}

export const useNativeStatusBar = (options: StatusBarOptions = {}) => {
  const { color = '#ffffff', style = 'dark' } = options;

  const setStatusBarColor = async (newColor: string) => {
    const bridge = getWorklyAndroidBridge();
    if (!bridge) return;
    // "dark" means dark foreground icons on a light system-bar background.
    bridge.setStatusBar(newColor, style === 'dark');
  };

  const setStatusBarStyle = async (newStyle: 'light' | 'dark') => {
    const bridge = getWorklyAndroidBridge();
    if (!bridge) return;
    bridge.setStatusBar(color, newStyle === 'dark');
  };

  useEffect(() => {
    if (!isWorklyAndroidApp()) return;
    getWorklyAndroidBridge()?.setStatusBar(color, style === 'dark');
  }, [color, style]);

  return { setStatusBarColor, setStatusBarStyle };
};
