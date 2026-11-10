import { encodeSharedJob } from '@/utils/externalJobShare';

/**
 * Centralized Domain Configuration
 * 
 * This file manages all domain-related settings for the application.
 * When you need to switch domains, ONLY change the CANONICAL_DOMAIN here.
 * 
 * Developer Notes:
 * - The CANONICAL_DOMAIN is the primary production domain used for:
 *   - SEO (canonical URLs, sitemaps, structured data)
 *   - Authentication (passkey rpId, OAuth redirects)
 *   - Sharing (social media URLs, WhatsApp/Telegram share links)
 *   - Push notifications (OneSignal, Telegram, WhatsApp)
 * 
 * - DYNAMIC MODE: The system now auto-detects the current domain for operations
 *   - SEO/sharing always uses CANONICAL_DOMAIN
 *   - Operations (auth, redirects) use the current browser domain
 *   - This allows the app to work on any domain it's deployed to
 * 
 * - To switch domains in the future:
 *   1. Change CANONICAL_DOMAIN below
 *   2. Update supabase/functions/_shared/domain.ts (same domain)
 *   3. Re-register passkeys for affected users (passkeys are domain-bound)
 *   4. Update DNS and SSL certificates
 *   5. Update OAuth provider callback URLs
 */

// =============================================
// PRIMARY DOMAIN CONFIGURATION
// =============================================
// Fallback used when no domain has been saved in Owner Portal → Domain Settings
export const DEFAULT_CANONICAL_DOMAIN = 'worklyindia.devs.surf';

// Key used to cache the owner-configured domain for synchronous startup reads
export const CANONICAL_DOMAIN_STORAGE_KEY = 'canonical_domain';

export const isValidDomain = (value: string): boolean =>
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i.test(value.trim());

export const normalizeDomain = (value: string): string =>
  value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const readStoredDomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CANONICAL_DOMAIN_STORAGE_KEY);
    if (stored && isValidDomain(stored)) return normalizeDomain(stored);
  } catch {
    /* storage unavailable */
  }
  return null;
};

// Active canonical domain: owner-saved value if present, otherwise the default
export const CANONICAL_DOMAIN = readStoredDomain() || DEFAULT_CANONICAL_DOMAIN;

/** True only when the site is opened on the owner-saved domain (Razorpay-approved website). */
export const isOnSavedDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
  return host === CANONICAL_DOMAIN.replace(/^www\./, '');
};

// Full URL with protocol
export const CANONICAL_URL = `https://${CANONICAL_DOMAIN}`;

// =============================================
// DOMAIN DETECTION & VALIDATION
// =============================================

/**
 * Get the current browser hostname
 */
export const getCurrentHostname = (): string => {
  if (typeof window === 'undefined') return CANONICAL_DOMAIN;
  return window.location.hostname;
};

/**
 * Check if the current browser domain matches the canonical domain
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
 * Check if running on a preview/development domain
 * NOTE: the canonical domain itself is never a preview domain, even when it is
 * hosted on lovable.app.
 */
export const isPreviewDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = getCurrentHostname();
  if (host === CANONICAL_DOMAIN) return false;
  return host.includes('lovable.app') || 
         host.includes('lovableproject.com') ||
         host.includes('localhost') ||
         host.includes('127.0.0.1');
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => {
  return isCanonicalDomain() && !isPreviewDomain();
};

/**
 * Get the current origin for authentication (passkey rpId needs this)
 * This returns the actual browser origin for proper WebAuthn functionality
 */
export const getCurrentOrigin = (): string => {
  if (typeof window === 'undefined') return CANONICAL_URL;
  return window.location.origin;
};

/**
 * Get the domain for passkey rpId
 * For passkeys to work correctly, this must match where they were registered
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
// URL BUILDERS
// =============================================

/**
 * Build a full URL using the canonical domain (for SEO, sharing)
 */
export const buildCanonicalUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${CANONICAL_URL}${cleanPath}`;
};

/**
 * Build a URL using the current domain (for navigation, API calls)
 */
export const buildCurrentUrl = (path: string): string => {
  if (typeof window === 'undefined') return buildCanonicalUrl(path);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${cleanPath}`;
};

/**
 * Build a dynamic URL - uses current domain for operations
 * Alias for buildCurrentUrl for backward compatibility
 */
export const buildDynamicUrl = (path: string): string => buildCurrentUrl(path);

// =============================================
// FEATURE FLAGS BASED ON DOMAIN
// =============================================

/**
 * Check if OneSignal push notifications should be enabled
 * OneSignal is configured for the canonical domain only
 */
export const shouldEnablePush = (): boolean => {
  return isCanonicalDomain();
};

/**
 * Check if analytics should be enabled
 */
export const shouldEnableAnalytics = (): boolean => {
  return isProduction();
};

/**
 * Check if Telegram/WhatsApp integrations should work
 * These are configured for production domain only
 */
export const shouldEnableMessagingIntegrations = (): boolean => {
  return isProduction();
};

// =============================================
// SHARE URL BUILDERS (Always use canonical domain for SEO)
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
// EXTERNAL (Adzuna/Jooble/Careerjet) SHARE URL
// =============================================

/**
 * Build a shareable URL for an external partner job. The compact payload is
 * base64url-encoded into `?d=` so the recipient's browser can hydrate the
 * details page even though sessionStorage is empty in a fresh session.
 *
 * Kept small (only viewer-visible fields) to stay well under WhatsApp/X URL
 * limits (~2KB works reliably; description trimmed to 500 chars).
 */
export const getExternalJobShareUrl = (job: {
  external_id: string;
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  type?: string;
  description?: string;
  snippet?: string;
  link?: string;
  source?: string;
  updated?: string | null;
  company_logo?: string | null;
  category?: string | null;
}): string => {
  const extId = String(job.external_id || '');
  // Derive source slug from external_id prefix (adzuna_ / jooble_ / careerjet_)
  // and fall back to the `source` field. Route param must be url-safe.
  const sourceFromId = extId.split('_')[0]?.toLowerCase();
  const sourceRaw = sourceFromId || (job.source || 'ext').toLowerCase();
  const source = sourceRaw.replace(/[^a-z0-9]/g, '') || 'ext';
  const extIdSuffix = extId.startsWith(`${source}_`) ? extId.slice(source.length + 1) : extId;

  // Use the shared compact encoder so ExternalJobDetail can decode with the
  // same helper. Description is deliberately omitted to keep the URL short.
  const encoded = encodeSharedJob({ ...job, external_id: extId });

  const base = `${CANONICAL_URL}/ej/${encodeURIComponent(source)}/${encodeURIComponent(extIdSuffix)}`;
  return encoded ? `${base}?d=${encoded}` : base;
};

/**
 * Build the compact `/ej/s/:shortId` share URL for an external job. This is
 * the preferred format — same short length as internal `/j/:short_id` links.
 * Callers get the short_id from the `external-job-shorten` edge function.
 */
export const getExternalJobShortShareUrl = (shortId: string): string => {
  return `${CANONICAL_URL}/ej/s/${encodeURIComponent(shortId)}`;
};


// =============================================
// PASSKEY DOMAIN MISMATCH DETECTION
// =============================================

/**
 * Check if the current domain matches a registered passkey domain
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
// EXPORT ALL DOMAIN-RELATED CONSTANTS
// =============================================

export const DOMAIN_CONFIG = {
  // Primary domain settings
  canonical: CANONICAL_DOMAIN,
  canonicalUrl: CANONICAL_URL,
  
  // Detection functions
  getCurrentHostname,
  isCanonicalDomain,
  isPreviewDomain,
  isProduction,
  
  // URL builders
  buildCanonicalUrl,
  buildCurrentUrl,
  buildDynamicUrl,
  getCurrentOrigin,
  getPasskeyDomain,
  
  // Feature flags
  shouldEnablePush,
  shouldEnableAnalytics,
  shouldEnableMessagingIntegrations,
  
  // Share URL builders
  getJobShareUrl,
  getCompanyShareUrl,
  getProfileShareUrl,
  
  // Passkey mismatch detection
  isPasskeyDomainMismatch,
  getPasskeyDomainMismatchMessage,
} as const;

export default DOMAIN_CONFIG;
