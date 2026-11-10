import { useState, useEffect } from 'react';

interface CachedLocation {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'user_location_cache';

export const useLocationCache = () => {
  const [cachedLocation, setCachedLocation] = useState<CachedLocation | null>(null);

  // Load cached location from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedLocation = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid (within 24 hours)
        if (now - parsed.timestamp < CACHE_DURATION) {
          console.log('✅ Using cached location (valid for', Math.round((CACHE_DURATION - (now - parsed.timestamp)) / 3600000), 'more hours)');
          setCachedLocation(parsed);
        } else {
          console.log('⏰ Location cache expired, will fetch new location');
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached location:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Save location to cache
  const saveToCache = (location: Omit<CachedLocation, 'timestamp'>) => {
    try {
      const cacheData: CachedLocation = {
        ...location,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setCachedLocation(cacheData);
      console.log('💾 Location cached successfully');
    } catch (error) {
      console.warn('Failed to cache location:', error);
    }
  };

  // Clear cache manually
  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setCachedLocation(null);
    console.log('🗑️ Location cache cleared');
  };

  return {
    cachedLocation,
    saveToCache,
    clearCache,
    isCacheValid: cachedLocation !== null
  };
};
