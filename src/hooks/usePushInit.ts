import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { FirebasePushService } from '@/services/FirebasePushService';

export const usePushInit = (testMode = false, enabled = true) => {
  const { user } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    const initializeOneSignal = async () => {
      if (!enabled) {
        setIsInitialized(false);
        setHasPermission(false);
        return;
      }

      // First check if OneSignal can work on this domain
      const canEnableCheck = FirebasePushService.canEnableNotifications();
      if (!canEnableCheck.canEnable) {
        console.log('🔔 OneSignal not supported on this domain:', canEnableCheck.reason);
        setIsInitialized(false);
        setHasPermission(false);
        return;
      }
      
      // Check if any user is authenticated (jobseeker or employer)
      const isAuthenticated = Boolean(user || employerUser);
      
      // Allow initialization for both authenticated users and guest users
      // Skip only for test mode false and no user
      if (!isAuthenticated && !testMode) {
        console.log('🔔 Guest user detected, initializing OneSignal for guest');
        // Initialize for guest users too, but without saving tokens
        try {
          await FirebasePushService.initialize(true); // Use guest mode
          setIsInitialized(true);
          
          const permissionStatus = await FirebasePushService.checkPermissionStatus();
          setHasPermission(permissionStatus === 'granted');
        } catch (error) {
          console.log('Guest OneSignal initialization failed:', error);
          setIsInitialized(false);
          setHasPermission(false);
        }
        return;
      }

      const authenticatedUserId = user?.id || employerUser?.id;
      
      if (testMode) {
        console.log('🔔 Test mode enabled - initializing OneSignal');
      } else {
        console.log('🔔 Authenticated user detected:', {
          jobSeekerUser: !!user,
          employerUser: !!employerUser,
          userId: authenticatedUserId
        });
      }

      try {
        console.log('🔔 Initializing OneSignal...', testMode ? '(Test Mode)' : '(Authenticated)');
        
        // Initialize OneSignal - allow for both authenticated and guest users in production
        await FirebasePushService.initialize(testMode || !isAuthenticated);
        setIsInitialized(true);
        
        // Check current permission status
        const permissionStatus = await FirebasePushService.checkPermissionStatus();
        console.log('🔔 Notification permission status:', permissionStatus);
        setHasPermission(permissionStatus === 'granted');
        
        // If permission is granted and user is authenticated, ensure token is saved
        if (permissionStatus === 'granted' && isAuthenticated && !testMode) {
          const isSubscribed = await FirebasePushService.isSubscribed();
          if (isSubscribed) {
            console.log('✅ OneSignal already subscribed');
          } else {
            console.log('🔄 Attempting to resubscribe...');
            const success = await FirebasePushService.requestPermissionAndSaveToken(testMode);
            console.log('OneSignal resubscription:', success ? 'Success' : 'Failed');
          }
        }
        
      } catch (error) {
        console.error('❌ OneSignal initialization failed:', error);
        setIsInitialized(false);
        setHasPermission(false);
      }
    };

    // Initialize immediately for test mode, small delay for normal mode
    const timeoutId = setTimeout(initializeOneSignal, testMode ? 0 : 500);

    return () => clearTimeout(timeoutId);
  }, [user?.id, employerUser?.id, testMode, enabled]); // Changed to depend on user IDs for better reactivity

    return {
      isInitialized,
      hasPermission,
      requestPermission: () => FirebasePushService.requestPermissionAndSaveToken(testMode)
    };
};