import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocationDetection } from './useLocationDetection';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';

interface LocationData {
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  fullAddress?: string;
  postcode?: string;
  ip?: string;
  location_last_updated?: string;
}

// Helper function to validate and sanitize postal code
const sanitizePostcode = (postcode: any): string => {
  if (!postcode) return '';
  
  // Convert to string and trim
  const postcodeStr = String(postcode).trim();
  
  // Check if it's invalid
  if (postcodeStr === '' || 
      postcodeStr === 'undefined' || 
      postcodeStr === 'null' || 
      postcodeStr === '[object Object]' ||
      postcodeStr.toLowerCase().includes('object')) {
    return '';
  }
  
  return postcodeStr;
};

interface UseSupabaseLocationDetectionProps {
  type: 'profile' | 'company' | 'referral';
  autoSave?: boolean;
  onLocationSaved?: (location: LocationData) => void;
}

export const useSupabaseLocationDetection = ({
  type,
  autoSave = true,
  onLocationSaved
}: UseSupabaseLocationDetectionProps) => {
  const { user } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const [savedLocation, setSavedLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const currentUser = type === 'company' ? employerUser : user;

  // Load saved location from database
  const loadSavedLocation = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      
      if (type === 'profile') {
        const { data, error } = await supabase
          .from('profiles')
          .select('city, state, country, latitude, longitude, precise_address, postal_code, location_last_updated')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data && (data.city || data.state || data.country)) {
          const locationData: LocationData = {
            city: data.city || '',
            state: data.state || '',
            country: data.country || '',
            latitude: data.latitude ? Number(data.latitude) : undefined,
            longitude: data.longitude ? Number(data.longitude) : undefined,
            fullAddress: data.precise_address || '',
            postcode: sanitizePostcode(data.postal_code),
            location_last_updated: data.location_last_updated
          };
          setSavedLocation(locationData);
        }
      } else if (type === 'company') {
        const { data, error } = await supabase
          .from('companies')
          .select('city, state, country, latitude, longitude, precise_address, postal_code, location_last_updated')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          throw error;
        }
        if (data && (data.city || data.state || data.country)) {
          const locationData: LocationData = {
            city: data.city || '',
            state: data.state || '',
            country: data.country || '',
            latitude: data.latitude ? Number(data.latitude) : undefined,
            longitude: data.longitude ? Number(data.longitude) : undefined,
            fullAddress: data.precise_address || '',
            postcode: sanitizePostcode(data.postal_code),
            location_last_updated: data.location_last_updated
          };
          setSavedLocation(locationData);
        }
      } else {
        const { data, error } = await supabase
          .from('referral_profiles')
          .select('city, state, country, precise_address, postal_code')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (error) throw error;
        if (data && (data.city || data.state || data.country)) {
          setSavedLocation({
            city: data.city || '', state: data.state || '', country: data.country || '',
            fullAddress: data.precise_address || '', postcode: sanitizePostcode(data.postal_code),
          });
        }
      }
    } catch (err) {
      console.error('Error loading saved location:', err);
      setError('Failed to load saved location');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, type]);

  // Save location to database
  const saveLocationToDatabase = useCallback(async (locationData: LocationData) => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      setError('');

      // Sanitize and validate postal_code before saving
      const sanitizedPostcode = sanitizePostcode(locationData.postcode);
      
      const updateData = {
        city: locationData.city || '',
        state: locationData.state || '',
        country: locationData.country || '',
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        precise_address: locationData.fullAddress || '',
        postal_code: sanitizedPostcode, // Only save valid postal codes
        location_last_updated: new Date().toISOString()
      };

      console.log('💾 [Supabase Location] Saving to database:', updateData);
      console.log('📮 [Postal Code] Value being saved:', updateData.postal_code || '(EMPTY)');
      console.log('📮 [Postal Code] Valid:', sanitizedPostcode !== '');
      console.log('🗺️ [Full Data] City:', updateData.city, '| State:', updateData.state, '| Country:', updateData.country);

      if (type === 'profile') {
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else if (type === 'company') {
        const { error } = await supabase
          .from('companies')
          .update(updateData)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('referral_profiles').update({
          city: updateData.city, state: updateData.state, country: updateData.country,
          precise_address: updateData.precise_address, postal_code: updateData.postal_code,
        }).eq('user_id', currentUser.id);
        if (error) throw error;
      }

      setSavedLocation(locationData);
      onLocationSaved?.(locationData);
      console.log('✅ Location saved to Supabase:', locationData);
      
    } catch (err) {
      console.error('Error saving location:', err);
      setError('Failed to save location');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, type, onLocationSaved]);

  // Handle location detection with auto-save
  const handleLocationDetected = useCallback(async (location: LocationData) => {
    console.log('🗺️ [Location Detected] Full object:', JSON.stringify(location, null, 2));
    console.log('🏙️ [City]', location.city || '(EMPTY)');
    console.log('🏛️ [State]', location.state || '(EMPTY)');
    console.log('🌍 [Country]', location.country || '(EMPTY)');
    console.log('📮 [Postal Code]', location.postcode || '(EMPTY)', '| Type:', typeof location.postcode);
    console.log('📍 [Full Address]', location.fullAddress || '(EMPTY)');
    
    // Prioritize GPS location (has latitude/longitude) over IP location
    const isGPSLocation = location.latitude !== undefined && location.longitude !== undefined;
    const isIPLocation = !isGPSLocation && location.ip;
    
    // If we already have a GPS location saved, don't override with IP location
    if (isIPLocation && savedLocation?.latitude && savedLocation?.longitude) {
      console.log('🚫 Skipping IP location - GPS location already available');
      return;
    }
    
    // Always update local state immediately
    setSavedLocation(location);
    
    // Call the parent callback immediately for form updates
    onLocationSaved?.(location);
    console.log('📞 [Callback] Called onLocationSaved with postal code:', location.postcode || '(EMPTY)');
    
    if (autoSave) {
      try {
        await saveLocationToDatabase(location);
        console.log(`✅ [Save Success] ${isGPSLocation ? 'GPS' : 'IP'} location saved to database`);
        console.log('✅ [Postal Code] Successfully saved:', location.postcode || '(EMPTY)');
      } catch (err) {
        console.error('❌ [Save Error] Auto-save failed:', err);
        // Revert local state if save failed
        setSavedLocation(savedLocation);
      }
    }
  }, [autoSave, saveLocationToDatabase, onLocationSaved, savedLocation]);

  // Always allow location detection - no time limit
  const canDetectLocation = useCallback(() => {
    return true; // Unlimited auto-detection allowed
  }, []);

  // No time limit - always return null
  const getNextDetectionTime = useCallback(() => {
    return null; // No cooldown period
  }, []);

  // Initialize location detection hook
  const locationDetection = useLocationDetection({
    onLocationDetected: handleLocationDetected
  });

  // Load saved location on mount
  useEffect(() => {
    loadSavedLocation();
  }, [loadSavedLocation]);

  // Manual save function for forms
  const saveLocation = useCallback(async (locationData?: LocationData) => {
    const dataToSave = locationData || savedLocation;
    if (!dataToSave) return;
    
    await saveLocationToDatabase(dataToSave);
  }, [savedLocation, saveLocationToDatabase]);

  // Save manual location (no 30-day limit, doesn't update location_last_updated)
  const saveManualLocation = useCallback(async (locationData: {
    city: string;
    state: string;
    country: string;
    fullAddress?: string;
    postcode?: string;
  }) => {
    if (!currentUser?.id) return;

    try {
      setIsLoading(true);
      setError('');

      const updateData = {
        city: locationData.city || '',
        state: locationData.state || '',
        country: locationData.country || '',
        precise_address: locationData.fullAddress || '',
        postal_code: locationData.postcode || ''
        // NOTE: We don't update location_last_updated for manual entry
        // This allows unlimited manual edits
      };

      console.log('💾 [Manual Location] Saving to database:', updateData);

      if (type === 'profile') {
        const { error: dbError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', currentUser.id);

        if (dbError) throw dbError;
      } else if (type === 'company') {
        const { error: dbError } = await supabase
          .from('companies')
          .update(updateData)
          .eq('user_id', currentUser.id);

        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase.from('referral_profiles').update(updateData).eq('user_id', currentUser.id);
        if (dbError) throw dbError;
      }

      const newLocation: LocationData = {
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        fullAddress: locationData.fullAddress,
        postcode: locationData.postcode,
        location_last_updated: savedLocation?.location_last_updated // Keep existing timestamp
      };

      setSavedLocation(newLocation);
      onLocationSaved?.(newLocation);
      console.log('✅ Manual location saved to Supabase:', newLocation);
      
    } catch (err) {
      console.error('Error saving manual location:', err);
      setError('Failed to save location');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, type, onLocationSaved, savedLocation?.location_last_updated]);

  // Clear saved location and reload
  const clearAndRefreshLocation = useCallback(async () => {
    setSavedLocation(null);
    setError('');
    await loadSavedLocation();
  }, [loadSavedLocation]);

  // Check if location is already saved and complete
  const hasValidSavedLocation = Boolean(
    savedLocation && 
    savedLocation.city && 
    savedLocation.state && 
    savedLocation.country
  );

  return {
    ...locationDetection,
    savedLocation,
    isLoading,
    error: error || locationDetection.error,
    hasValidSavedLocation,
    saveLocation,
    saveManualLocation,
    loadSavedLocation,
    handleLocationDetected,
    setSavedLocation,
    clearAndRefreshLocation,
    canDetectLocation,
    getNextDetectionTime
  };
};