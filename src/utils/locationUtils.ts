import { Capacitor } from '@capacitor/core';
import { Geolocation as CapacitorGeolocation } from '@capacitor/geolocation';

export interface LocationData {
  city: string;
  region: string;
  country: string;
  ip: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface FullAddress {
  country: string;
  state: string;
  district?: string;
  city: string;
  postcode?: string;
  road?: string;
  formattedAddress: string;
}

const isDevelopment = process.env.NODE_ENV === 'development';

export const isSecureContext = (): boolean => {
  return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
};

export const checkGeolocationSupport = (): { supported: boolean; error?: string } => {
  // Capacitor native always supports geolocation
  if (Capacitor.isNativePlatform()) {
    return { supported: true };
  }

  if (!navigator.geolocation) {
    return { supported: false, error: 'Geolocation not supported by this browser' };
  }
  
  if (!isSecureContext()) {
    return { supported: false, error: 'Geolocation requires HTTPS or localhost' };
  }
  
  return { supported: true };
};

export const fetchIPLocation = async (signal?: AbortSignal): Promise<LocationData> => {
  if (isDevelopment) {
    console.log('🌍 Starting IP location detection...');
  }
  
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json', {
    signal
  });
  if (!response.ok) {
    throw new Error(`IP location service error: ${response.status}`);
  }
  
  const data = await response.json();
  if (isDevelopment) {
    console.log('📍 IP Location detected:', data);
  }
  
  return {
    city: data.city,
    region: data.region,
    country: data.country,
    ip: data.ip,
  };
};

export const reverseGeocode = async (lat: number, lng: number, signal?: AbortSignal): Promise<FullAddress> => {
  console.log('🗺️ Starting reverse geocode for coordinates:', { lat, lng });
  
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`,
    {
      headers: {
          'User-Agent': 'Workly-India-App/1.0'
      },
      signal
    }
  );
  
  if (!response.ok) {
    throw new Error(`Geocoding service error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('🏠 Reverse geocoding result:', data);
  
  if (!data.address) {
    throw new Error('No address data found for this location');
  }
  
  const address = data.address;
  
  // Enhanced city extraction with multiple fallbacks (especially for Indian addresses)
  const city = address.city || 
               address.town || 
               address.village || 
               address.municipality || 
               address.suburb ||
               address.neighbourhood ||
               address.county ||
               address.state_district ||
               '';
  
  console.log('🏙️ City extracted:', city || '(EMPTY)', 'from address:', address);
  
  // Helper to sanitize postal code
  const sanitizePostcode = (value: any): string => {
    if (!value) return '';
    const str = String(value).trim();
    if (str === 'undefined' || 
        str === 'null' || 
        str === '[object Object]' || 
        str.toLowerCase().includes('object') ||
        str.toLowerCase().includes('throttled') ||
        str.toLowerCase().includes('geocode.xyz') ||
        str.toLowerCase().includes('see ')) {
      return '';
    }
    return str;
  };

  // Extract postal code with enhanced fallback options - Try multiple APIs in parallel
  let postcode: string = sanitizePostcode(address.postcode || address.postal_code);
  console.log('📮 Step 1 - Initial postcode from OSM:', postcode || '(EMPTY)');

  // For India, try multiple APIs simultaneously for better results
  const isIndia = address.country_code === 'in' || (address.country || '').toLowerCase() === 'india';
  
  if ((!postcode || postcode.trim() === '') && isIndia) {
    console.log('🇮🇳 Detected India - trying multiple postal code APIs...');
    
    const postalPromises = [];
    
    // Method 1: Parse 6-digit PIN from display_name
    const displayNameMatch = (data.display_name || '').match(/\b\d{6}\b/);
    if (displayNameMatch) {
      postcode = sanitizePostcode(displayNameMatch[0]);
      console.log('📮 Step 2 - Postal code from display_name:', postcode);
    }
    
    // Method 2: Try Geocode.xyz API (often has Indian PIN codes)
    if (!postcode || postcode.trim() === '') {
      postalPromises.push(
        fetch(`https://geocode.xyz/${lat},${lng}?json=1`, { signal })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.postal) {
              const sanitized = sanitizePostcode(data.postal);
              console.log('📮 Postal code from Geocode.xyz:', sanitized);
              return sanitized;
            }
            return null;
          })
          .catch(e => {
            console.warn('⚠️ Geocode.xyz failed:', e);
            return null;
          })
      );
    }
    
    // Method 3: BigDataCloud API
    if (!postcode || postcode.trim() === '') {
      postalPromises.push(
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`, { signal })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && (data.postcode || data.postCode)) {
              const sanitized = sanitizePostcode(data.postcode || data.postCode);
              console.log('📮 Postal code from BigDataCloud:', sanitized);
              return sanitized;
            }
            return null;
          })
          .catch(e => {
            console.warn('⚠️ BigDataCloud failed:', e);
            return null;
          })
      );
    }
    
    // Method 4: Indian Postal Pincode API
    if (!postcode || postcode.trim() === '') {
      postalPromises.push(
        fetch(`https://api.postalpincode.in/pincode/${lat}/${lng}`, { signal })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data[0]?.PostOffice?.[0]?.Pincode) {
              const sanitized = sanitizePostcode(data[0].PostOffice[0].Pincode);
              console.log('📮 Postal code from India Postal API:', sanitized);
              return sanitized;
            }
            return null;
          })
          .catch(e => {
            console.warn('⚠️ India Postal API failed:', e);
            return null;
          })
      );
    }
    
    // Wait for all postal code APIs and use the first valid result
    if (postalPromises.length > 0 && (!postcode || postcode.trim() === '')) {
      try {
        const results = await Promise.allSettled(postalPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            const sanitized = sanitizePostcode(result.value);
            if (sanitized !== '') {
              postcode = sanitized;
              console.log('✅ Got postal code from parallel API call:', postcode);
              break;
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Error waiting for postal code APIs:', e);
      }
    }
  }
  
  // For non-India locations, try BigDataCloud as fallback
  if ((!postcode || postcode.trim() === '') && !isIndia) {
    try {
      console.log('📮 Trying BigDataCloud for non-India location...');
      const altRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`, { signal });
      if (altRes.ok) {
        const alt = await altRes.json();
        const altPost = sanitizePostcode(alt.postcode || alt.postCode);
        if (altPost) {
          postcode = altPost;
          console.log('📮 Postal code from BigDataCloud:', postcode);
        }
      }
    } catch (e) {
      console.warn('⚠️ BigDataCloud failed:', e);
    }
  }
  
  // Final sanitization before returning
  const finalPostcode = sanitizePostcode(postcode);
  console.log('📮 FINAL POSTAL CODE:', finalPostcode || '(EMPTY)', '| Valid:', finalPostcode !== '');
  
  const result = {
    country: address.country || '',
    state: address.state || address.region || '',
    district: address.county || address.state_district || '',
    city: city,
    postcode: finalPostcode,
    road: address.road || address.street || '',
    formattedAddress: data.display_name || ''
  };
  
  console.log('✅ Final address object:', result);
  
  return result;
};

export const getCompanyDisplayLocation = (company: any): string => {
  if (!company) return 'No company profile found';
  
  // First priority: precise_address (if it exists and not empty, use it)
  if (company.precise_address && company.precise_address.trim() && company.precise_address.trim() !== 'undefined') {
    return company.precise_address.trim();
  }
  
  // Second priority: build from individual components (city, state, country)
  const addressParts = [
    company.city,
    company.state, 
    company.country
  ].filter(part => part && part.trim() && part.trim() !== 'undefined' && part.trim().toLowerCase() !== 'mu');
  
  if (addressParts.length > 0) {
    return addressParts.join(', ');
  }
  
  // Try alternative field names
  const altAddressParts = [
    company.company_city,
    company.company_state,
    company.company_country
  ].filter(part => part && part.trim() && part.trim() !== 'undefined' && part.trim().toLowerCase() !== 'mu');
  
  if (altAddressParts.length > 0) {
    return altAddressParts.join(', ');
  }
  
  // Third priority: fallback to company.location (if meaningful)
  if (company.location && company.location.trim() && company.location.trim() !== 'undefined' && company.location.trim().toLowerCase() !== 'mu') {
    return company.location.trim();
  }
  
  return 'Location not provided';
};

/**
 * Gets geolocation using Capacitor plugin on native platforms,
 * falls back to browser Geolocation API on web.
 */
export const getGeolocation = async (): Promise<GeolocationPosition> => {
  // Use Capacitor Geolocation on native platforms for GPS accuracy
  if (Capacitor.isNativePlatform()) {
    console.log('📡 Using Capacitor GPS geolocation (native)...');
    try {
      // Request permissions first on native
      const permStatus = await CapacitorGeolocation.checkPermissions();
      console.log('🔐 Capacitor GPS permission status:', permStatus.location);

      if (permStatus.location === 'denied') {
        const reqResult = await CapacitorGeolocation.requestPermissions();
        console.log('🔐 Capacitor GPS permission request result:', reqResult.location);
        if (reqResult.location === 'denied') {
          throw new Error('Location permission denied');
        }
      }

      const position = await CapacitorGeolocation.getCurrentPosition({
        enableHighAccuracy: true, // Use GPS on native for best accuracy
        timeout: 15000,
        maximumAge: 300000, // 5 min cache
      });

      console.log('📍 Capacitor GPS position:', position.coords);

      // Convert to standard GeolocationPosition shape
      return {
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
        },
        timestamp: position.timestamp,
      } as GeolocationPosition;
    } catch (err) {
      console.warn('⚠️ Capacitor GPS failed, falling back to browser API:', err);
      // Fall through to browser API
    }
  }

  // Browser fallback
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000,
      }
    );
  });
};

/**
 * Calculate distance between two coordinates using Haversine Formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers (rounded to 1 decimal place)
 */
export const calculateHaversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null => {
  // Validate inputs
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return null;

  // Earth's radius in kilometers
  const R = 6371;

  // Convert degrees to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place
  return Math.round(distance * 10) / 10;
};
