/**
 * Small, explicit bridge contract for the Workly Android WebView shell.
 * The website remains the source of truth for accounts and application data;
 * this bridge only exposes device capabilities.
 */
export interface WorklyAndroidBridge {
  getNativeDeviceInfo(): string;
  isNotificationPermissionGranted(): boolean;
  requestNotificationPermission(): boolean;
  registerPushNotifications(): void;
  clearAuthSession(): void;
  syncAuthSession(raw: string): void;
  isNetworkConnected(): boolean;
  setStatusBar(color: string, darkIcons: boolean): void;
  hideKeyboard(): void;
  vibrate(milliseconds: number): void;
  exitApp(): void;
  showExitHint?(): void;
  isBiometricLockEnabled?(): boolean;
  setBiometricLockEnabled?(enabled: boolean): boolean;
  getChargingAlertSettings?(): string;
  saveChargingAlertSettings?(chargingStart: boolean, chargerDisconnect: boolean, batteryFull: boolean, silentMode: boolean, monitorNotificationHidden: boolean): boolean;
  scanResumeImage?(dataUrl: string): boolean;
}

type WorklyWindow = Window & { WorklyAndroid?: WorklyAndroidBridge };

export const isWorklyAndroidApp = (): boolean =>
  typeof window !== 'undefined' &&
  /WorklyIndiaApp\/1\.0/i.test(navigator.userAgent) &&
  !!(window as WorklyWindow).WorklyAndroid;

export const getWorklyAndroidBridge = (): WorklyAndroidBridge | null =>
  isWorklyAndroidApp() ? (window as WorklyWindow).WorklyAndroid ?? null : null;

export interface NativeDeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  device: string;
  product: string;
  hardware: string;
  androidVersion: string;
  apiLevel: number;
  securityPatch: string;
  supportedAbis: string;
  totalRamGb: string;
  screenPixels: string;
  screenDensityDpi: number;
  batteryPercent: number | null;
  appVersion: string;
  appVersionCode: number;
  locale: string;
}

export const getNativeDeviceInfo = (): NativeDeviceInfo | null => {
  const bridge = getWorklyAndroidBridge();
  if (!bridge || typeof bridge.getNativeDeviceInfo !== 'function') return null;
  try {
    const parsed = JSON.parse(bridge.getNativeDeviceInfo()) as NativeDeviceInfo & { error?: string };
    return parsed.error ? null : parsed;
  } catch {
    return null;
  }
};

