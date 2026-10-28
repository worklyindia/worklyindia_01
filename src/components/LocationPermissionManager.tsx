import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, X, AlertCircle } from 'lucide-react';
import { useLocationDetection } from '@/hooks/useLocationDetection';
import { useAuth } from '@/contexts/AuthContext';

const LOCATION_PERMISSION_KEY = 'wfh-location-permission';
const SESSION_PROMPT_DISMISSED_KEY = 'wfh-location-session-dismissed';
const AUTO_IP_DETECTION_KEY = 'wfh-auto-ip-detection';

const LocationPermissionManager = () => {
  const { user, loading } = useAuth();
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hasScheduledRef = useRef(false);
  
  // Memoize the callback to prevent recreation on every render
  const handleLocationDetected = useCallback((location: {
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    fullAddress?: string;
    ip?: string;
    postcode?: string;
  }) => {
    // Dispatch custom event for LocationChip
    const event = new CustomEvent('location-detected', { detail: location });
    window.dispatchEvent(event);
    
    // Store recent location in session storage
    sessionStorage.setItem('recent-location', JSON.stringify(location));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Location detected:', location);
    }
  }, []);

  const { state, detectExactLocation, fullAddress, error, hasIPFallback, initializeLocationDetection } = useLocationDetection({
    onLocationDetected: handleLocationDetected
  });

  useEffect(() => {
    // Clear any existing timer whenever dependencies change
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    const checkLocationPermission = async () => {
      // Only proceed if user is authenticated and not loading
      if (!user || loading) {
        console.log('⏸️ User not authenticated, skipping location permission check');
        setShowPrompt(false);
        setHasCheckedPermission(false);
        hasScheduledRef.current = false;
        return;
      }

      const savedPermission = localStorage.getItem(LOCATION_PERMISSION_KEY);
      const sessionDismissed = sessionStorage.getItem(SESSION_PROMPT_DISMISSED_KEY) === 'true';
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Checking location state (after login):', { savedPermission, sessionDismissed });
      }

      // Check browser geolocation permission if available (do not auto-detect)
      let browserPermissionState = 'unknown';
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          browserPermissionState = permission.state as string;
          console.log('🔐 Browser permission state:', browserPermissionState);
        } catch (err) {
          console.log('⚠️ Could not check browser permissions');
        }
      }
      
      // Do not auto-detect in any case
      if (savedPermission === 'denied' || sessionDismissed) {
        setShowPrompt(false);
        setHasCheckedPermission(true);
        return;
      }

      if (savedPermission === 'granted') {
        // Permission previously granted; keep prompt hidden until user manually triggers
        setShowPrompt(false);
        setHasCheckedPermission(true);
        return;
      }

      // Schedule prompt after 60 seconds of being logged in (once per session)
      if (!hasScheduledRef.current) {
        hasScheduledRef.current = true;
        showTimerRef.current = window.setTimeout(() => {
          console.log('⏱️ Showing location prompt after 60s of login');
          setShowPrompt(true);
          setHasCheckedPermission(true);
        }, 60_000);
      } else {
        setHasCheckedPermission(true);
      }
    };

    checkLocationPermission();

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
  }, [user, loading]);

  // Listen for refresh location events
  useEffect(() => {
    const handleRefreshLocation = async () => {
      console.log('🔄 Refreshing location...');
      
      // Clear old location data
      sessionStorage.removeItem('recent-location');
      sessionStorage.removeItem(SESSION_PROMPT_DISMISSED_KEY);
      
      // Check current browser permission state
      let browserPermissionState = 'unknown';
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          browserPermissionState = permission.state;
        } catch (err) {
          console.log('⚠️ Could not check browser permissions during refresh');
        }
      }
      
      const savedPermission = localStorage.getItem(LOCATION_PERMISSION_KEY);
      
      // Determine refresh strategy based on current permissions
      if (savedPermission === 'granted' || browserPermissionState === 'granted') {
        // User has permission - directly detect exact location
        console.log('✅ Refreshing with precise location detection');
        detectExactLocation();
      } else if (savedPermission === 'denied' || browserPermissionState === 'denied') {
        // User denied - show prompt again for refresh
        console.log('❌ Permission denied, showing prompt for manual trigger');
        setShowPrompt(true);
      } else {
        // Show prompt for unclear permission state - manual trigger only
        console.log('❓ Showing permission prompt during refresh');
        setShowPrompt(true);
      }
    };

    window.addEventListener('refresh-location', handleRefreshLocation);
    return () => window.removeEventListener('refresh-location', handleRefreshLocation);
  }, [detectExactLocation]);

  useEffect(() => {
    // Auto-hide prompt after successful location detection or IP fallback
    if (state === 'success' && (fullAddress || hasIPFallback)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Location detected successfully, hiding prompt');
      }
      setShowPrompt(false);
      if (fullAddress) {
        localStorage.setItem(LOCATION_PERMISSION_KEY, 'granted');
      }
    }
  }, [state, fullAddress, hasIPFallback]);

  const handleAllowLocation = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('👤 User allowed location access');
    }
    setShowPrompt(false);
    sessionStorage.removeItem(SESSION_PROMPT_DISMISSED_KEY);
    detectExactLocation();
  }, [detectExactLocation]);

  const handleSkipForNow = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('👤 User skipped location for this session');
    }
    setShowPrompt(false);
    sessionStorage.setItem(SESSION_PROMPT_DISMISSED_KEY, 'true');
    // Don't set permanent denial - just skip for this session
  }, []);

  const handlePermanentDeny = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('👤 User permanently denied location access');
    }
    setShowPrompt(false);
    localStorage.setItem(LOCATION_PERMISSION_KEY, 'denied');
    sessionStorage.setItem(SESSION_PROMPT_DISMISSED_KEY, 'true');
  }, []);

  // CRITICAL: Never render if user is not authenticated or still loading auth state
  // This is the primary safeguard against showing prompt before login
  if (!user || loading) {
    return null;
  }

  // Don't render if we haven't checked permission, shouldn't show prompt, or have successful fallback
  if (!hasCheckedPermission || !showPrompt || (state === 'success' && (fullAddress || hasIPFallback))) {
    return null;
  }

  const isDetecting = state.includes('detecting');
  const shouldShowError = error && state === 'error' && !hasIPFallback;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-semibold">Enable Location Services</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            We'd like to show you jobs near your location to provide better recommendations
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {shouldShowError && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          )}
          
          <Button 
            onClick={handleAllowLocation}
            className="w-full"
            disabled={isDetecting}
          >
            <MapPin className="w-4 h-4 mr-2" />
            {isDetecting ? 'Getting Location...' : 'Allow Location'}
          </Button>
          
          <Button 
            onClick={handleSkipForNow}
            variant="outline"
            className="w-full"
          >
            <X className="w-4 h-4 mr-2" />
            Skip for Now
          </Button>
          
          <Button 
            onClick={handlePermanentDeny}
            variant="ghost" 
            className="w-full text-xs"
          >
            Don't ask again
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Your location data is only used to show relevant job opportunities and is not stored permanently.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationPermissionManager;
