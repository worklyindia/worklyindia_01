import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocationDetection } from '@/hooks/useLocationDetection';

interface UserLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: 'gps' | 'ip' | 'browser-geo' | null;
  city: string | null;
  state: string | null;
  country: string | null;
  fullAddress: string | null;
  postcode: string | null;
  district: string | null;
  road: string | null;
  timestamp: number | null;
}

interface UserLocationContextType {
  location: UserLocation;
  isDetecting: boolean;
  detectLocation: () => void;
}

const UserLocationContext = createContext<UserLocationContextType | undefined>(undefined);

const LOCATION_STORAGE_KEY = 'wfh_user_location';
const LOCATION_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const UserLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<UserLocation>(() => {
    // Load from localStorage on init
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    console.log('🗺️ [UserLocation Init] Checking localStorage:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check if cached location is still valid (within 10 minutes)
        if (parsed.timestamp && Date.now() - parsed.timestamp < LOCATION_CACHE_DURATION) {
          console.log('✅ [UserLocation Init] Using cached location:', parsed);
          return parsed;
        } else {
          console.log('⏰ [UserLocation Init] Cached location expired');
        }
      } catch (e) {
        console.warn('Failed to parse stored location:', e);
      }
    }
    console.log('🆕 [UserLocation Init] No valid cached location, will auto-detect');
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      source: null,
      city: null,
      state: null,
      country: null,
      fullAddress: null,
      postcode: null,
      district: null,
      road: null,
      timestamp: null,
    };
  });

  const handleLocationDetected = useCallback((detectedLocation: {
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    source?: 'gps' | 'ip' | 'browser-geo';
    fullAddress?: string;
    postcode?: string;
    district?: string;
    road?: string;
  }) => {
    const newLocation: UserLocation = {
      latitude: detectedLocation.latitude || null,
      longitude: detectedLocation.longitude || null,
      accuracy: detectedLocation.accuracy || null,
      source: detectedLocation.source || null,
      city: detectedLocation.city,
      state: detectedLocation.state,
      country: detectedLocation.country,
      fullAddress: detectedLocation.fullAddress || null,
      postcode: detectedLocation.postcode || null,
      district: detectedLocation.district || null,
      road: detectedLocation.road || null,
      timestamp: Date.now(),
    };

    setLocation(newLocation);
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
    console.log(`📍 User location updated [${newLocation.source || 'unknown'}] (accuracy: ${newLocation.accuracy}m):`, newLocation);
  }, []);

  const { state, detectExactLocation, initializeLocationDetection } = useLocationDetection({
    onLocationDetected: handleLocationDetected,
  });

  // Auto-detect IP location on first load if no cached location
  useEffect(() => {
    if (!location.timestamp && state === 'idle') {
      console.log('🚀 Auto-detecting IP location on first load...');
      console.log('📍 Current location state:', location);
      console.log('📍 Detection state:', state);
      initializeLocationDetection();
    }
  }, [location.timestamp, state, initializeLocationDetection]);

  const detectLocation = useCallback(() => {
    detectExactLocation();
  }, [detectExactLocation]);

  const isDetecting = state === 'detecting-ip' || state === 'detecting-geo';

  return (
    <UserLocationContext.Provider value={{ location, isDetecting, detectLocation }}>
      {children}
    </UserLocationContext.Provider>
  );
};

export const useUserLocation = () => {
  const context = useContext(UserLocationContext);
  if (context === undefined) {
    throw new Error('useUserLocation must be used within UserLocationProvider');
  }
  return context;
};
