/**
 * Client Information Utilities
 * Captures device and browser information for enhanced audit logging
 */

export interface ClientInfo {
  userAgent: string;
  deviceInfo: {
    platform: string;
    vendor: string;
    language: string;
    screenResolution: string;
    timezone: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  };
}

/**
 * Detects device type based on user agent and screen size
 */
const detectDeviceType = () => {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
  const isDesktop = !isMobile && !isTablet;

  return { isMobile, isTablet, isDesktop };
};

/**
 * Captures comprehensive client information for audit logging
 */
export const getClientInfo = (): ClientInfo => {
  const deviceType = detectDeviceType();
  
  return {
    userAgent: navigator.userAgent,
    deviceInfo: {
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isMobile: deviceType.isMobile,
      isTablet: deviceType.isTablet,
      isDesktop: deviceType.isDesktop,
    },
  };
};

/**
 * Generates a session ID for tracking related actions
 */
export const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};
