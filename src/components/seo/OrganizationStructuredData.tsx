import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

interface OrganizationStructuredDataProps {
  brandName?: string;
}

export const OrganizationStructuredData = ({ brandName }: OrganizationStructuredDataProps = {}) => {
  const name = brandName || BRAND_CONFIG.name;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": name,
    "alternateName": BRAND_CONFIG.alternateName,
    "url": SITE_URL,
    "@id": `${SITE_URL.replace(/\/$/, '')}/#organization`,
    "logo": `${SITE_URL.replace(/\/$/, '')}/workly-india-logo.png`,
    "description": "India's leading platform connecting job seekers with legitimate Workly India opportunities. We verify employers and ensure quality remote job listings.",
    "foundingDate": "2024",
    "founders": [
      {
        "@type": "Person",
        "name": `${name} Team`
      }
    ],
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN",
      "addressLocality": BRAND_CONFIG.location
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": BRAND_CONFIG.email,
        "availableLanguage": ["English", "Hindi"]
      }
    ],
    "sameAs": [
      "https://www.facebook.com/share/1Jj9yDRirA/",
      "https://www.instagram.com/worklyindiaofficial",
      "https://youtube.com/@worklyindiaofficial",
      "https://x.com/worklyindia",
      "https://t.me/WorklyIndia",
    "https://maps.google.com/maps?cid=6183675393057517431"
    ],
    "knowsAbout": [
      "Workly India",
      "Remote Jobs",
      "Freelancing",
      "Career Development",
      "Resume Building",
      "Interview Preparation"
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default OrganizationStructuredData;
