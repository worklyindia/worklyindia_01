import { useState, useCallback, useRef, useEffect } from 'react';
import { LocationData, GeoLocation, FullAddress, fetchIPLocation, reverseGeocode, getGeolocation, checkGeolocationSupport } from '@/utils/locationUtils';

export type LocationState = 'idle' | 'detecting-ip' | 'detecting-geo' | 'success' | 'error';

interface UseLocationDetectionProps {
  onLocationDetected: (location: {
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    source?: 'gps' | 'ip' | 'browser-geo';
    fullAddress?: string;
    ip?: string;
    postcode?: string;
  }) => void;
}

export const useLocationDetection = ({ onLocationDetected }: UseLocationDetectionProps) => {
  const [ipLocation, setIpLocation] = useState<LocationData | null>(null);
  const [geoLocation, setGeoLocation] = useState<GeoLocation | null>(null);
  const [fullAddress, setFullAddress] = useState<FullAddress | null>(null);
  const [error, setError] = useState<string>('');
  const [state, setState] = useState<LocationState>('idle');
  const [permissionState, setPermissionState] = useState<string>('');
  const [hasAutoDetected, setHasAutoDetected] = useState(false);
  const [hasIPFallback, setHasIPFallback] = useState(false);
  
  // Refs for cleanup and concurrency control
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onLocationDetectedRef = useRef(onLocationDetected);
  const isDetectingRef = useRef(false);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Keep the callback ref updated
  useEffect(() => {
    onLocationDetectedRef.current = onLocationDetected;
  }, [onLocationDetected]);

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up location detection...');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isDetectingRef.current = false;
  }, []);

  const detectIPLocation = useCallback(async () => {
    if (isDetectingRef.current) {
      console.log('⏳ IP detection already in progress, skipping...');
      return;
    }

    console.log('🌍 Starting IP location detection...');
    cleanup();
    isDetectingRef.current = true;
    setState('detecting-ip');
    setError('');
    
    try {
      abortControllerRef.current = new AbortController();
      const locationData = await fetchIPLocation(abortControllerRef.current.signal);
      
      if (abortControllerRef.current?.signal.aborted) return;
      
      setIpLocation(locationData);
      
      // Auto-fill with IP location initially
      console.log('✅ Auto-filling location with IP data:', locationData);
      onLocationDetectedRef.current({
        city: locationData.city,
        state: locationData.region,
        country: locationData.country,
        ip: locationData.ip
      });
      
      setState('success');
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🚫 IP detection aborted');
        return;
      }
      console.error('❌ IP location error:', err);
      setError('Unable to detect location from IP');
      setState('error');
    } finally {
      isDetectingRef.current = false;
    }
  }, [cleanup]);

  const handleGeoLocationFallback = useCallback(async () => {
    console.log('🔄 Attempting IP location fallback...');
    setHasIPFallback(true);
    
    try {
      if (ipLocation) {
        console.log('✅ Using cached IP location:', ipLocation);
        onLocationDetectedRef.current({
          city: ipLocation.city,
          state: ipLocation.region,
          country: ipLocation.country,
          ip: ipLocation.ip
        });
        setState('success');
        return;
      }

      // Fetch fresh IP location
      setState('detecting-ip');
      abortControllerRef.current = new AbortController();
      const locationData = await fetchIPLocation(abortControllerRef.current.signal);
      
      if (abortControllerRef.current?.signal.aborted) return;
      
      setIpLocation(locationData);
      console.log('✅ Fallback to IP location successful:', locationData);
      
        onLocationDetectedRef.current({
          city: locationData.city,
          state: locationData.region,
          country: locationData.country,
          ip: locationData.ip
        });
      
      setState('success');
    } catch (err) {
      console.error('❌ IP location fallback also failed:', err);
      setError('Unable to detect your location. You can still browse all jobs.');
      setState('error');
    }
  }, [ipLocation]);

  const detectExactLocation = useCallback(async () => {
    if (isDetectingRef.current) {
      console.log('⏳ Exact location detection already in progress, skipping...');
      return;
    }

    console.log('🎯 Starting exact location detection...');
    cleanup();
    isDetectingRef.current = true;
    setState('detecting-geo');
    setError('');

    const geoCheck = checkGeolocationSupport();
    if (!geoCheck.supported) {
      console.log('❌ Geolocation not supported, falling back to IP location...');
      await handleGeoLocationFallback();
      isDetectingRef.current = false;
      return;
    }

    try {
      abortControllerRef.current = new AbortController();
      
      // Check permissions if available
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          console.log('🔐 Geolocation permission state:', permission.state);
          setPermissionState(permission.state);
          
          if (permission.state === 'denied') {
            console.log('❌ Permission denied, falling back to IP location...');
            await handleGeoLocationFallback();
            return;
          }
        } catch (permErr) {
          console.warn('❌ Error checking permissions:', permErr);
        }
      }

      const position = await getGeolocation();
      
      if (abortControllerRef.current?.signal.aborted) return;
      
      const isNativeGPS = /WorklyIndiaApp\\/1\\.0/i.test(navigator.userAgent);
      console.log(`📍 Got ${isNativeGPS ? 'GPS' : 'browser'} position:`, position.coords, `accuracy: ${position.coords.accuracy}m`);
      
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      // Check if coordinates are the same as last time (avoid redundant reverse geocoding)
      const lastCoords = lastCoordsRef.current;
      const coordsChanged = !lastCoords || 
        Math.abs(lastCoords.lat - lat) > 0.001 || 
        Math.abs(lastCoords.lng - lng) > 0.001;

      setGeoLocation({ lat, lng });
      lastCoordsRef.current = { lat, lng };

      let addressData: FullAddress;
      
      if (coordsChanged) {
        addressData = await reverseGeocode(lat, lng, abortControllerRef.current.signal);
        
        if (abortControllerRef.current?.signal.aborted) return;
        
        setFullAddress(addressData);
      } else {
        console.log('📍 Using cached address data for same coordinates');
        addressData = fullAddress!;
      }
      
      setHasAutoDetected(true);
      
      // Auto-fill the location field with detailed address including postcode and GPS metadata
      const source = isNativeGPS ? 'gps' : 'browser-geo';
      console.log(`✅ Auto-filling with ${source} location (accuracy: ${accuracy}m):`, addressData);
      onLocationDetectedRef.current({
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy,
        source: source,
        fullAddress: addressData.formattedAddress,
        ip: ipLocation?.ip,
        postcode: addressData.postcode
      });
      
      setState('success');
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('🚫 Exact location detection aborted');
        return;
      }
      console.error('❌ Geolocation error, falling back to IP location:', err);
      await handleGeoLocationFallback();
    } finally {
      isDetectingRef.current = false;
    }
  }, [cleanup, fullAddress, handleGeoLocationFallback, ipLocation?.ip]);

  const initializeLocationDetection = useCallback(async () => {
    if (isDetectingRef.current) {
      return;
    }

    console.log('🚀 Manual location detection with IP fallback...');
    
    // IP location detection - manual trigger only
    await detectIPLocation();
  }, [detectIPLocation]);

  const checkPermissionAndAutoDetect = useCallback(async () => {
    if (isDetectingRef.current) {
      console.log('⏳ Permission check already in progress, skipping...');
      return;
    }

    console.log('🔍 Checking geolocation support and permissions...');
    
    const geoCheck = checkGeolocationSupport();
    if (!geoCheck.supported) {
      console.log('❌ Geolocation not supported:', geoCheck.error);
      setError(geoCheck.error || 'Geolocation not available');
      return;
    }

    // Check if permissions API is available
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('🔐 Geolocation permission state:', permission.state);
        setPermissionState(permission.state);
        
        if (permission.state === 'granted') {
          console.log('✅ Permission already granted, getting location...');
          await detectExactLocation();
        } else if (permission.state === 'prompt') {
          console.log('❓ Permission needs to be requested, auto-requesting...');
          await detectExactLocation();
        } else {
          console.log('❌ Permission denied');
          setError('Location permission denied');
        }
      } catch (err) {
        console.error('❌ Error checking permissions:', err);
        // Fallback to direct geolocation call
        await detectExactLocation();
      }
    } else {
      console.log('ℹ️ Permissions API not available, trying direct geolocation...');
      await detectExactLocation();
    }
  }, [detectExactLocation]);

  return {
    ipLocation,
    geoLocation,
    fullAddress,
    error,
    state,
    permissionState,
    hasAutoDetected,
    hasIPFallback,
    detectIPLocation,
    detectExactLocation,
    checkPermissionAndAutoDetect,
    initializeLocationDetection,
    cleanup
  };
};
