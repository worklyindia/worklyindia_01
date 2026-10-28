import { useState, useEffect } from 'react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { useAuth } from '@/contexts/AuthContext';

interface UsePeriodicNotificationPromptOptions {
  enabled?: boolean;
  intervalMinutes?: number; // How often to show the prompt in minutes
  maxAttempts?: number; // Maximum number of times to show the prompt
}

export const usePeriodicNotificationPrompt = (options: UsePeriodicNotificationPromptOptions = {}) => {
  const {
    enabled = true,
    intervalMinutes = 5, // Show every 5 minutes for employers
    maxAttempts = 15 // Show maximum 15 times for employers
  } = options;

  const [showPrompt, setShowPrompt] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const { user } = useAuth();

  useEffect(() => {
    if (!enabled || !user) return;

    const checkAndShowPrompt = async () => {
      try {
        // Check current permission status
        const status = await FirebasePushService.checkPermissionStatus();
        setPermissionStatus(status);

        // Don't show if already granted or permanently denied
        if (status === 'granted') {
          setShowPrompt(false);
          return;
        }

        // Check if we've shown too many times
        const storageKey = `notification-prompt-attempts-${user.id}`;
        const attempts = parseInt(localStorage.getItem(storageKey) || '0');
        
        if (attempts >= maxAttempts) {
          setShowPrompt(false);
          return;
        }

        // Check if we should show based on interval
        const lastShownKey = `notification-prompt-last-shown-${user.id}`;
        const lastShown = localStorage.getItem(lastShownKey);
        const now = Date.now();
        
        if (lastShown) {
          const timeSinceLastShown = now - parseInt(lastShown);
          const intervalMs = intervalMinutes * 60 * 1000;
          
          if (timeSinceLastShown < intervalMs) {
            setShowPrompt(false);
            return;
          }
        }

        // Don't show if dismissed in current session
        const sessionDismissed = sessionStorage.getItem('notification-prompt-dismissed');
        if (sessionDismissed) {
          setShowPrompt(false);
          return;
        }

        // Show the prompt if permission is default
        if (status === 'default') {
          setShowPrompt(true);
          
          // Update storage
          localStorage.setItem(lastShownKey, now.toString());
          localStorage.setItem(storageKey, (attempts + 1).toString());
        }
      } catch (error) {
        console.error('Error in periodic notification prompt:', error);
      }
    };

    // Initial check
    checkAndShowPrompt();

    // Set up periodic check
    const interval = setInterval(checkAndShowPrompt, intervalMinutes * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, user, intervalMinutes, maxAttempts]);

  const handlePermissionGranted = () => {
    setPermissionStatus('granted');
    setShowPrompt(false);
    sessionStorage.removeItem('notification-prompt-dismissed');
  };

  const handlePermissionDenied = () => {
    setPermissionStatus('denied');
    setShowPrompt(false);
    sessionStorage.setItem('notification-prompt-dismissed', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('notification-prompt-dismissed', 'true');
  };

  return {
    showPrompt,
    permissionStatus,
    handlePermissionGranted,
    handlePermissionDenied,
    handleDismiss
  };
};