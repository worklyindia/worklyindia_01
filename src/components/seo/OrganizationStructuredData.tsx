import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { FOUNDER_NAME } from '@/lib/founderProfile.mjs';

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
    "description": "Workly India is an India-focused jobs and hiring platform where job seekers can explore remote and work-from-home opportunities and connect with employers.",
    "slogan": "India's Remote Jobs, Work From Home & Hiring Platform",
    "foundingDate": "2024",
    "founder": {
      "@type": "Person",
      "@id": `${SITE_URL.replace(/\/$/, '')}/#founder`,
      "name": FOUNDER_NAME,
      "jobTitle": "Founder & CEO",
      "url": `${SITE_URL.replace(/\/$/, '')}/about-us#founder`
    },
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
      "Work From Home Jobs in India",
      "Remote Hiring",
      "Employer Recruitment",
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
