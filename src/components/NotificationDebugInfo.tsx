import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { FirebasePushService } from '@/services/FirebasePushService';
import { supabase } from '@/integrations/supabase/client';

interface DebugInfo {
  browserSupport: boolean;
  permission: string;
  oneSignalLoaded: boolean;
  oneSignalInitialized: boolean;
  isSubscribed: boolean;
  appIdConfigured: boolean;
  userAuthenticated: boolean;
  tokensInDatabase: number;
}

const NotificationDebugInfo = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const checkDebugInfo = async () => {
    setLoading(true);
    try {
      const info: DebugInfo = {
        browserSupport: 'Notification' in window,
        permission: await FirebasePushService.checkPermissionStatus(),
        oneSignalLoaded: typeof (window as any).OneSignal !== 'undefined',
        oneSignalInitialized: false,
        isSubscribed: false,
        appIdConfigured: false,
        userAuthenticated: false,
        tokensInDatabase: 0
      };

      // Check OneSignal initialization
      try {
        await FirebasePushService.initialize();
        info.oneSignalInitialized = true;
        info.isSubscribed = await FirebasePushService.isSubscribed();
      } catch (e) {
        console.warn('OneSignal check failed:', e);
      }

      // Check App ID configuration
      try {
        const { data: appIdResponse } = await supabase.functions.invoke('email-api', {
          body: { action: 'get_app_id' }
        });
        info.appIdConfigured = !!(appIdResponse?.app_id && appIdResponse.app_id !== 'YOUR_ONESIGNAL_APP_ID');
      } catch (e) {
        console.warn('App ID check failed:', e);
      }

      // Check user authentication and tokens
      try {
        const { data: { user } } = await supabase.auth.getUser();
        info.userAuthenticated = !!user;
        
        if (user) {
          const { data: tokens } = await supabase
            .from('user_notification_tokens')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true);
          info.tokensInDatabase = tokens?.length || 0;
        }
      } catch (e) {
        console.warn('Auth check failed:', e);
      }

      setDebugInfo(info);
    } catch (error) {
      console.error('Debug info check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDebugInfo();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getPermissionBadge = (permission: string) => {
    const variants = {
      granted: 'bg-green-100 text-green-800',
      denied: 'bg-red-100 text-red-800',
      default: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <Badge className={variants[permission as keyof typeof variants] || variants.default}>
        {permission}
      </Badge>
    );
  };

  if (!debugInfo) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <CardTitle className="text-lg">Checking Notification Status...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Notification Debug Info</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkDebugInfo}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Browser Support:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.browserSupport)}
            <span className="text-sm">{debugInfo.browserSupport ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Permission Status:</span>
          {getPermissionBadge(debugInfo.permission)}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">OneSignal SDK Loaded:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.oneSignalLoaded)}
            <span className="text-sm">{debugInfo.oneSignalLoaded ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">OneSignal Initialized:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.oneSignalInitialized)}
            <span className="text-sm">{debugInfo.oneSignalInitialized ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">App ID Configured:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.appIdConfigured)}
            <span className="text-sm">{debugInfo.appIdConfigured ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">User Authenticated:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.userAuthenticated)}
            <span className="text-sm">{debugInfo.userAuthenticated ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Is Subscribed:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(debugInfo.isSubscribed)}
            <span className="text-sm">{debugInfo.isSubscribed ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Tokens in Database:</span>
          <Badge variant="outline">{debugInfo.tokensInDatabase}</Badge>
        </div>

        {(!debugInfo.browserSupport || debugInfo.permission === 'denied' || !debugInfo.appIdConfigured) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Issues detected:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {!debugInfo.browserSupport && (
                  <li>Browser doesn't support notifications</li>
                )}
                {debugInfo.permission === 'denied' && (
                  <li>Notifications are blocked by user</li>
                )}
                {!debugInfo.appIdConfigured && (
                  <li>OneSignal App ID not configured properly</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationDebugInfo;