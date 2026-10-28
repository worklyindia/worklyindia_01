// Sitemap generation utilities for SEO - Updated for Google Indexing & Virality

import { CANONICAL_URL } from '@/config/domainConfig';

// Job categories for SEO landing pages
export const JOB_CATEGORIES = [
  { slug: 'data-entry', name: 'Data Entry', priority: '0.9' },
  { slug: 'customer-support', name: 'Customer Support', priority: '0.9' },
  { slug: 'content-writing', name: 'Content Writing', priority: '0.9' },
  { slug: 'virtual-assistant', name: 'Virtual Assistant', priority: '0.85' },
  { slug: 'graphic-design', name: 'Graphic Design', priority: '0.85' },
  { slug: 'social-media', name: 'Social Media', priority: '0.85' },
  { slug: 'accounting', name: 'Accounting & Finance', priority: '0.8' },
  { slug: 'teaching', name: 'Online Teaching', priority: '0.85' },
  { slug: 'translation', name: 'Translation', priority: '0.8' },
  { slug: 'telecalling', name: 'Telecalling & BPO', priority: '0.85' },
  { slug: 'web-development', name: 'Web Development', priority: '0.85' },
  { slug: 'digital-marketing', name: 'Digital Marketing', priority: '0.85' },
];

// Top cities for SEO landing pages
export const TOP_LOCATIONS = [
  { slug: 'mumbai', name: 'Mumbai', priority: '0.85' },
  { slug: 'delhi', name: 'Delhi', priority: '0.85' },
  { slug: 'bangalore', name: 'Bangalore', priority: '0.85' },
  { slug: 'hyderabad', name: 'Hyderabad', priority: '0.8' },
  { slug: 'chennai', name: 'Chennai', priority: '0.8' },
  { slug: 'pune', name: 'Pune', priority: '0.8' },
  { slug: 'kolkata', name: 'Kolkata', priority: '0.8' },
  { slug: 'ahmedabad', name: 'Ahmedabad', priority: '0.8' },
  { slug: 'jaipur', name: 'Jaipur', priority: '0.75' },
  { slug: 'lucknow', name: 'Lucknow', priority: '0.75' },
];

export const generateSitemap = (dynamicJobUrls?: { url: string; lastmod: string }[]) => {
  const baseUrl = CANONICAL_URL;
  const currentDate = new Date().toISOString();

  const staticPages = [
    { url: '/', priority: '1.0', changeFreq: 'daily' },
    { url: '/jobs', priority: '0.95', changeFreq: 'hourly' },
    { url: '/hot-leads', priority: '0.9', changeFreq: 'hourly' },
    { url: '/all-leads', priority: '0.85', changeFreq: 'daily' },
    { url: '/jobs-for-women', priority: '0.85', changeFreq: 'daily' },
    { url: '/about-us', priority: '0.7', changeFreq: 'monthly' },
    { url: '/contact-us', priority: '0.7', changeFreq: 'monthly' },
    { url: '/faq', priority: '0.65', changeFreq: 'weekly' },
    { url: '/blog', priority: '0.85', changeFreq: 'daily' },
    { url: '/career-guidance', priority: '0.8', changeFreq: 'weekly' },
    { url: '/interview-tips', priority: '0.8', changeFreq: 'weekly' },
    { url: '/resume-builder', priority: '0.85', changeFreq: 'monthly' },
    { url: '/skill-assessment', priority: '0.75', changeFreq: 'monthly' },
    { url: '/company-directory', priority: '0.8', changeFreq: 'weekly' },
    { url: '/hiring-companies', priority: '0.85', changeFreq: 'daily' },
    { url: '/help-center', priority: '0.65', changeFreq: 'monthly' },
    { url: '/our-services', priority: '0.75', changeFreq: 'monthly' },
    { url: '/recruitment-solutions', priority: '0.7', changeFreq: 'monthly' },
    { url: '/free-job-alerts', priority: '0.8', changeFreq: 'weekly' },
    // Employer pages - HIGH PRIORITY for Google Indexing
    { url: '/employer-portal', priority: '0.8', changeFreq: 'daily' },
    { url: '/post-job', priority: '0.8', changeFreq: 'weekly' },
    { url: '/employer/referral', priority: '0.8', changeFreq: 'daily' },
    { url: '/employer/monthly-competition', priority: '0.8', changeFreq: 'daily' },
    { url: '/employer/interviews', priority: '0.8', changeFreq: 'hourly' },
    { url: '/employer-auth', priority: '0.7', changeFreq: 'weekly' },
    // AI Assistant - HIGH PRIORITY
    { url: '/ai-assistant', priority: '0.85', changeFreq: 'daily' },
    { url: '/ai-assistant?tab=ai-chat', priority: '0.8', changeFreq: 'daily' },
    // Tab-based routes
    { url: '/jobs/trending', priority: '0.9', changeFreq: 'hourly' },
    { url: '/jobs/latest', priority: '0.9', changeFreq: 'hourly' },
    { url: '/jobs/featured', priority: '0.85', changeFreq: 'daily' },
    // Other pages
    { url: '/how-it-works', priority: '0.7', changeFreq: 'monthly' },
    { url: '/career-tricks', priority: '0.7', changeFreq: 'weekly' },
    { url: '/reviews', priority: '0.65', changeFreq: 'weekly' },
    { url: '/install', priority: '0.5', changeFreq: 'monthly' },
    { url: '/quick-access', priority: '0.6', changeFreq: 'weekly' },
    { url: '/were-hiring', priority: '0.6', changeFreq: 'weekly' },
    { url: '/team-diary', priority: '0.5', changeFreq: 'weekly' },
    { url: '/case-studies', priority: '0.6', changeFreq: 'monthly' },
    { url: '/college-tpo', priority: '0.6', changeFreq: 'monthly' },
    { url: '/hire-interns', priority: '0.6', changeFreq: 'monthly' },
    { url: '/press-kit', priority: '0.5', changeFreq: 'monthly' },
    // Legal & Auth pages
    { url: '/terms-conditions', priority: '0.4', changeFreq: 'yearly' },
    { url: '/privacy', priority: '0.4', changeFreq: 'yearly' },
    { url: '/disclaimer', priority: '0.4', changeFreq: 'yearly' },
    { url: '/job-policy', priority: '0.4', changeFreq: 'yearly' },
    { url: '/refund-policy', priority: '0.4', changeFreq: 'yearly' },
    { url: '/sitemap', priority: '0.5', changeFreq: 'weekly' },
    { url: '/auth', priority: '0.6', changeFreq: 'monthly' }
  ];

  // Add category landing pages for SEO
  const categoryPages = JOB_CATEGORIES.map(cat => ({
    url: `/jobs/category/${cat.slug}`,
    priority: cat.priority,
    changeFreq: 'daily'
  }));

  // Add location landing pages for SEO
  const locationPages = TOP_LOCATIONS.map(loc => ({
    url: `/jobs/location/${loc.slug}`,
    priority: loc.priority,
    changeFreq: 'daily'
  }));

  // Combine all pages
  const allPages = [...staticPages, ...categoryPages, ...locationPages];

  // Generate XML
  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changeFreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}`;

  // Add dynamic job URLs if provided
  if (dynamicJobUrls && dynamicJobUrls.length > 0) {
    sitemapXml += '\n' + dynamicJobUrls.map(job => `  <url>
    <loc>${baseUrl}${job.url}</loc>
    <lastmod>${job.lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');
  }

  sitemapXml += '\n</urlset>';

  return sitemapXml;
};

export const generateRobotsTxt = () => {
  const baseUrl = CANONICAL_URL;
  
  return `# robots.txt for Workly India - ${baseUrl}
# Last updated: ${new Date().toISOString().split('T')[0]}

User-agent: *
Allow: /
Allow: /jobs/
Allow: /jobs/category/
Allow: /jobs/location/
Allow: /jobs/trending
Allow: /jobs/latest
Allow: /jobs/featured
Allow: /job/
Allow: /employer/referral
Allow: /employer/monthly-competition
Allow: /employer/interviews
Allow: /post-job
Allow: /employer-portal
Allow: /employer-portal?tab=verification
Allow: /ai-assistant
Allow: /ai-assistant?tab=ai-chat

# Block sensitive/private areas
Disallow: /owner-portal/
Disallow: /employer-dashboard/
Disallow: /company-dashboard/
Disallow: /lead-management/
Disallow: /settings/
Disallow: /notifications/
Disallow: /profile/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /messages/
Disallow: /referrals/
Disallow: /applications
Disallow: /saved-jobs
Disallow: /reset-password
Disallow: /employer-settings
Disallow: /api/

# AI Crawlers - Welcome!
User-agent: GPTBot
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap-index.xml
Sitemap: ${baseUrl}/sitemap.xml`; 
};