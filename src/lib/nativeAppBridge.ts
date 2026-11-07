/**
 * Small, explicit bridge contract for the Workly Android WebView shell.
 * The website remains the source of truth for accounts and application data;
 * this bridge only exposes device capabilities.
 */
export interface WorklyAndroidBridge {
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
}

declare global {
  interface Window {
    WorklyAndroid?: WorklyAndroidBridge;
  }
}

export const isWorklyAndroidApp = (): boolean =>
  typeof window !== 'undefined' &&
  /WorklyIndiaApp\/1\.0/i.test(navigator.userAgent) &&
  !!window.WorklyAndroid;

export const getWorklyAndroidBridge = (): WorklyAndroidBridge | null =>
  isWorklyAndroidApp() ? window.WorklyAndroid ?? null : null;
