import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  getCanonicalUrl, 
  shouldNoindex, 
  getRobotsMeta,
  generateMetaTags 
} from '@/utils/seoHelpers';

interface UseDynamicSEOOptions {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  noindex?: boolean;
  canonical?: string;
}

/**
 * Hook for dynamic SEO management
 * Automatically updates meta tags based on current route
 */
export const useDynamicSEO = (options: UseDynamicSEOOptions) => {
  const location = useLocation();
  const pathname = options.canonical || location.pathname;
  
  useEffect(() => {
    const meta = generateMetaTags(
      options.title,
      options.description,
      options.keywords,
      options.image
    );
    
    // Update document title
    document.title = meta.title;
    
    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attr}="${name}"]`);
      
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      
      tag.setAttribute('content', content);
    };
    
    // Standard meta tags
    updateMetaTag('description', meta.description);
    if (options.keywords?.length) {
      updateMetaTag('keywords', options.keywords.join(', '));
    }
    
    // Robots meta
    const robotsContent = getRobotsMeta(pathname, { noindex: options.noindex || shouldNoindex(pathname) });
    updateMetaTag('robots', robotsContent);
    updateMetaTag('googlebot', robotsContent);
    
    // Open Graph tags
    updateMetaTag('og:title', meta.title, true);
    updateMetaTag('og:description', meta.description, true);
    updateMetaTag('og:image', meta.image, true);
    updateMetaTag('og:url', getCanonicalUrl(pathname), true);
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('og:site_name', meta.siteName, true);
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', meta.title);
    updateMetaTag('twitter:description', meta.description);
    updateMetaTag('twitter:image', meta.image);
    
    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', getCanonicalUrl(pathname));
    
  }, [options, pathname]);
  
  return {
    canonicalUrl: getCanonicalUrl(pathname),
    isNoindex: options.noindex || shouldNoindex(pathname)
  };
};

/**
 * Hook to track page views for SEO analytics
 */
export const usePageViewTracking = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Track page view with Google Analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_title: document.title
      });
    }
    
    // Track with dataLayer for GTM
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: 'pageview',
        page: {
          path: location.pathname,
          search: location.search,
          title: document.title
        }
      });
    }
  }, [location]);
};

export default useDynamicSEO;
