import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

/**
 * Structured Data for Employer/Recruiter pages
 * Optimized for search queries like:
 * - "post job online India"
 * - "job posting sites India"
 * - "hire employees online"
 * - "free job posting India"
 * - "recruitment platform India"
 */
interface EmployerJobPostingSchemaProps {
  brandName?: string;
}

export const EmployerJobPostingSchema = ({ brandName }: EmployerJobPostingSchemaProps = {}) => {
  const name = brandName || BRAND_CONFIG.name;
  const employerServiceSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": `${name} Employer Portal`,
    "alternateName": [
      "Post Jobs Online India",
      "Free Job Posting Platform",
      "Hire Remote Professionals India"
    ],
    "description": "Free job posting platform for employers in India. Post remote jobs, hire remote employees, and find qualified candidates. No registration fees for first job posting.",
    "url": `${SITE_URL}/employer-portal`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR",
      "description": "Free job posting for employers"
    },
    "featureList": [
      "Free job posting",
      "Verified candidate profiles",
      "Direct messaging with candidates",
      "Application tracking system",
      "Company profile page",
      "Job analytics dashboard",
      "Multiple job categories",
      "Remote job posting",
      "Bulk hiring support"
    ],
    "provider": {
      "@type": "Organization",
      "name": name,
      "url": SITE_URL
    }
  };

  const employmentAgencySchema = {
    "@context": "https://schema.org",
    "@type": "EmploymentAgency",
    "name": name,
    "alternateName": "Workly India Job Portal",
    "description": "India's #1 remote job portal. Connect with verified employers, find remote jobs, and hire talented professionals for your company.",
    "url": SITE_URL,
    "logo": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN"
    },
    "areaServed": {
      "@type": "Country",
      "name": "India"
    },
    "serviceType": [
      "Job Posting",
      "Recruitment Services",
      "Remote Hiring",
      "Remote Jobs",
      "Freelance Hiring"
    ],
    "priceRange": "₹0 - ₹5000",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Employer Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Free Job Posting",
            "description": "Post your first job absolutely free"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Premium Job Boost",
            "description": "Get your job listing featured at the top"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Verified Company Badge",
            "description": "Get verified badge for your company profile"
          }
        }
      ]
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(employerServiceSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(employmentAgencySchema)}
      </script>
    </Helmet>
  );
};

export default EmployerJobPostingSchema;
