import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, X } from 'lucide-react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';

interface NotificationPermissionPromptProps {
  onDismiss?: () => void;
  autoShow?: boolean;
}

const NOTIFICATION_STORAGE_KEY = 'notification-prompt-dismissed';
const SHOW_AGAIN_AFTER_DAYS = 7; // Show again after 7 days

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  onDismiss,
  autoShow = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const { user } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  
  // Check if any user is authenticated (job seeker or employer)
  const isAuthenticated = user || employerUser;

  useEffect(() => {
    const checkPermissionStatus = async () => {
      if (!isAuthenticated) return;
      
      const status = await FirebasePushService.checkPermissionStatus();
      setPermissionStatus(status);
      
      // Check if user has dismissed the prompt recently
      const dismissedData = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (dismissedData) {
        try {
          const { timestamp } = JSON.parse(dismissedData);
          const daysSinceDismissed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
          
          // Don't show again if dismissed less than SHOW_AGAIN_AFTER_DAYS days ago
          if (daysSinceDismissed < SHOW_AGAIN_AFTER_DAYS) {
            console.log(`⏰ Notification prompt dismissed ${Math.floor(daysSinceDismissed)} days ago, will show again after ${SHOW_AGAIN_AFTER_DAYS} days`);
            return;
          }
        } catch (error) {
          console.error('Error parsing notification dismissal data:', error);
          // Clear invalid data
          localStorage.removeItem(NOTIFICATION_STORAGE_KEY);
        }
      }
      
      // Show prompt if permission is default and autoShow is enabled
      if (status === 'default' && autoShow) {
        // Wait 5 seconds before showing for better UX
        setTimeout(() => setIsVisible(true), 5000);
      }
    };

    checkPermissionStatus();
  }, [isAuthenticated, autoShow]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const permission = await FirebasePushService.ensurePermission();
      setPermissionStatus(permission);
      if (permission !== 'granted') return;
      const success = await FirebasePushService.showNotificationPrompt();
      if (success) {
        setPermissionStatus('granted');
        setIsVisible(false);
        onDismiss?.();
        // Clear dismissal since user enabled notifications
        localStorage.removeItem(NOTIFICATION_STORAGE_KEY);
        console.log('✅ Notifications enabled successfully');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
    // Store dismissal with timestamp in localStorage
    const dismissalData = {
      timestamp: Date.now(),
      dismissed: true
    };
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(dismissalData));
    console.log(`⏰ Notification prompt dismissed, will show again after ${SHOW_AGAIN_AFTER_DAYS} days`);
  };

  if (!isAuthenticated || !isVisible || permissionStatus === 'granted') {
    return null;
  }

  if (permissionStatus === 'denied') {
    return (
      <Card className="fixed bottom-20 right-4 w-80 z-50 border-orange-200 bg-orange-50 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellOff className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-sm text-orange-800">Notifications Blocked</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="text-orange-700 text-xs mb-3">
            Notifications are blocked. Enable them in your browser settings to get updates about jobs and applications.
          </CardDescription>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDismiss}
            className="w-full text-orange-800 border-orange-300 hover:bg-orange-100"
          >
            Got it
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-20 right-4 w-80 z-50 border-blue-200 bg-blue-50 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-sm text-blue-800">Enable Notifications</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-blue-700 text-xs mb-3">
          Get instant updates about new jobs, application status changes, and interview schedules.
        </CardDescription>
        <div className="flex gap-2">
          <Button 
            onClick={handleEnableNotifications}
            disabled={isLoading}
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDismiss}
            className="text-blue-800 border-blue-300 hover:bg-blue-100"
          >
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};