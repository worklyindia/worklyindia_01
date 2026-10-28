import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

interface JobSearchSchemaProps {
  totalJobs?: number;
  category?: string;
  location?: string;
  brandName?: string;
}

/**
 * Structured Data for Job Search pages
 * Optimized for search queries like:
 * - "remote jobs India"
 * - "remote jobs India"
 * - "online jobs without investment"
 * - "data entry jobs from home"
 * - "customer support jobs remote"
 * - "part time jobs from home"
 */
export const JobSearchSchema = ({ 
  totalJobs, 
  category,
  location,
  brandName
}: JobSearchSchemaProps) => {
  const name = brandName || BRAND_CONFIG.name;
  const categoryText = category || "all categories";
  const locationText = location || "India";
  
  const jobSearchSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Remote Jobs in ${locationText}`,
    "description": `Browse ${totalJobs ? `${totalJobs.toLocaleString()} ` : ''}verified remote job opportunities in ${categoryText}. Find legitimate remote jobs, online jobs, and Remote positions in ${locationText}.`,
    "url": `${SITE_URL}/jobs`,
    ...(totalJobs ? { "numberOfItems": totalJobs } : {}),
    "itemListOrder": "https://schema.org/ItemListOrderDescending"
  };

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": `${name} - Remote Jobs Database`,
    "description": `Database of verified remote jobs in India. Updated daily with new remote job opportunities.`,
    "url": `${SITE_URL}/jobs`,
    "keywords": [
      "remote jobs",
      "remote jobs India",
      "Remote jobs",
      "online jobs India",
      "data entry jobs",
      "customer support jobs",
      "content writing jobs",
      "part time jobs from home",
      "freelance jobs India",
      "typing jobs from home"
    ],
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "creator": {
      "@type": "Organization",
      "name": name,
      "url": SITE_URL
    },
    "temporalCoverage": "2024/",
    "spatialCoverage": {
      "@type": "Place",
      "name": "India"
    },
    "isAccessibleForFree": true,
    ...(totalJobs ? { "variableMeasured": [{ "@type": "PropertyValue", "name": "Total Jobs", "value": totalJobs }] } : {}),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How to find genuine remote jobs in India?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${name} is India's trusted platform for verified remote jobs. All employers are verified and jobs are screened for authenticity. Browse our job listings and apply directly to companies.`
        }
      },
      {
        "@type": "Question",
        "name": "Are these remote jobs free to apply?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, all job applications on our platform are 100% free for job seekers. You never have to pay to apply for any job listed on our website."
        }
      },
      {
        "@type": "Question",
        "name": "What types of remote jobs are available?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We offer various Remote jobs including Data Entry, Customer Support, Content Writing, Digital Marketing, Software Development, Virtual Assistant, Graphic Design, Teaching, Sales, and many more."
        }
      },
      {
        "@type": "Question",
        "name": "How to post jobs on this platform?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Employers can post jobs by registering on our Employer Portal. The first job posting is FREE. Simply create an account, complete your company profile, and start posting jobs within minutes."
        }
      }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(jobSearchSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(datasetSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>
    </Helmet>
  );
};

export default JobSearchSchema;
