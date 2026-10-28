/**
 * SEO URL Helper Functions
 * Centralized utilities for generating SEO-friendly URLs
 */

import { CANONICAL_URL } from '@/config/domainConfig';

const WEBSITE_DOMAIN = CANONICAL_URL;

/**
 * Build full URL for jobs
 */
export function getJobUrl(job: { public_slug?: string; id: string }): string {
  return `/job/${job.public_slug || job.id}`;
}

/**
 * Build short URL for jobs (for sharing)
 */
export function getJobShortUrl(shortId: string): string {
  return `${WEBSITE_DOMAIN}/j/${shortId}`;
}

/**
 * Build full URL for companies
 */
export function getCompanyUrl(company: { slug?: string; id: string }): string {
  return `/company/${company.slug || company.id}`;
}

/**
 * Build short URL for companies (for sharing)
 */
export function getCompanyShortUrl(shortId: string): string {
  return `${WEBSITE_DOMAIN}/c/${shortId}`;
}

/**
 * Build full URL for user profiles
 */
export function getProfileUrl(profile: { public_slug?: string; id: string }): string {
  return `/candidate/${profile.public_slug || profile.id}`;
}

/**
 * Build short URL for user profiles (for sharing)
 */
export function getProfileShortUrl(shortId: string): string {
  return `${WEBSITE_DOMAIN}/u/${shortId}`;
}

/**
 * Build full URL for blog posts
 */
export function getBlogUrl(post: { slug: string }): string {
  return `/blog/${post.slug}`;
}

/**
 * Generate share message for jobs
 */
export function generateJobShareMessage(job: {
  title: string;
  company_name?: string;
  location?: string;
  short_id?: string;
  public_slug?: string;
  id: string;
}): string {
  // Prefer short_id for compact sharing, then SEO slug, then UUID
  const url = job.short_id 
    ? getJobShortUrl(job.short_id) 
    : `${WEBSITE_DOMAIN}/job/${job.public_slug || job.id}`;
    
  return `🔥 ${job.title}${job.company_name ? ` at ${job.company_name}` : ''}

📍 ${job.location || 'Remote/Workly India'}

Apply now: ${url}

#WorklyIndia #RemoteJobs #WorklyIndia`;
}

/**
 * Generate share message for companies
 */
export function generateCompanyShareMessage(company: {
  company_name: string;
  description?: string;
  location?: string;
  short_id?: string;
  slug?: string;
  id: string;
}): string {
  const url = company.short_id 
    ? getCompanyShortUrl(company.short_id) 
    : `${WEBSITE_DOMAIN}/company/${company.slug || company.id}`;
    
  return `🏢 ${company.company_name}

${company.description ? company.description.substring(0, 100) + '...' : ''}

📍 ${company.location || 'India'}

View profile: ${url}

#Company #Jobs #WorklyIndia`;
}

/**
 * Generate share message for profiles
 */
export function generateProfileShareMessage(profile: {
  full_name: string;
  headline?: string;
  city?: string;
  short_id?: string;
  public_slug?: string;
  id: string;
}): string {
  const url = profile.short_id 
    ? getProfileShortUrl(profile.short_id) 
    : `${WEBSITE_DOMAIN}/candidate/${profile.public_slug || profile.id}`;
    
  return `👤 ${profile.full_name}

${profile.headline || ''}

📍 ${profile.city || 'India'}

View profile: ${url}

#JobSeeker #Career #WorklyIndia`;
}
