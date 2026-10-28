/**
 * Central Domain Configuration for All Edge Functions
 * 
 * DEVELOPER NOTES:
 * - This is the SINGLE SOURCE OF TRUTH for domain configuration in edge functions
 * - When switching domains, update ONLY the CANONICAL_DOMAIN constant below
 * - Frontend domain config is in: src/config/domainConfig.ts
 * 
 * DYNAMIC DOMAIN SUPPORT:
 * - Edge functions now support dynamic domain detection via origin header
 * - For SEO (sitemaps, structured data), always use CANONICAL_DOMAIN
 * - For operations (passkeys, redirects), use the request origin when available
 * 
 * CRITICAL FOR PASSKEYS:
 * - Passkeys (WebAuthn) are DOMAIN-BOUND - they won't work across different domains
 * - The rpId MUST match the domain where the passkey was registered
 * - After domain switch, users need to re-register their passkeys
 */

// =============================================
// PRIMARY DOMAIN CONFIGURATION
// =============================================
// Change this value to switch the entire application to a new domain.
// Optionally override via the CANONICAL_DOMAIN environment variable.
export const CANONICAL_DOMAIN = Deno.env.get('CANONICAL_DOMAIN') || 'worklyindia.devs.surf';

// Full URL with protocol
export const WEBSITE_DOMAIN = `https://${CANONICAL_DOMAIN}`;

// =============================================
// DOMAIN HELPERS
// =============================================

/**
 * Get the domain for passkey rpId
 * - Extracts hostname from origin header
 * - For production: returns canonical domain without www
 * - For preview: returns the actual origin domain
 * - For other custom domains: returns the hostname from origin
 */
export function getPasskeyRpId(originHeader?: string): string {
  // For passkeys, use the BASE domain (without www) so passkeys work
  // from both www.domain.com and domain.com origins
  const BASE_DOMAIN = CANONICAL_DOMAIN.replace(/^www\./, '');
  
  if (!originHeader) {
    console.log('[domain] No origin header, using base domain for passkey:', BASE_DOMAIN);
    return BASE_DOMAIN;
  }
  
  try {
    // Parse the origin to extract hostname
    const url = new URL(originHeader.startsWith('http') ? originHeader : `https://${originHeader}`);
    const hostname = url.hostname;
    
    console.log('[domain] Parsed hostname from origin:', hostname);
    
    // For lovable preview domains, use the full hostname
    if (hostname.includes('lovable.app') || hostname.includes('lovableproject.com')) {
      console.log('[domain] Preview domain detected, using:', hostname);
      return hostname;
    }
    
    // For localhost/development
    if (hostname === 'localhost' || hostname.startsWith('127.')) {
      console.log('[domain] Localhost detected, using:', hostname);
      return hostname;
    }
    
    // For the canonical domain (with or without www), use BASE domain (without www)
    // WebAuthn rpId must be a registrable suffix of the origin - base domain works for all subdomains
    if (hostname === BASE_DOMAIN || hostname === `www.${BASE_DOMAIN}` || hostname.endsWith(`.${BASE_DOMAIN}`)) {
      console.log('[domain] Canonical domain match, using base domain for passkey:', BASE_DOMAIN);
      return BASE_DOMAIN;
    }
    
    // For any other custom domain, use the full hostname
    console.log('[domain] Custom domain detected, using:', hostname);
    return hostname;
  } catch (err) {
    console.error('[domain] Error parsing origin:', err);
    return BASE_DOMAIN;
  }
}

/**
 * Get domain with optional override (for testing)
 * For SEO-related operations, always use this
 */
export function getDomain(providedDomain?: string): string {
  return providedDomain || WEBSITE_DOMAIN;
}

/**
 * Get domain from origin header for dynamic operations
 * Falls back to WEBSITE_DOMAIN if no origin provided
 */
export function getDynamicDomain(originHeader?: string): string {
  if (!originHeader) return WEBSITE_DOMAIN;
  
  try {
    const url = new URL(originHeader.startsWith('http') ? originHeader : `https://${originHeader}`);
    return url.origin;
  } catch {
    return WEBSITE_DOMAIN;
  }
}

/**
 * Build a full URL from a path (uses canonical domain for SEO)
 */
export function buildUrl(path: string, providedDomain?: string): string {
  const domain = getDomain(providedDomain);
  // Remove trailing slash from domain and leading slash from path
  const cleanDomain = domain.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanDomain}/${cleanPath}`;
}

/**
 * Build a full URL using dynamic domain (for redirects, operations)
 */
export function buildDynamicUrl(path: string, originHeader?: string): string {
  const domain = getDynamicDomain(originHeader);
  const cleanDomain = domain.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanDomain}/${cleanPath}`;
}

// =============================================
// SEO DOMAIN HELPERS (for sitemaps, indexing, etc.)
// =============================================

/**
 * Get the canonical SEO domain (always returns production domain)
 * Use this for sitemaps, structured data, IndexNow submissions
 */
export const getSEODomain = () => WEBSITE_DOMAIN;

/**
 * Get the canonical domain host for IndexNow (without protocol)
 */
export const getIndexNowHost = () => CANONICAL_DOMAIN;

/**
 * Get static page base URL (for 2FA redirects, etc.)
 * Uses the canonical production domain
 */
export const STATIC_PAGE_BASE = WEBSITE_DOMAIN;

// =============================================
// COMMON PAGE URLS (using canonical domain for SEO)
// =============================================
export const PAGES = {
  // Job Seeker pages
  JOBS: buildUrl('/jobs'),
  USER_APPLICATIONS: buildUrl('/user/applications'),
  USER_PROFILE: buildUrl('/profile'),
  USER_DASHBOARD: buildUrl('/user/dashboard'),
  REWARDS: buildUrl('/rewards'),
  
  // Employer pages
  EMPLOYER_DASHBOARD: buildUrl('/employer/dashboard'),
  EMPLOYER_WALLET: buildUrl('/employer/wallet'),
  EMPLOYER_SUBSCRIPTION: buildUrl('/employer/subscription'),
  EMPLOYER_REFERRAL: buildUrl('/employer/referral'),
  EMPLOYER_APPLICATIONS: buildUrl('/employer/applications'),
  EMPLOYER_JOBS: buildUrl('/employer/jobs'),
  EMPLOYER_INTERVIEWS: buildUrl('/employer/interviews'),
  EMPLOYER_SETTINGS: buildUrl('/employer/settings'),
  EMPLOYER_COMPANY: buildUrl('/employer/company'),
  
  // Common pages
  LOGIN: buildUrl('/auth/login'),
  SIGNUP: buildUrl('/auth/signup'),
  HOME: WEBSITE_DOMAIN,
} as const;

// =============================================
// URL BUILDERS FOR ENTITIES
// =============================================

export function getJobUrl(jobId: string): string {
  return buildUrl(`/job/${jobId}`);
}

export function getCompanyUrl(companyId: string): string {
  return buildUrl(`/company/${companyId}`);
}

export function getApplicationUrl(applicationId: string): string {
  return buildUrl(`/user/applications/${applicationId}`);
}
