import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export interface PlatformInfo {
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  platform: string;
  model?: string;
  operatingSystem?: string;
  osVersion?: string;
}

let cachedPlatformInfo: PlatformInfo | null = null;

export const getPlatformInfo = async (): Promise<PlatformInfo> => {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo;
  }

  try {
    const info = await Device.getInfo();
    const platform = Capacitor.getPlatform();
    
    cachedPlatformInfo = {
      isNative: Capacitor.isNativePlatform(),
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isWeb: platform === 'web',
      platform: info.platform,
      model: info.model,
      operatingSystem: info.operatingSystem,
      osVersion: info.osVersion,
    };

    console.log('📱 Platform Info:', cachedPlatformInfo);
    return cachedPlatformInfo;
  } catch (error) {
    console.warn('Failed to get platform info:', error);
    
    // Fallback for web
    cachedPlatformInfo = {
      isNative: false,
      isIOS: false,
      isAndroid: false,
      isWeb: true,
      platform: 'web',
    };
    
    return cachedPlatformInfo;
  }
};

// Synchronous version using Capacitor only (no device details)
export const getPlatformSync = (): Partial<PlatformInfo> => {
  const platform = Capacitor.getPlatform();
  
  return {
    isNative: Capacitor.isNativePlatform(),
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
    platform,
  };
};
