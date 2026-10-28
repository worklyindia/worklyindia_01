// Google Search Console Helper Utilities
// For optimal indexing and crawling

import { CANONICAL_URL, CANONICAL_DOMAIN } from '@/config/domainConfig';

export const SITE_URL = CANONICAL_URL;
export const INDEXNOW_KEY = 'worklyindia2025indexnowkey';

/**
 * Submit URLs to IndexNow for faster indexing
 * Works with Bing, Yandex, and other supporting search engines
 */
export const submitToIndexNow = async (urls: string[]): Promise<boolean> => {
  if (!urls.length) return false;
  
  try {
    // Batch URLs in groups of 10000 (IndexNow limit)
    const batches = [];
    for (let i = 0; i < urls.length; i += 10000) {
      batches.push(urls.slice(i, i + 10000));
    }

    for (const batch of batches) {
      // Submit to Bing/Microsoft
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: CANONICAL_DOMAIN,
          key: INDEXNOW_KEY,
          keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
          urlList: batch
        }),
      });

      // Submit to Yandex
      await fetch('https://yandex.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: CANONICAL_DOMAIN,
          key: INDEXNOW_KEY,
          keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
          urlList: batch
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('IndexNow submission error:', error);
    return false;
  }
};

/**
 * Generate job URL for sitemap/indexing
 */
export const getJobUrl = (job: { id: string; slug?: string }): string => {
  return `${SITE_URL}/job/${job.slug || job.id}`;
};

/**
 * Generate blog URL for sitemap/indexing
 */
export const getBlogUrl = (post: { slug: string }): string => {
  return `${SITE_URL}/blog/${post.slug}`;
};

/**
 * Generate company URL for sitemap/indexing
 */
export const getCompanyUrl = (company: { id: string }): string => {
  return `${SITE_URL}/company/${company.id}`;
};

/**
 * Pages that should NOT be indexed
 */
export const NOINDEX_PATTERNS = [
  '/profile',
  '/settings',
  '/notifications',
  '/owner-portal',
  '/employer-portal',
  '/employer/',
  '/employer-settings',
  '/post-job',
  '/ai-assistant',
  '/company-dashboard',
  '/lead-management',
  '/admin',
  '/checkout',
  '/payment',
  '/verify-',
];

/**
 * Check if a path should be noindexed
 */
export const shouldNoIndex = (pathname: string): boolean => {
  return NOINDEX_PATTERNS.some(pattern => pathname.startsWith(pattern));
};

/**
 * Get proper robots meta content for a page
 */
export const getRobotsContent = (pathname: string, forceNoIndex = false): string => {
  if (forceNoIndex || shouldNoIndex(pathname)) {
    return 'noindex, follow';
  }
  return 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
};

/**
 * Priority pages for faster crawling
 */
export const HIGH_PRIORITY_PAGES = [
  '/',
  '/jobs',
  '/hot-leads',
  '/jobs-for-women',
  '/hiring-companies',
  '/blog',
  '/resume-builder',
  '/career-guidance',
];

/**
 * Get sitemap priority for a page
 */
export const getSitemapPriority = (pathname: string): number => {
  if (pathname === '/') return 1.0;
  if (HIGH_PRIORITY_PAGES.includes(pathname)) return 0.9;
  if (pathname.startsWith('/job/')) return 0.8;
  if (pathname.startsWith('/blog/')) return 0.7;
  if (pathname.startsWith('/company/')) return 0.6;
  return 0.5;
};

/**
 * Get change frequency for sitemap
 */
export const getChangeFrequency = (pathname: string): string => {
  if (pathname === '/jobs' || pathname === '/hot-leads') return 'hourly';
  if (pathname === '/' || pathname.startsWith('/job/')) return 'daily';
  if (pathname.startsWith('/blog')) return 'weekly';
  return 'monthly';
};

/**
 * Generate hreflang tags for multi-language support
 */
export const generateHreflangTags = (pathname: string) => {
  return [
    { hreflang: 'en-in', href: `${SITE_URL}${pathname}` },
    { hreflang: 'hi', href: `${SITE_URL}${pathname}` },
    { hreflang: 'x-default', href: `${SITE_URL}${pathname}` },
  ];
};

/**
 * Core Web Vitals optimization hints
 */
export const coreWebVitalsHints = {
  // LCP optimization
  lcpHints: [
    'Preload hero images',
    'Use responsive images with srcset',
    'Lazy load below-fold images',
    'Minimize server response time',
  ],
  // FID optimization
  fidHints: [
    'Minimize JavaScript execution time',
    'Break up long tasks',
    'Use web workers for heavy computation',
  ],
  // CLS optimization
  clsHints: [
    'Set explicit width/height on images',
    'Reserve space for dynamic content',
    'Avoid inserting content above existing content',
  ],
};
