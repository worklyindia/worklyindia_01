// Global PWA install prompt manager - SINGLE SOURCE OF TRUTH
// Captures beforeinstallprompt once and exposes it to all consumers

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isAppInstalled = false;
let listeners: Array<(available: boolean) => void> = [];

const notifyListeners = (available: boolean) => {
  listeners.forEach(fn => fn(available));
};

// Initialize listener early (call once in App.tsx)
export const initPwaInstallListener = () => {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isAppInstalled = true;
    return;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('📱 PWA install prompt captured and deferred');
    notifyListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    isAppInstalled = true;
    deferredPrompt = null;
    console.log('✅ App installed successfully');
    notifyListeners(false);
  });
};

// Trigger install prompt (call after login/signup with 3s delay)
export const triggerPwaInstallAfterLogin = async (): Promise<boolean> => {
  if (isAppInstalled) {
    console.log('📱 App already installed, skipping install prompt');
    return false;
  }

  if (!deferredPrompt) {
    console.log('📱 No install prompt available - banner will handle UI');
    return false;
  }

  try {
    console.log('📱 Triggering PWA install prompt after login...');
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ User accepted PWA install after login');
      isAppInstalled = true;
    } else {
      console.log('❌ User dismissed PWA install after login');
    }
    
    deferredPrompt = null;
    notifyListeners(false);
    return outcome === 'accepted';
  } catch (error) {
    console.error('PWA install prompt error:', error);
    deferredPrompt = null;
    notifyListeners(false);
    return false;
  }
};

// For manual install buttons/banners
export const promptInstall = async (): Promise<boolean> => {
  return triggerPwaInstallAfterLogin();
};

// Subscribe to prompt availability changes (for hooks)
export const onPromptAvailable = (callback: (available: boolean) => void): (() => void) => {
  listeners.push(callback);
  // Immediately notify current state
  callback(!!deferredPrompt && !isAppInstalled);
  return () => {
    listeners = listeners.filter(fn => fn !== callback);
  };
};

export const isPwaInstalled = () => isAppInstalled;
export const hasDeferredPrompt = () => !!deferredPrompt;
