import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FirebasePushService } from "@/services/FirebasePushService";

interface NotificationChannels {
  email: {
    address: string;
    isActive: boolean;
  };
  push: {
    isSupported: boolean;
    isEnabled: boolean;
    deviceType: string;
    token?: string;
    canEnable: boolean;
    restrictionReason?: string;
  };
}

export const useNotificationChannels = () => {
  const [channels, setChannels] = useState<NotificationChannels>({
    email: {
      address: "",
      isActive: false,
    },
    push: {
      isSupported: false,
      isEnabled: false,
      deviceType: "Web",
      token: undefined,
      canEnable: false,
      restrictionReason: undefined,
    },
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    initializeChannels();
  }, []);

  const initializeChannels = async () => {
    try {
      // Get user email
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setChannels(prev => ({
          ...prev,
          email: {
            address: user.email || "",
            isActive: true,
          },
        }));
      }

      // Check mobile push capabilities (Capacitor native)
      if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform();
        const deviceType = platform === 'ios' ? 'iPhone App' : 
                          platform === 'android' ? 'Android App' : 'Mobile App';

        setChannels(prev => ({
          ...prev,
          push: {
            ...prev.push,
            isSupported: true,
            deviceType,
            canEnable: true,
          },
        }));

        // Check current permission status
        const result = await PushNotifications.checkPermissions();
        const isEnabled = result.receive === 'granted';

        setChannels(prev => ({
          ...prev,
          push: {
            ...prev.push,
            isEnabled,
          },
        }));

        if (isEnabled) {
          await getToken();
        }
      } else {
        // Web push - check OneSignal support
        const canEnableCheck = FirebasePushService.canEnableNotifications();
        const isWebPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        
        setChannels(prev => ({
          ...prev,
          push: {
            ...prev.push,
            isSupported: isWebPushSupported,
            deviceType: 'Web Browser',
            canEnable: canEnableCheck.canEnable,
            restrictionReason: canEnableCheck.reason,
          },
        }));

        // Check if already subscribed via OneSignal
        if (canEnableCheck.canEnable) {
          try {
            const isSubscribed = await FirebasePushService.isSubscribed();
            const permission = await FirebasePushService.checkPermissionStatus();
            
            setChannels(prev => ({
              ...prev,
              push: {
                ...prev.push,
                isEnabled: isSubscribed && permission === 'granted',
              },
            }));
          } catch (error) {
            console.warn('Could not check OneSignal status:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing notification channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const getToken = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // For native platforms, register to get token
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration token:', token.value);
          setChannels(prev => ({
            ...prev,
            push: {
              ...prev.push,
              token: token.value,
            },
          }));
        });
      }
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  };

  const enablePushNotifications = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Request permissions for native platforms
        const result = await PushNotifications.requestPermissions();
        
        if (result.receive === 'granted') {
          await PushNotifications.register();
          
          setChannels(prev => ({
            ...prev,
            push: {
              ...prev.push,
              isEnabled: true,
            },
          }));

          toast({
            title: "Success",
            description: "Push notifications enabled successfully",
          });

          await getToken();
        } else {
          toast({
            title: "Permission denied",
            description: "Push notification permission was denied",
            variant: "destructive",
          });
        }
      } else {
        // Web push - use OneSignal
        const canEnableCheck = FirebasePushService.canEnableNotifications();
        
        if (!canEnableCheck.canEnable) {
          toast({
            title: "Not Available",
            description: canEnableCheck.reason || "Push notifications not supported",
            variant: "destructive",
          });
          return;
        }

        const permission = await FirebasePushService.ensurePermission();
        if (permission !== 'granted') {
          toast({
            title: permission === 'denied' ? "Notifications blocked" : "Permission needed",
            description: permission === 'denied'
              ? "Allow notifications in this site's browser settings, then try again."
              : "Tap Allow in the browser notification prompt.",
            variant: "destructive",
          });
          return;
        }

        const success = await FirebasePushService.requestPermissionAndSaveToken();
        
        if (success) {
          setChannels(prev => ({
            ...prev,
            push: {
              ...prev.push,
              isEnabled: true,
            },
          }));

          toast({
            title: "Success",
            description: "Web push notifications enabled",
          });
        } else {
          // Get more details about why it failed
          const details = await FirebasePushService.checkNotificationPermissionDetails();
          
          let errorMessage = "Push notification permission was denied";
          if (details.isBlocked) {
            errorMessage = "Notifications are blocked. Please allow in browser settings.";
          } else if (!details.supported) {
            errorMessage = "This browser does not support push notifications.";
          } else if (details.inIframe) {
            errorMessage = "Open the app in a new tab to enable notifications.";
          }
          
          toast({
            title: "Cannot Enable",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable push notifications",
        variant: "destructive",
      });
    }
  };

  return {
    channels,
    loading,
    enablePushNotifications,
    refreshChannels: initializeChannels,
  };
};