import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CANONICAL_URL } from '@/config/domainConfig';
import { NotificationUnblockGuide } from '@/components/NotificationUnblockGuide';

interface PushNotificationPreferences {
  job_applications: boolean;
  interview_reminders: boolean;
  job_alerts: boolean;
  system_notifications: boolean;
}

export const PushNotificationSettings: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default'>('default');
  const [preferences, setPreferences] = useState<PushNotificationPreferences>({
    job_applications: true,
    interview_reminders: true,
    job_alerts: true,
    system_notifications: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [domainCheck, setDomainCheck] = useState<{ canEnable: boolean; reason?: string; recommendation?: string } | null>(null);
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    // Warm the push config up front so subscribing after the permission
    // prompt does not wait on a network round trip.
    void FirebasePushService.getConfig();


    // Re-check when the user comes back to the page: the browser may have
    // revoked permission or dropped the token while the page was hidden.
    const recheck = () => {
      if (document.visibilityState === 'visible') loadSettings();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);

    // Track permission changes live, so the card updates the moment the user
    // allows or blocks notifications in browser site settings.
    let permissionStatusRef: PermissionStatus | null = null;
    const onPermissionChange = async () => {
      const state = permissionStatusRef?.state;
      if (state === 'granted') {
        // The user just allowed notifications in browser settings — subscribe
        // straight away so they do not have to tap Subscribe again.
        setShowUnblockGuide(false);
        setPermissionStatus('granted');
        try {
          const success = await FirebasePushService.requestPermissionAndSaveToken();
          if (success) {
            setIsSubscribed(true);
            toast({
              title: 'Notifications on',
              description: 'You will now get instant updates on this device.',
            });
          }
        } catch (error) {
          console.error('Auto-subscribe after allow failed:', error);
        }
      }
      loadSettings();
    };
    if (!FirebasePushService.isNativeAndroidApp() && typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permissionStatusRef = status;
          status.addEventListener('change', onPermissionChange);
          setPermissionStatus(status.state === 'prompt' ? 'default' : status.state);
        })
        .catch(() => {/* permissions API unavailable — fall back to polling on focus */});
    }


    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
      permissionStatusRef?.removeEventListener('change', onPermissionChange);
    };
  }, []);

  const loadSettings = async () => {
    // Helper to wrap promises with timeout to prevent UI hang
    const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
          console.warn(`⏱️ Operation timed out after ${timeoutMs}ms`);
          resolve(fallbackValue);
        }, timeoutMs))
      ]);
    };

    try {
      setIsLoading(true);
      
      // Check if OneSignal can work on this domain (sync check, no timeout needed)
      const canEnableCheck = FirebasePushService.canEnableNotifications();
      setDomainCheck(canEnableCheck);
      
      if (!canEnableCheck.canEnable) {
        console.log('🔔 Push notifications are not available here:', canEnableCheck.reason);
        setIsLoading(false);
        return;
      }
      
      // Check OneSignal status with timeout to prevent "Setting up..." hang
      // 5 second timeout - if OneSignal doesn't respond, show as not configured
      const [permission, subscribed] = await Promise.all([
        withTimeout(FirebasePushService.checkPermissionStatus(), 5000, 'default' as const),
        withTimeout(FirebasePushService.isSubscribed(), 5000, false)
      ]);
      
      setPermissionStatus(permission);
      setIsSubscribed(subscribed);

      // Load user preferences
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (userId) {
          // Scope to the signed-in user and tolerate "no row yet": an
          // unscoped .single() errors out whenever the row count is not 1.
          const { data: userPrefs } = await supabase
            .from('push_notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (userPrefs) {
            setPreferences({
              job_applications: userPrefs.job_applications,
              interview_reminders: userPrefs.interview_reminders,
              job_alerts: userPrefs.job_alerts,
              system_notifications: userPrefs.system_notifications,
            });
          }
        }
      } catch (prefError) {
        console.warn('Could not load preferences, using defaults');
      }
    } catch (error) {
      console.error('Error loading push notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /** Re-reads browser permission after the user changes it in site settings. */
  const handleRecheckPermission = async () => {
    setIsLoading(true);
    try {
      const permission = await FirebasePushService.checkPermissionStatus();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        setShowUnblockGuide(false);
        const success = await FirebasePushService.requestPermissionAndSaveToken();
        setIsSubscribed(success);
        toast({
          title: success ? 'Notifications on' : 'Almost there',
          description: success
            ? 'You will now get instant updates on this device.'
            : 'Permission is allowed. Please tap Subscribe once more.',
          variant: success ? 'default' : 'destructive',
        });
        loadSettings();
      } else {
        toast({
          title: 'Still blocked',
          description: 'Notifications are still blocked. Please follow the steps and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error re-checking notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    // Re-check domain support
    const canEnableCheck = FirebasePushService.canEnableNotifications();
    if (!canEnableCheck.canEnable) {
      toast({
        title: "Cannot Enable",
        description: canEnableCheck.reason || "Push notifications not available",
        variant: "destructive",
      });
      return;
    }

    // Ask for permission FIRST, straight out of the click: any network call
    // before this loses the user gesture and Chrome silently blocks the prompt.
    const isNativeAndroid = FirebasePushService.isNativeAndroidApp();
    // Android WebView has no browser Notification API. Let the native bridge
    // request POST_NOTIFICATIONS after this Subscribe tap instead.
    const permission = isNativeAndroid ? 'granted' : await FirebasePushService.ensurePermission();
    setPermissionStatus(permission);
    if (!isNativeAndroid && permission !== 'granted') {
      if (permission === 'denied') {
        // Show the step-by-step unblock guide instead of a disappearing toast.
        setShowUnblockGuide(true);
      } else {
        toast({
          title: "Permission needed",
          description: "Please tap Allow on the notification prompt to subscribe.",
          variant: "destructive",
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      const success = await FirebasePushService.requestPermissionAndSaveToken();
      
      if (success) {
        // Immediately update state for instant UI feedback - no page refresh needed
        setIsSubscribed(true);
        setPermissionStatus('granted');
        
        toast({
          title: "Success",
          description: "Push notifications enabled successfully!",
        });
        
        // Background sync (non-blocking) for any other data
        loadSettings();
      } else {
        // Get detailed error info
        const [details, configured] = await Promise.all([
          FirebasePushService.checkNotificationPermissionDetails(),
          FirebasePushService.isConfigured(),
        ]);

        let errorMessage = "Failed to enable push notifications. Please try again.";

        if (!isNativeAndroid && !configured) {
          errorMessage = "Push notifications are not configured yet. They will work once the Firebase keys are set.";
        } else if (details.isBlocked) {
          errorMessage = isNativeAndroid
            ? "Notifications are disabled in Android settings. Please allow notifications for Workly India."
            : "Notifications are blocked by your browser. Please check site permissions.";
        } else if (!details.supported) {
          errorMessage = isNativeAndroid
            ? "Native Android notification support is unavailable. Please update the Workly India app."
            : "This browser does not support push notifications";
        } else if (details.inIframe) {
          errorMessage = "Open the app in a new tab to enable notifications";
        } else if (isNativeAndroid) {
          errorMessage = "Android could not register this device with Firebase. Please check the app's Firebase configuration and try again.";
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error enabling push notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const success = await FirebasePushService.unsubscribe();
      if (success) {
        setIsSubscribed(false);
        toast({
          title: "Unsubscribed",
          description: "You will no longer receive push notifications",
        });
        loadSettings();
      } else {
        toast({
          title: "Error",
          description: "Failed to unsubscribe. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: "Error",
        description: "Failed to unsubscribe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof PushNotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('push_notification_preferences')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          ...newPrefs,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences updated",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
      // Revert the change
      setPreferences(preferences);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusIcon = () => {
    if (domainCheck && !domainCheck.canEnable) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    if (permissionStatus === 'granted' && isSubscribed) {
      return <Check className="h-5 w-5 text-green-500" />;
    } else if (permissionStatus === 'denied') {
      return <X className="h-5 w-5 text-red-500" />;
    } else {
      return <Bell className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusText = () => {
    if (domainCheck && !domainCheck.canEnable) {
      return domainCheck.reason || 'Push notifications not available';
    }
    if (permissionStatus === 'granted' && isSubscribed) {
      return 'Push notifications are enabled';
    } else if (permissionStatus === 'denied') {
      return FirebasePushService.isNativeAndroidApp()
        ? 'Notifications are blocked in Android app settings'
        : 'Push notifications are blocked in your browser';
    } else {
      return 'Push notifications are turned off';
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Push Notifications
        </CardTitle>
        <CardDescription>
          {getStatusText()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain Restriction Warning */}
        {domainCheck && !domainCheck.canEnable && (
          <Alert variant="default" className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-foreground">
              {domainCheck.reason?.includes('preview') ? 'Open in a new tab' : 'Notifications unavailable'}
            </AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {domainCheck.reason}
              {domainCheck.recommendation && (
                <div className="mt-2">
                  <strong>Solution:</strong> {domainCheck.recommendation}
                </div>
              )}
              {domainCheck.reason?.includes('preview') && (
                <Button asChild size="sm" className="mt-3 w-full">
                  <a href={typeof window !== 'undefined' ? window.location.href : `${CANONICAL_URL}/settings`} target="_blank" rel="noopener noreferrer">
                    Open app and subscribe <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Enable/Disable Section */}
        {domainCheck?.canEnable && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get instant notifications on your mobile device for important updates like job applications, interview schedules, and payment confirmations.
            </p>
            
            {isSubscribed ? (
              <Button
                onClick={handleUnsubscribe}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                <BellOff className="h-4 w-4 mr-2" />
                {isLoading ? 'Removing...' : 'Unsubscribe'}
              </Button>
            ) : (
              <Button
                onClick={handleEnableNotifications}
                disabled={isLoading || !domainCheck?.canEnable}
                className="w-full"
              >
                <Bell className="h-4 w-4 mr-2" />
                {isLoading ? 'Setting up...' : 'Subscribe'}
              </Button>
            )}


            
          </div>
        )}


        {/* Player ID Display - Show when notifications are enabled */}
        {domainCheck?.canEnable && permissionStatus === 'granted' && isSubscribed && (
          <div className="pt-4 border-t">
          </div>
        )}
      </CardContent>

      <NotificationUnblockGuide
        open={showUnblockGuide}
        onOpenChange={setShowUnblockGuide}
        onRecheck={handleRecheckPermission}
        isChecking={isLoading}
      />
    </Card>
  );
};