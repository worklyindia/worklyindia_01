import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export interface PlatformStyles {
  platform: Platform;
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  containerClass: string;
  cardClass: string;
  shadowClass: string;
  buttonClass: string;
  textClass: string;
}

export const usePlatformStyle = (): PlatformStyles => {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    const detectedPlatform = Capacitor.getPlatform() as Platform;
    setPlatform(detectedPlatform);
  }, []);

  const isNative = Capacitor.isNativePlatform();
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';
  const isWeb = platform === 'web';

  // Platform-specific styling classes
  const containerClass = isIOS
    ? 'bg-background/95 backdrop-blur-xl' // iOS frosted glass
    : isAndroid
    ? 'bg-background shadow-2xl' // Android elevation
    : 'bg-background backdrop-blur-sm';

  const cardClass = isIOS
    ? 'rounded-2xl bg-card/80 backdrop-blur-md' // iOS cards
    : isAndroid
    ? 'rounded-lg bg-card shadow-md' // Android Material cards
    : 'rounded-lg bg-card';

  const shadowClass = isIOS
    ? 'shadow-sm' // Subtle iOS shadows
    : isAndroid
    ? 'shadow-lg' // Prominent Android shadows
    : 'shadow';

  const buttonClass = isIOS
    ? 'rounded-xl active:scale-95' // iOS rounded buttons
    : isAndroid
    ? 'rounded-lg active:opacity-80' // Android Material buttons
    : 'rounded-md';

  const textClass = isIOS
    ? 'font-medium' // SF Pro style
    : isAndroid
    ? 'font-normal' // Roboto style
    : 'font-normal';

  return {
    platform,
    isNative,
    isIOS,
    isAndroid,
    isWeb,
    containerClass,
    cardClass,
    shadowClass,
    buttonClass,
    textClass,
  };
};
