import { Helmet } from 'react-helmet-async';
import { getOptimizedLogo } from '@/utils/performance';
import { useBrandAssets } from '@/hooks/useBrandAssets';
import { useSocialLinks } from '@/hooks/useSocialLinks';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { CANONICAL_URL } from '@/config/domainConfig';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  structured?: any;
  noindex?: boolean;
}

const SEO = ({ 
  title, 
  description, 
  keywords, 
  canonical, 
  image,
  type = 'website',
  structured,
  noindex = false
}: SEOProps) => {
  const brandAssets = useBrandAssets();
  const { socialLinks } = useSocialLinks();
   
  
  // Use brand OG image if available, otherwise use provided image or default
  const defaultImage = brandAssets.og_image_url || getOptimizedLogo('https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png', 512);
  const finalImage = image || defaultImage;
  
  const siteUrl = CANONICAL_URL;
  const fullTitle = title.includes(BRAND_CONFIG.name) ? title : `${title} | ${BRAND_CONFIG.name} - Remote Jobs`;
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : `${siteUrl}${window.location.pathname}`;
  const imageUrl = finalImage.startsWith('http') ? finalImage : `${siteUrl}${finalImage}`;
  
  // Get Twitter handle (remove @ if present)
  const twitterHandle = socialLinks.twitter?.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '');
  
  // Build social media profiles array for structured data
  const socialProfiles = Object.entries(socialLinks)
    .filter(([_, url]) => url && typeof url === 'string')
    .map(([_, url]) => url as string);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content={BRAND_CONFIG.name} />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <>
          <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
          <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
          <meta name="bingbot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        </>
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={`${fullTitle} - ${description}`} />
      <meta property="og:site_name" content={BRAND_CONFIG.name} />
      <meta property="og:locale" content="en_IN" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={imageUrl} />
      <meta property="twitter:image:alt" content={`${fullTitle} - ${description}`} />
      {twitterHandle && <meta property="twitter:site" content={`@${twitterHandle}`} />}
      {twitterHandle && <meta property="twitter:creator" content={`@${twitterHandle}`} />}
      
      {/* Geographic & Location Meta Tags */}
      <meta name="geo.region" content="IN" />
      <meta name="geo.country" content="India" />
      <meta name="geo.placename" content="India" />
      
      {/* Site Verification - Add your codes via environment variables */}
      {import.meta.env.VITE_GOOGLE_SITE_VERIFICATION && (
        <meta name="google-site-verification" content={import.meta.env.VITE_GOOGLE_SITE_VERIFICATION} />
      )}
      {import.meta.env.VITE_BING_SITE_VERIFICATION && (
        <meta name="msvalidate.01" content={import.meta.env.VITE_BING_SITE_VERIFICATION} />
      )}
      
      {/* Mobile Optimization - Zoom disabled */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      
      {/* Structured Data */}
      {structured && (
        <script type="application/ld+json">
          {JSON.stringify(structured)}
        </script>
      )}
      
      {/* Enhanced Organization Structured Data with Social Profiles */}
      {socialProfiles.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": brandAssets.brand_name || BRAND_CONFIG.name,
            "alternateName": "Workly India",
            "url": siteUrl,
            "logo": brandAssets.logo_url ? (brandAssets.logo_url.startsWith('http') ? brandAssets.logo_url : `${siteUrl}${brandAssets.logo_url}`) : undefined,
            "description": "India's premier platform connecting talented professionals with legitimate Workly India opportunities",
            "foundingDate": "2024-01-01",
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "+91-9904923067",
               "email": BRAND_CONFIG.supportEmail,
              "contactType": "customer service",
              "areaServed": "IN",
              "availableLanguage": ["Hindi", "English"]
            },
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Ahmedabad",
              "addressRegion": "Gujarat",
              "addressCountry": "IN"
            },
            "taxID": "UDYAM-GJ-18-0022888",
            "sameAs": socialProfiles
          })}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;