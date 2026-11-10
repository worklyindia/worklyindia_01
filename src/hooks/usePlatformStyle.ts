export interface PlatformStyles {
  platform: 'ios' | 'android' | 'web';
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

// The website runs as a browser SPA; the native Android app has its own Kotlin UI.
export const usePlatformStyle = (): PlatformStyles => ({
  platform: 'web',
  isNative: false,
  isIOS: false,
  isAndroid: false,
  isWeb: true,
  containerClass: 'bg-background backdrop-blur-sm',
  cardClass: 'rounded-lg bg-card',
  shadowClass: 'shadow',
  buttonClass: 'rounded-md',
  textClass: 'font-normal',
});
