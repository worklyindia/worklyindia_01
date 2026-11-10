// Google Search Console Ping utility
// Helps notify Google of new content for faster indexing

import { CANONICAL_URL } from '@/config/domainConfig';

const SITE_URL = CANONICAL_URL;

/**
 * Ping Google with updated sitemap
 * Note: This is a best-effort notification - Google may not immediately crawl
 */
export const pingGoogleSitemap = async (): Promise<boolean> => {
  const sitemapUrl = `${SITE_URL}/sitemap-index.xml`;
  const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  
  try {
    // Note: This will likely be blocked by CORS in browser
    // Best used from server-side or through Google Search Console API
    const response = await fetch(pingUrl, { mode: 'no-cors' });
    console.log('Google sitemap ping sent');
    return true;
  } catch (error) {
    console.warn('Could not ping Google sitemap:', error);
    return false;
  }
};

/**
 * Ping Bing with updated sitemap
 */
export const pingBingSitemap = async (): Promise<boolean> => {
  const sitemapUrl = `${SITE_URL}/sitemap-index.xml`;
  const pingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  
  try {
    const response = await fetch(pingUrl, { mode: 'no-cors' });
    console.log('Bing sitemap ping sent');
    return true;
  } catch (error) {
    console.warn('Could not ping Bing sitemap:', error);
    return false;
  }
};

/**
 * Request indexing for a specific URL
 * Note: For actual indexing requests, use Google Search Console API
 */
export const requestIndexing = (url: string): void => {
  const fullUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;
  
  // Log for manual submission guidance
  console.log(`To request indexing for: ${fullUrl}`);
  console.log('1. Go to Google Search Console');
  console.log('2. Enter the URL in the inspection tool');
  console.log('3. Click "Request Indexing"');
};

/**
 * Generate URLs for IndexNow API (Bing, Yandex)
 * IndexNow provides instant indexing notification
 */
export const generateIndexNowPayload = (urls: string[], key: string) => {
  return {
    host: new URL(SITE_URL).hostname,
    key: key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList: urls.map(url => url.startsWith('http') ? url : `${SITE_URL}${url}`)
  };
};

/**
 * Common crawl errors and their solutions
 */
export const CRAWL_ERROR_SOLUTIONS: Record<string, string> = {
  '404': 'Page not found - Create the page or add a redirect to the correct URL',
  '403': 'Access forbidden - Check server permissions and robots.txt',
  '500': 'Server error - Check server logs and fix backend issues',
  '503': 'Service unavailable - Server overloaded, consider scaling',
  'soft404': 'Page exists but appears empty - Add meaningful content',
  'redirect': 'Too many redirects - Simplify redirect chain to max 2 hops',
  'blocked': 'Blocked by robots.txt - Update robots.txt to allow crawling',
  'timeout': 'Server timeout - Optimize server response time',
  'mobile': 'Mobile usability issues - Ensure responsive design'
};

/**
 * SEO checklist for Google Search Console
 */
export const GSC_CHECKLIST = {
  verification: [
    'HTML meta tag verification added',
    'DNS TXT record verification (backup)',
    'Google verification file in public folder'
  ],
  sitemap: [
    'sitemap-index.xml submitted',
    'sitemap.xml for static pages',
    'jobs-sitemap.xml for job listings',
    'blog-sitemap.xml for blog posts',
    'No duplicate URLs in sitemaps'
  ],
  indexing: [
    'Canonical URLs on all pages',
    'Noindex on private pages',
    'No broken internal links',
    'Proper 301 redirects for old URLs'
  ],
  performance: [
    'Core Web Vitals optimized',
    'Mobile-friendly design',
    'Fast page load times',
    'Proper image optimization'
  ],
  structuredData: [
    'Organization schema on homepage',
    'JobPosting schema on job pages',
    'BreadcrumbList schema for navigation',
    'FAQPage schema where applicable'
  ]
};

export default {
  pingGoogleSitemap,
  pingBingSitemap,
  requestIndexing,
  generateIndexNowPayload,
  CRAWL_ERROR_SOLUTIONS,
  GSC_CHECKLIST
};
