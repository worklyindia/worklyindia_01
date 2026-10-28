import { useMemo } from 'react';

// Generate a simple browser fingerprint
export const useUserFingerprint = () => {
  const fingerprint = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Collect browser characteristics
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }, []);

  return fingerprint;
};
