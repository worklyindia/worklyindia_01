/**
 * Site Configuration - DEPRECATED
 * 
 * This file is maintained for backward compatibility.
 * For new code, use src/config/domainConfig.ts instead.
 * 
 * When switching domains, update domainConfig.ts, NOT this file.
 */

import { 
  CANONICAL_URL, 
  getJobShareUrl, 
  getCompanyShareUrl, 
  getProfileShareUrl 
} from './domainConfig';

export const SITE_CONFIG = {
  // Production domain - always use this for share URLs
  PRODUCTION_DOMAIN: CANONICAL_URL,
  
  // Get the domain to use for share links (always production)
  getShareDomain: () => CANONICAL_URL,
  
  // Build job URL for sharing - prioritize SEO-friendly public_slug
  getJobShareUrl,
  
  // Build company URL for sharing
  getCompanyShareUrl,
  
  // Build profile URL for sharing
  getProfileShareUrl,
};
