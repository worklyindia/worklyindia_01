import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

interface WebsiteSchemaProps {
  pageTitle?: string;
  pageDescription?: string;
  pageUrl?: string;
  brandName?: string;
}

/**
 * Generates comprehensive Website schema for better Google indexing
 * Includes Organization, WebSite, and SearchAction schemas
 */
export const WebsiteSchema = ({
  pageTitle,
  pageDescription,
  pageUrl,
  brandName
}: WebsiteSchemaProps) => {
  const name = brandName || BRAND_CONFIG.name;
  const schema = [
    // WebSite Schema with SearchAction for Sitelinks Search Box
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": name,
      "alternateName": ["Workly India", "Workly", "Workly India Jobs"],
      "url": CANONICAL_URL,
      "description": "India's #1 platform for verified remote jobs. 100% FREE for job seekers.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${CANONICAL_URL}/jobs?search={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      },
      "publisher": {
        "@type": "Organization",
        "name": name,
        "logo": {
          "@type": "ImageObject",
          "url": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
          "width": 512,
          "height": 512
        }
      }
    },
    // BreadcrumbList for better navigation in search results
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": CANONICAL_URL
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Jobs",
          "item": `${CANONICAL_URL}/jobs`
        }
      ]
    },
    // Organization with verified business details
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": name,
      "legalName": name,
      "url": CANONICAL_URL,
      "logo": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
      "foundingDate": "2024",
      "founders": [
        {
          "@type": "Person",
          "name": "Workly India Team"
        }
      ],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "India",
        "addressLocality": "India",
        "addressCountry": "IN"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-9904923067",
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": ["English", "Hindi", "Gujarati"]
      },
      "sameAs": [
        "https://www.facebook.com/share/1Jj9yDRirA/",
        "https://www.instagram.com/worklyindiaofficial",
        "https://youtube.com/@worklyindiaofficial",
        "https://x.com/worklyindia",
        "https://t.me/WorklyIndia",
      "https://maps.google.com/maps?cid=6183675393057517431"
      ],
      // Government verification - builds trust
      "identifier": {
        "@type": "PropertyValue",
        "name": "UDYAM Registration Number",
        "value": "UDYAM-GJ-18-0022888"
      }
    }
  ];

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default WebsiteSchema;
