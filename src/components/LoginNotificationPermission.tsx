import { useEffect, useRef, useState } from 'react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { NotificationUnblockGuide } from '@/components/NotificationUnblockGuide';

/**
 * Asks for browser notification permission on the login screens.
 * The request is fired on the visitor's first interaction with the page so the
 * browser treats it as a user gesture. If notifications were blocked earlier,
 * the step-by-step unblock guide is shown instead.
 */
export const LoginNotificationPermission: React.FC = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const askedRef = useRef(false);

  useEffect(() => {
    const canEnable = FirebasePushService.canEnableNotifications();
    if (!canEnable.canEnable) return;
    if (typeof Notification === 'undefined') return;

    const ask = async () => {
      if (askedRef.current) return;
      askedRef.current = true;
      cleanup();
      try {
        const permission = await FirebasePushService.ensurePermission();
        if (permission === 'granted') {
          await FirebasePushService.requestPermissionAndSaveToken();
        } else if (permission === 'denied') {
          setShowGuide(true);
        }
      } catch (error) {
        console.error('Login notification permission request failed:', error);
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointerdown', ask);
      window.removeEventListener('keydown', ask);
    };

    if (Notification.permission === 'granted') {
      askedRef.current = true;
      void FirebasePushService.requestPermissionAndSaveToken();
      return;
    }

    window.addEventListener('pointerdown', ask, { once: true });
    window.addEventListener('keydown', ask, { once: true });
    return cleanup;
  }, []);

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      const permission = await FirebasePushService.checkPermissionStatus();
      if (permission === 'granted') {
        await FirebasePushService.requestPermissionAndSaveToken();
        setShowGuide(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <NotificationUnblockGuide
      open={showGuide}
      onOpenChange={setShowGuide}
      onRecheck={handleRecheck}
      isChecking={isChecking}
    />
  );
};

export default LoginNotificationPermission;
