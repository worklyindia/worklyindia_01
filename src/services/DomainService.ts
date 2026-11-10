/**
 * Centralized Domain Service
 * 
 * This service provides runtime domain detection and URL building.
 * It distinguishes between:
 * - CANONICAL domain: Used for SEO (sitemaps, structured data, canonical URLs)
 * - CURRENT domain: Used for operations (API calls, redirects, passkeys)
 * 
 * USAGE:
 * - For SEO/sharing: Use getCanonicalUrl() or buildSEOUrl()
 * - For operations: Use getCurrentUrl() or buildUrl()
 */

import {
  CANONICAL_DOMAIN as SHARED_CANONICAL_DOMAIN,
  CANONICAL_URL as SHARED_CANONICAL_URL,
} from '@/config/domainConfig';

// Re-export the shared values for existing callers of this service.
export const CANONICAL_DOMAIN = SHARED_CANONICAL_DOMAIN;
export const CANONICAL_URL = SHARED_CANONICAL_URL;

// =============================================
// DOMAIN DETECTION
// =============================================

/**
 * Get the current browser hostname
 */
export const getCurrentHostname = (): string => {
  if (typeof window === 'undefined') return CANONICAL_DOMAIN;
  return window.location.hostname;
};

/**
 * Get the current browser origin (with protocol)
 */
export const getCurrentOrigin = (): string => {
  if (typeof window === 'undefined') return CANONICAL_URL;
  return window.location.origin;
};

/**
 * Check if running on a preview/development domain
 */
export const isPreviewDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = getCurrentHostname();
  return host.includes('lovable.app') || 
         host.includes('lovableproject.com') ||
         host.includes('localhost') ||
         host.includes('127.0.0.1');
};

/**
 * Check if the current domain is the canonical domain
 */
export const isCanonicalDomain = (): boolean => {
  if (typeof window === 'undefined') return true;
  const currentHost = getCurrentHostname();
  const baseDomain = CANONICAL_DOMAIN.replace('www.', '');
  return currentHost === CANONICAL_DOMAIN || 
         currentHost === baseDomain ||
         currentHost.endsWith(`.${baseDomain}`);
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => {
  return isCanonicalDomain() && !isPreviewDomain();
};

// =============================================
// URL BUILDERS - DYNAMIC (for operations)
// =============================================

/**
 * Build a URL using the CURRENT domain
 * Use this for: navigation, API calls, redirects, passkeys
 */
export const buildUrl = (path: string): string => {
  if (typeof window === 'undefined') return buildSEOUrl(path);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${getCurrentOrigin()}${cleanPath}`;
};

/**
 * Build a URL using the CURRENT domain (alias for clarity)
 */
export const getCurrentUrl = (path: string): string => buildUrl(path);

// =============================================
// URL BUILDERS - CANONICAL (for SEO)
// =============================================

/**
 * Build a URL using the CANONICAL domain
 * Use this for: SEO, sitemaps, structured data, canonical tags, sharing
 */
export const buildSEOUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${CANONICAL_URL}${cleanPath}`;
};

/**
 * Alias for buildSEOUrl
 */
export const getCanonicalUrl = (path: string): string => buildSEOUrl(path);

// =============================================
// PASSKEY DOMAIN (for WebAuthn)
// =============================================

/**
 * Get the domain for passkey rpId
 * Passkeys are domain-bound - they only work on the domain where registered
 */
export const getPasskeyDomain = (): string => {
  if (typeof window === 'undefined') return CANONICAL_DOMAIN.replace('www.', '');
  
  const host = getCurrentHostname();
  
  // For production domains, use BASE domain (without www) so passkeys work
  // from both www.domain.com and domain.com origins
  const baseDomain = CANONICAL_DOMAIN.replace('www.', '');
  if (host === CANONICAL_DOMAIN || host === baseDomain || host.endsWith(`.${baseDomain}`)) {
    return baseDomain;
  }
  
  // For other domains (preview, localhost, custom), use the full hostname
  return host;
};

// =============================================
// SHARE URL BUILDERS (Always use canonical for SEO)
// =============================================

export const getJobShareUrl = (job: { short_id?: string; public_slug?: string; id: string }): string => {
  if (job.public_slug) {
    return `${CANONICAL_URL}/job/${job.public_slug}`;
  }
  if (job.short_id) {
    return `${CANONICAL_URL}/j/${job.short_id}`;
  }
  return `${CANONICAL_URL}/job/${job.id}`;
};

export const getCompanyShareUrl = (company: { short_id?: string; slug?: string; id: string }): string => {
  if (company.short_id) {
    return `${CANONICAL_URL}/c/${company.short_id}`;
  }
  return `${CANONICAL_URL}/company/${company.slug || company.id}`;
};

export const getProfileShareUrl = (profile: { short_id?: string; public_slug?: string; id: string }): string => {
  if (profile.short_id) {
    return `${CANONICAL_URL}/u/${profile.short_id}`;
  }
  return `${CANONICAL_URL}/candidate/${profile.public_slug || profile.id}`;
};

// =============================================
// DOMAIN MISMATCH DETECTION (for passkeys)
// =============================================

/**
 * Check if the current domain matches a registered passkey domain
 * Used to warn users when passkeys won't work
 */
export const isPasskeyDomainMismatch = (registeredDomain?: string): boolean => {
  if (!registeredDomain) return false;
  const currentDomain = getPasskeyDomain();
  return registeredDomain !== currentDomain;
};

/**
 * Get a user-friendly message about domain mismatch
 */
export const getPasskeyDomainMismatchMessage = (registeredDomain?: string): string | null => {
  if (!isPasskeyDomainMismatch(registeredDomain)) return null;
  
  const currentDomain = getPasskeyDomain();
  return `Your Passkey was registered on "${registeredDomain}" but you're currently on "${currentDomain}". Please use an alternative verification method or re-register your Passkey on this domain.`;
};

// =============================================
// EXPORTS
// =============================================

export const DomainService = {
  // Constants
  CANONICAL_DOMAIN,
  CANONICAL_URL,
  
  // Detection
  getCurrentHostname,
  getCurrentOrigin,
  isPreviewDomain,
  isCanonicalDomain,
  isProduction,
  
  // URL builders
  buildUrl,
  getCurrentUrl,
  buildSEOUrl,
  getCanonicalUrl,
  
  // Passkey
  getPasskeyDomain,
  isPasskeyDomainMismatch,
  getPasskeyDomainMismatchMessage,
  
  // Share URLs
  getJobShareUrl,
  getCompanyShareUrl,
  getProfileShareUrl,
} as const;

export default DomainService;
