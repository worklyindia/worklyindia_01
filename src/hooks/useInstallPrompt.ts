import { useState, useEffect, useCallback } from 'react';
import { onPromptAvailable, promptInstall, isPwaInstalled } from '@/utils/pwaInstallTrigger';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7;

const isDismissedRecently = (): boolean => {
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
};

export const useInstallPrompt = () => {
  const [canShowPrompt, setCanShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isPwaInstalled());
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) setPlatform('ios');
    else if (/android/.test(userAgent)) setPlatform('android');
    else setPlatform('desktop');

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Subscribe to the global prompt manager
    const unsubscribe = onPromptAvailable((available) => {
      setCanShowPrompt(available);
      if (!available && isPwaInstalled()) {
        setIsInstalled(true);
      }
    });

    return unsubscribe;
  }, []);

  const handlePromptInstall = useCallback(async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setIsInstalled(true);
      setCanShowPrompt(false);
    } else {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
    return accepted;
  }, []);

  const isInstallable = canShowPrompt || platform === 'ios';

  return {
    isInstallable,
    isInstalled,
    platform,
    promptInstall: handlePromptInstall,
    canShowPrompt,
  };
};
