import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, Settings, ArrowLeft } from 'lucide-react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface BlockingNotificationPermissionProps {
  onPermissionGranted: () => void;
  title?: string;
  description?: string;
  dashboardRoute?: string; // Route to navigate when clicking buttons
  notificationBenefits?: string[]; // Custom notification benefits list
}

export const BlockingNotificationPermission: React.FC<BlockingNotificationPermissionProps> = ({ 
  onPermissionGranted,
  title = "Enable Notifications",
  description = "To view and manage your notifications, please enable push notifications first.",
  dashboardRoute = "/",
  notificationBenefits = [
    "New job matches and opportunities",
    "Application status updates",
    "Interview schedule notifications",
    "Important job alerts"
  ]
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        const status = await FirebasePushService.checkPermissionStatus();
        setPermissionStatus(status);
        
        // If already granted, immediately call the callback
        if (status === 'granted') {
          onPermissionGranted();
        }
      } catch (error) {
        console.error('Error checking permission status:', error);
        setPermissionStatus('default');
      } finally {
        setIsCheckingPermission(false);
      }
    };

    checkPermissionStatus();
  }, [onPermissionGranted]);

  // Watchdog to avoid getting stuck on "Enabling..."
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(async () => {
      try {
        console.warn('Notification permission prompt timed out. Unblocking UI.');
        setIsLoading(false);
        const status = await FirebasePushService.checkPermissionStatus();
        setPermissionStatus(status);
      } catch (_) {
        setIsLoading(false);
      }
    }, 10000);
    return () => clearTimeout(t);
  }, [isLoading]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      console.log('🔔 Starting notification permission request...');

      // Ask immediately from this click. Delays or other awaited work make
      // mobile Chrome discard the user gesture and suppress its native prompt.
      const initialStatus = await FirebasePushService.ensurePermission();
      console.log('Initial permission status:', initialStatus);
      
      if (initialStatus === 'granted') {
        console.log('✅ Permission already granted, unblocking page');
        setPermissionStatus('granted');
        toast.success('Notifications are enabled!');
        onPermissionGranted();
        return;
      }
      
      if (initialStatus === 'denied') {
        console.log('❌ Permission was already denied by user');
        setPermissionStatus('denied');
        toast.error('Notifications are blocked. Please enable them in your browser settings.');
        return;
      }
      
      toast.info('Please allow notifications when your browser asks...');
      const success = await FirebasePushService.showNotificationPrompt();
      
      // Check final permission status
      const finalStatus = await FirebasePushService.checkPermissionStatus();
      console.log('Final permission status:', finalStatus);
      
      if (finalStatus === 'granted' || success) {
        console.log('✅ Permission granted successfully');
        setPermissionStatus('granted');
        toast.success('Notifications enabled successfully!');
        onPermissionGranted();
      } else if (finalStatus === 'denied') {
        console.log('❌ Permission denied by user');
        setPermissionStatus('denied');
        toast.error('Notifications blocked. You can enable them later in browser settings.');
      } else {
        console.log('⚠️ Permission request had no clear result');
        toast.warning('Permission request unclear. Please try again or check browser settings.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      
      // Check final status even after error
      try {
        const statusAfterError = await FirebasePushService.checkPermissionStatus();
        if (statusAfterError === 'granted') {
          console.log('✅ Permission was actually granted despite error');
          setPermissionStatus('granted');
          toast.success('Notifications enabled!');
          onPermissionGranted();
          return;
        }
      } catch (statusError) {
        console.error('Error checking status after failure:', statusError);
      }
      
      toast.error('Failed to enable notifications. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(dashboardRoute);
  };

  if (isCheckingPermission) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If permission is already granted, don't show this blocking screen
  if (permissionStatus === 'granted') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {permissionStatus === 'denied' ? (
                <BellOff className="w-8 h-8 text-orange-600" />
              ) : (
                <Bell className="w-8 h-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-xl font-bold">
              {permissionStatus === 'denied' ? 'Notifications Blocked' : title}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {permissionStatus === 'denied' 
                ? 'Notifications are currently blocked in your browser. To receive important updates about job applications and interviews, please enable notifications in your browser settings.'
                : description
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permissionStatus === 'denied' ? (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Settings className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium mb-1">How to enable notifications:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Click the settings/lock icon in your browser's address bar</li>
                        <li>Find "Notifications" and set it to "Allow"</li>
                        <li>Refresh this page and try again</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="w-full"
                  variant="outline"
                >
                  I've Enabled Notifications - Refresh Page
                </Button>
              </>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">You'll receive notifications for:</p>
                    <ul className="space-y-1 text-xs">
                      {notificationBenefits.map((benefit, index) => (
                        <li key={index}>• {benefit}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Button 
                  onClick={handleEnableNotifications}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(dashboardRoute)}
                  disabled={isLoading}
                  className="w-full mt-2"
                >
                  Continue without Notifications
                </Button>
              </>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};