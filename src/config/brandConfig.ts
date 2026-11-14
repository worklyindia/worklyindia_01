/**
 * Centralized Brand Configuration
 * Single source of truth for brand name, colors, and styling
 * Update this file to change the brand across the entire application
 * 
 * IMPORTANT: When changing brand name, also update:
 * - supabase/functions/_shared/brandConfig.ts (edge functions)
 * - public/*.html files (static pages)
 * - Database templates (run migration)
 */

import { CANONICAL_DOMAIN } from './domainConfig';

export const BRAND_CONFIG = {
  // Full brand name
  name: 'Workly India',
  
  // Split name for styled display
  firstName: 'Workly',
  secondName: 'India',
  
  // Short name for compact displays
  shortName: 'Workly',
  
  // Colors from logo (hex)
  firstWordColor: '#3B5CE4',  // Deep Indigo Blue
  secondWordColor: '#0DB17E', // Emerald Green
  
  // Alternative names (for SEO structured data)
  alternateName: 'Workly India',
  
  // Tagline
  tagline: 'Find.Work.Grow',
  
  // Message footer for WhatsApp/Telegram/Push
  messageFooter: `Workly India \u2022 ${CANONICAL_DOMAIN}`,
  messageFooterShort: 'Workly India',
  
  // Social/SEO hashtags
  hashtag: '#WorklyIndia',
  hashtags: ['#WorklyIndia', '#RemoteJobs', '#WorklyIndia', '#WorklyIndia'],
  
  // Twitter/X handle
  twitterHandle: '@WorklyIndia',
  
  // Legacy names for reference/migration (DO NOT USE in new code)
  legacyNames: ['Workly India', 'Workly India'],
  
  // Contact info
  email: 'worklyindia@outlook.com',
  supportEmail: `contact@${CANONICAL_DOMAIN}`,
  phone: '+91-9904923067',
  whatsappNumber: '919904923067',
  
  // Registration
  udyamNumber: 'UDYAM-GJ-18-0022888',
  iecNumber: 'EBGPG4522J',
  
  // Location
  location: 'Ahmedabad, Gujarat, India',
  fullAddress: 'Sankhewsar, Patan, Gujarat, India - 384246',
  
  // Domain (without protocol)
  domain: CANONICAL_DOMAIN,
  canonicalDomain: CANONICAL_DOMAIN,
  
  // Telegram Bot Username (for notification integration)
  telegramBotUsername: 'worklyindia_bot',
  
  // Social Media Links
  socialLinks: {
    instagram: 'https://www.instagram.com/worklyindiaofficial',
    youtube: 'https://youtube.com/@worklyindiaofficial',
    telegram: 'https://t.me/WorklyIndia',
    twitter: 'https://x.com/WorklyIndia',
    facebook: 'https://www.facebook.com/worklyindia',
  },
} as const;

// Helper to get styled brand name JSX (for components)
export const getBrandNameParts = () => ({
  first: BRAND_CONFIG.firstName,
  second: BRAND_CONFIG.secondName,
  firstColor: BRAND_CONFIG.firstWordColor,
  secondColor: BRAND_CONFIG.secondWordColor,
});

// Full brand name string
export const BRAND_NAME = BRAND_CONFIG.name;

// For SEO/meta tags
export const BRAND_FULL_TITLE = `${BRAND_CONFIG.name} - Remote Jobs`;

// SEO helpers
export const BRAND_SEO_TITLE = 'Workly India | Remote Jobs & Work From Home in India';
export const BRAND_SEO_SUFFIX = '| Workly India';
export const BRAND_SEO_DESCRIPTION = 'Find remote jobs and work-from-home opportunities across India. Explore job openings, create your profile and connect with employers on Workly India.';

// Template for page titles
export const getPageTitle = (pageTitle: string): string => {
  return `${pageTitle} | ${BRAND_CONFIG.name}`;
};

// Message templates helper
export const getMessageFooter = (includeUrl = true): string => {
  return includeUrl ? BRAND_CONFIG.messageFooter : BRAND_CONFIG.messageFooterShort;
};
