/**
 * Centralized Brand Configuration for Edge Functions
 * Mirrors the frontend config for consistency across the application
 * 
 * IMPORTANT: Keep in sync with src/config/brandConfig.ts
 */

import { CANONICAL_DOMAIN, WEBSITE_DOMAIN } from './domain.ts';

export const BRAND_CONFIG = {
  // Full brand name
  name: 'Workly India',
  
  // Split name for styled display
  firstName: 'Workly',
  secondName: 'India',
  
  // Short name for compact displays
  shortName: 'Workly',
  
  // Alternative names for SEO
  alternateName: 'Workly India',
  
  // Tagline
  tagline: 'Find.Work.Grow',

  // Brand word colours — kept in sync with src/config/brandConfig.ts so the
  // server-rendered email header matches the website instead of falling back to
  // an undefined colour value.
  firstWordColor: '#3B5CE4',
  secondWordColor: '#0DB17E',

  
  // Message footer for WhatsApp/Telegram/Push notifications
  messageFooter: `Workly India • ${CANONICAL_DOMAIN}`,
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
  
  // Domain
  domain: CANONICAL_DOMAIN,
  canonicalDomain: CANONICAL_DOMAIN,
  canonicalUrl: WEBSITE_DOMAIN,
  
  // Telegram Bot Username (for notification integration)
  telegramBotUsername: 'worklyindia_bot',
  
  // Social Media Links
  socialLinks: {
    instagram: 'https://www.instagram.com/worklyindia',
    youtube: 'https://youtube.com/@worklyindia',
    telegram: 'https://t.me/WorklyIndia',
    twitter: 'https://x.com/WorklyIndia',
    facebook: 'https://www.facebook.com/worklyindia',
  },
} as const;

// Full brand name string
export const BRAND_NAME = BRAND_CONFIG.name;

// Message templates helper
export const getMessageFooter = (includeUrl = true): string => {
  return includeUrl ? BRAND_CONFIG.messageFooter : BRAND_CONFIG.messageFooterShort;
};
