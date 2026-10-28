import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, AlertTriangle, Smartphone, Chrome, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { FirebasePushService } from '@/services/FirebasePushService';
import { usePushInit } from '@/hooks/usePushInit';
import { toast } from 'sonner';
import { CANONICAL_DOMAIN, CANONICAL_URL } from '@/config/domainConfig';

interface NotificationPermissionProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  compact?: boolean;
  showForBoth?: boolean; // Show for both job seekers and employers
  testMode?: boolean; // Allow enabling without authentication
}

export const UniversalNotificationPermission: React.FC<NotificationPermissionProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  compact = false,
  showForBoth = true,
  testMode = false
}) => {
  const { user: jobSeekerUser } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const { isInitialized, hasPermission, requestPermission } = usePushInit(testMode);
  
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Determine current user (job seeker or employer)
  const currentUser = jobSeekerUser || employerUser;
  const userType = jobSeekerUser ? 'Job Seeker' : employerUser ? 'Employer' : null;

  useEffect(() => {
    checkPermissionStatus();
    getEnvironmentInfo();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const status = await FirebasePushService.checkPermissionStatus();
      setPermissionState(status as 'default' | 'granted' | 'denied');
    } catch (error) {
      console.error('Error checking permission status:', error);
    }
  };

  const getEnvironmentInfo = async () => {
    try {
      const details = await FirebasePushService.checkNotificationPermissionDetails();
      setEnvironmentInfo(details);
    } catch (error) {
      console.error('Error getting environment info:', error);
    }
  };

  const handleRequestPermission = async () => {
    if (!currentUser && !testMode) {
      toast.error('Please login first to enable notifications');
      return;
    }

    setIsRequesting(true);
    
    try {
      const permission = await FirebasePushService.ensurePermission();
      setPermissionState(permission);
      if (permission !== 'granted') {
        setShowInstructions(permission === 'denied');
        if (permission === 'denied') onPermissionDenied?.();
        return;
      }
      const success = await FirebasePushService.requestPermissionAndSaveToken(testMode);
      
      if (success) {
        setPermissionState('granted');
        toast.success('🔔 Notifications enabled successfully!');
        onPermissionGranted?.();
      } else {
        // Token/config failures must not be shown as a browser permission block.
        setPermissionState(await FirebasePushService.checkPermissionStatus());
        toast.error('Could not finish notification setup. Please try again.');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
    } finally {
      setIsRequesting(false);
    }
  };

  const getBrowserIcon = () => {
    if (environmentInfo?.environment?.browserInfo?.isChrome) return Chrome;
    if (environmentInfo?.environment?.browserInfo?.isFirefox) return Globe;
    return Globe;
  };

  const getBrowserInstructions = () => {
    if (!environmentInfo?.recommendations) return [];
    return environmentInfo.recommendations;
  };

  // Don't show if user doesn't want both types and we don't have the right user type (unless test mode)
  if (!showForBoth && !currentUser && !testMode) {
    return null;
  }

  // Don't show if permission is already granted
  if (permissionState === 'granted' && hasPermission) {
    return null;
  }

  const notificationBenefits = currentUser 
    ? jobSeekerUser 
      ? [
          'Get instant alerts for new job matches',
          'Receive application status updates',
          'Stay informed about interview schedules',
          'Get personalized job recommendations'
        ]
      : [
          'Get notified of new job applications',
          'Receive interview scheduling updates',
          'Stay updated on candidate activities',
          'Get real-time hiring notifications'
        ]
    : [
        'Get instant job alerts and updates',
        'Receive application status notifications',
        'Stay informed about new opportunities',
        'Get personalized recommendations'
      ];

  if (compact) {
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <Bell className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-sm">
            Enable notifications for {userType || 'job'} updates
          </span>
          <Button 
            size="sm" 
            onClick={handleRequestPermission}
            disabled={isRequesting || !isInitialized}
            className="ml-2"
          >
            {isRequesting ? 'Enabling...' : 'Enable'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="p-6 border-primary/20 bg-primary/5">
      <div className="flex items-start space-x-4">
        <div className="p-3 bg-primary/10 rounded-full">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-foreground">
              Enable Push Notifications
            </h3>
            {userType && (
              <Badge variant="outline" className="text-xs">
                {userType}
              </Badge>
            )}
            {testMode && (
              <Badge variant="secondary" className="text-xs">
                Test Mode
              </Badge>
            )}
          </div>
          
          <p className="text-muted-foreground mb-4">
            Stay updated with real-time notifications for the most important updates.
          </p>

          {/* Benefits List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {notificationBenefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Environment Info */}
          {environmentInfo && (
            <div className="mb-4 p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(getBrowserIcon(), { className: "w-4 h-4" })}
                <span className="text-sm font-medium">
                  {environmentInfo.environment?.browserInfo?.isChrome ? 'Chrome' : 
                   environmentInfo.environment?.browserInfo?.isFirefox ? 'Firefox' : 'Browser'} 
                   {environmentInfo.environment?.isMobile ? ' Mobile' : ' Desktop'}
                </span>
                <Badge 
                  variant={environmentInfo.environment?.isSecure ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {environmentInfo.environment?.isSecure ? 'Secure' : 'Insecure'}
                </Badge>
              </div>
              
              {environmentInfo.environment?.isDevelopment && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <div className="space-y-1">
                      <p>Development environment detected.</p>
                      <p className="text-muted-foreground">
                        OneSignal may be restricted to production domain. 
                        If notifications fail, test on: 
                        <a 
                          href={CANONICAL_URL}
                          className="underline text-primary ml-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {CANONICAL_DOMAIN}
                        </a>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleRequestPermission}
              disabled={isRequesting || !isInitialized}
              className="flex-1"
            >
              {isRequesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  Enable Notifications
                </>
              )}
            </Button>
            
            {permissionState === 'denied' && (
              <Button 
                variant="outline" 
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Show Instructions
              </Button>
            )}
          </div>

          {/* Manual Instructions */}
          {showInstructions && permissionState === 'denied' && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-sm">
                    Notifications are blocked. To enable them:
                  </p>
                  <ul className="text-xs space-y-1 ml-4">
                    {getBrowserInstructions().map((instruction, index) => (
                      <li key={index} className="list-disc">
                        {instruction}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    After changing settings, refresh this page and try again.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Status Indicator */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <div className={`w-2 h-2 rounded-full ${
              permissionState === 'granted' ? 'bg-green-500' :
              permissionState === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <span className="text-xs text-muted-foreground">
              Status: {
                permissionState === 'granted' ? 'Notifications enabled' :
                permissionState === 'denied' ? 'Notifications blocked' : 
                'Notifications not enabled'
              }
            </span>
            {!isInitialized && (
              <Badge variant="outline" className="text-xs">
                Initializing...
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};