// SEO Helper utilities for Google Search Console optimization
import { BRAND_CONFIG } from '@/config/brandConfig';
import { CANONICAL_URL } from '@/config/domainConfig';

export const SITE_URL = CANONICAL_URL;
export const SITE_NAME = BRAND_CONFIG.name;
export const DEFAULT_LOGO = 'https://worklyindia.devs.surf/icons/icon-512x512.png';
// Generate canonical URL
export const getCanonicalUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
};

// Generate structured data for a page
export const generatePageSchema = (
  title: string,
  description: string,
  url: string,
  type: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'FAQPage' = 'WebPage'
) => {
  return {
    "@context": "https://schema.org",
    "@type": type,
    "name": title,
    "description": description,
    "url": url.startsWith('http') ? url : getCanonicalUrl(url),
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}${DEFAULT_LOGO}`
      }
    }
  };
};

// Generate job posting schema
export const generateJobSchema = (job: {
  id: string;
  title: string;
  description: string;
  company: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  job_type?: string;
  created_at?: string;
  expires_at?: string;
  is_remote?: boolean;
}) => {
  const employmentTypeMap: Record<string, string> = {
    'full_time': 'FULL_TIME',
    'part_time': 'PART_TIME',
    'contract': 'CONTRACT',
    'freelance': 'CONTRACT',
    'internship': 'INTERN',
    'temporary': 'TEMPORARY'
  };

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": job.title,
    "description": job.description,
    "identifier": {
      "@type": "PropertyValue",
      "name": SITE_NAME,
      "value": job.id
    },
    "datePosted": job.created_at ? new Date(job.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    "validThrough": job.expires_at ? new Date(job.expires_at).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    "employmentType": employmentTypeMap[job.job_type?.toLowerCase() || ''] || 'FULL_TIME',
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company,
      "sameAs": SITE_URL,
      "logo": `${SITE_URL}${DEFAULT_LOGO}`
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location || 'Remote',
        "addressCountry": "IN"
      }
    },
    ...(job.is_remote !== false && {
      "jobLocationType": "TELECOMMUTE",
      "applicantLocationRequirements": {
        "@type": "Country",
        "name": "India"
      }
    }),
    ...((job.salary_min || job.salary_max) && {
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "INR",
        "value": {
          "@type": "QuantitativeValue",
          "minValue": job.salary_min,
          "maxValue": job.salary_max,
          "unitText": "MONTH"
        }
      }
    })
  };
};

// Generate breadcrumb schema
export const generateBreadcrumbs = (items: { name: string; path: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": getCanonicalUrl(item.path)
    }))
  };
};

// SEO-friendly slug generation
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Meta tag generation for dynamic pages
export const generateMetaTags = (
  title: string,
  description: string,
  keywords?: string[],
  image?: string
) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const truncatedDescription = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;
  
  return {
    title: fullTitle,
    description: truncatedDescription,
    keywords: keywords?.join(', ') || '',
    image: image?.startsWith('http') ? image : `${SITE_URL}${image || DEFAULT_LOGO}`,
    siteName: SITE_NAME,
    siteUrl: SITE_URL
  };
};

// Pages that should have noindex
export const NOINDEX_PAGES = [
  '/profile',
  '/settings',
  '/notifications',
  '/owner-portal',
  '/employer-portal',
  '/company-dashboard',
  '/lead-management',
  '/admin'
];

// Check if page should be noindexed
export const shouldNoindex = (pathname: string): boolean => {
  return NOINDEX_PAGES.some(page => pathname.startsWith(page));
};

// Generate robots meta content
export const getRobotsMeta = (pathname: string, options?: { noindex?: boolean; nofollow?: boolean }): string => {
  if (options?.noindex || shouldNoindex(pathname)) {
    return options?.nofollow ? 'noindex, nofollow' : 'noindex, follow';
  }
  return 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
};

// Priority pages for faster indexing
export const HIGH_PRIORITY_PAGES = [
  '/',
  '/jobs',
  '/hot-leads',
  '/jobs-for-women',
  '/hiring-companies',
  '/blog'
];

// Get page priority for sitemap
export const getPagePriority = (pathname: string): string => {
  if (pathname === '/') return '1.0';
  if (HIGH_PRIORITY_PAGES.includes(pathname)) return '0.9';
  if (pathname.startsWith('/job/')) return '0.8';
  if (pathname.startsWith('/blog/')) return '0.7';
  return '0.6';
};

// Get change frequency for sitemap
export const getChangeFrequency = (pathname: string): string => {
  if (pathname === '/jobs' || pathname === '/hot-leads') return 'hourly';
  if (pathname === '/' || pathname.startsWith('/job/')) return 'daily';
  if (pathname.startsWith('/blog')) return 'weekly';
  return 'monthly';
};
