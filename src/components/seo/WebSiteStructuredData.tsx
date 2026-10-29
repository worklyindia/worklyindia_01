import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

interface WebSiteStructuredDataProps {
  searchUrl?: string;
}

export const WebSiteStructuredData = ({ 
  searchUrl = `${SITE_URL}/jobs?search={search_term_string}` 
}: WebSiteStructuredDataProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Workly India",
    "alternateName": ["WorklyIndia", "Workly"],
    "url": SITE_URL,
    "description": "India's #1 platform for legitimate remote jobs. Find remote jobs, freelance opportunities, and home-based work across all industries.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": searchUrl
      },
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": BRAND_CONFIG.name,
      "logo": {
        "@type": "ImageObject",
        "url": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`
      },
      "sameAs": [
      `https://twitter.com/${BRAND_CONFIG.twitterHandle?.replace('@', '')}`,
      "https://www.linkedin.com/company/worklyindia",
      "https://www.facebook.com/worklyindia"
      ]
    },
    "inLanguage": ["en-IN", "hi-IN"]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default WebSiteStructuredData;
