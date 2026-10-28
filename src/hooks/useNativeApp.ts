import { useNativeSplashScreen } from './useNativeSplashScreen';
import { useNativeStatusBar } from './useNativeStatusBar';
import { useNativeKeyboard } from './useNativeKeyboard';
import { useNativeBackButton } from './useNativeBackButton';
import { useNativeNetwork } from './useNativeNetwork';
import { useScrollLockCleanup } from './useScrollLockCleanup';

// Consolidated hook for all native app features
export const useNativeApp = () => {
  // Initialize splash screen
  useNativeSplashScreen();

  // Setup status bar
  const statusBar = useNativeStatusBar({
    color: '#2563eb',
    style: 'light',
  });

  // Setup keyboard
  const keyboard = useNativeKeyboard();

  // Setup back button
  useNativeBackButton();

  // Setup network monitoring
  const network = useNativeNetwork(true);

  // Setup scroll lock cleanup to prevent stuck scroll states
  useScrollLockCleanup();

  return {
    statusBar,
    keyboard,
    network,
  };
};
