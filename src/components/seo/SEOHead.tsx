import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;
const SITE_NAME = BRAND_CONFIG.name;
const TWITTER_HANDLE = '@WorklyIndia';
const DEFAULT_IMAGE = 'https://worklyindia.devs.surf/icons/icon-512x512.png';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  canonical?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  brandName?: string;
}

export const SEOHead = ({
  title,
  description,
  keywords = [],
  image,
  type = 'website',
  noindex = false,
  canonical,
  publishedTime,
  modifiedTime,
  author,
  section,
  brandName
}: SEOHeadProps) => {
  const siteName = brandName || SITE_NAME;
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Generate proper title
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  
  // Truncate description to 160 chars
  const metaDescription = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;
  
  // Generate canonical URL
  const canonicalUrl = canonical 
    ? (canonical.startsWith('http') ? canonical : `${SITE_URL}${canonical}`)
    : `${SITE_URL}${currentPath}`;
  
  // Generate image URL
  const imageUrl = image 
    ? (image.startsWith('http') ? image : `${SITE_URL}${image}`)
    : `${SITE_URL}${DEFAULT_IMAGE}`;

  // Determine robots meta
  const robotsContent = noindex 
    ? 'noindex, follow' 
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  // Default keywords for the site
  const defaultKeywords = [
    'Workly India',
    'remote jobs India',
    'Remote jobs',
    'online jobs India',
    'Workly India',
    'remote jobs'
  ];
  
  const allKeywords = [...new Set([...keywords, ...defaultKeywords])].slice(0, 10);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={allKeywords.join(', ')} />
      
      {/* Robots */}
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      <meta name="bingbot" content={robotsContent} />
      
      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Language & Hreflang for Multilingual SEO */}
      <meta name="language" content="English, Hindi" />
      <meta httpEquiv="content-language" content="en-IN, hi-IN" />
      
      {/* Dynamic Hreflang Tags */}
      <link rel="alternate" hrefLang="en-in" href={canonicalUrl} />
      <link rel="alternate" hrefLang="hi" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      
      {/* Geo */}
      <meta name="geo.region" content="IN" />
      <meta name="geo.placename" content="India" />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_IN" />
      
      {/* Article specific */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={fullTitle} />
      
      {/* Mobile */}
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      
      {/* RSS Feed Auto-Discovery */}
      <link rel="alternate" type="application/rss+xml" title={`${siteName} - All Content`} href={`${SITE_URL}/feed.xml`} />
      <link rel="alternate" type="application/rss+xml" title={`${siteName} - Jobs`} href={`${SITE_URL}/rss/jobs.xml`} />
      <link rel="alternate" type="application/rss+xml" title={`${siteName} - Blog`} href={`${SITE_URL}/rss/blog.xml`} />
    </Helmet>
  );
};

export default SEOHead;
