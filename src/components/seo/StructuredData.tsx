import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

interface JobPostingSchemaProps {
  title: string;
  description: string;
  company: string;
  location?: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  };
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERN' | 'VOLUNTEER' | 'OTHER';
  datePosted?: string;
  validThrough?: string;
  workFromHome?: boolean;
  jobId?: string;
}

export const JobPostingSchema = ({
  title,
  description,
  company,
  location = 'Remote, India',
  salary,
  employmentType = 'FULL_TIME',
  datePosted,
  validThrough,
  workFromHome = true,
  jobId
}: JobPostingSchemaProps) => {
  const siteUrl = CANONICAL_URL;
  
  const schema = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": title,
    "description": description,
    "identifier": {
      "@type": "PropertyValue",
      "name": BRAND_CONFIG.name,
      "value": jobId || title.replace(/\s+/g, '-').toLowerCase()
    },
    "datePosted": datePosted || new Date().toISOString().split('T')[0],
    "validThrough": validThrough || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    "employmentType": employmentType,
    "hiringOrganization": {
      "@type": "Organization",
      "name": company,
      "sameAs": siteUrl,
      "logo": `https://worklyindia.devs.surf/icons/icon-512x512.png`
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": location,
        "addressCountry": "IN"
      }
    },
    "jobLocationType": workFromHome ? "TELECOMMUTE" : undefined,
    "applicantLocationRequirements": workFromHome ? {
      "@type": "Country",
      "name": "India"
    } : undefined,
    ...(salary && {
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": salary.currency || "INR",
        "value": {
          "@type": "QuantitativeValue",
          "minValue": salary.min,
          "maxValue": salary.max,
          "unitText": salary.period || "MONTH"
        }
      }
    })
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
}

export const FAQSchema = ({ faqs }: FAQSchemaProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface ArticleSchemaProps {
  title: string;
  description: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  url?: string;
}

export const ArticleSchema = ({
  title,
  description,
  author = `${BRAND_CONFIG.name} Team`,
  datePublished,
  dateModified,
  image,
  url
}: ArticleSchemaProps) => {
  const siteUrl = CANONICAL_URL;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": BRAND_CONFIG.name,
      "logo": {
        "@type": "ImageObject",
        "url": `https://worklyindia.devs.surf/icons/icon-512x512.png`
      }
    },
    "datePublished": datePublished || new Date().toISOString(),
    "dateModified": dateModified || new Date().toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url || siteUrl
    },
    "image": image || `https://worklyindia.devs.surf/icons/icon-512x512.png`
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

interface HowToSchemaProps {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTime?: string;
  image?: string;
}

export const HowToSchema = ({
  name,
  description,
  steps,
  totalTime = 'PT10M',
  image
}: HowToSchemaProps) => {
  const siteUrl = CANONICAL_URL;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    "totalTime": totalTime,
    "image": image || `https://worklyindia.devs.surf/icons/icon-512x512.png`,
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      "image": step.image
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

export const BreadcrumbSchema = ({ items }: BreadcrumbSchemaProps) => {
  const siteUrl = CANONICAL_URL;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface LocalBusinessSchemaProps {
  name?: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  openingHours?: string[];
  priceRange?: string;
  image?: string;
}

export const LocalBusinessSchema = ({
  name = BRAND_CONFIG.name,
  description = "India's premier platform for remote jobs and remote opportunities",
  telephone = BRAND_CONFIG.phone,
  email = BRAND_CONFIG.email,
  address = {
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'IN'
  },
  openingHours = ['Mo-Sa 09:00-18:00'],
  priceRange = 'Free',
  image
}: LocalBusinessSchemaProps) => {
  const siteUrl = CANONICAL_URL;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": name,
    "description": description,
    "url": siteUrl,
    "telephone": telephone,
    "email": email,
    "image": image || `https://worklyindia.devs.surf/icons/icon-512x512.png`,
    "logo": `https://worklyindia.devs.surf/icons/icon-512x512.png`,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": address.street,
      "addressLocality": address.city,
      "addressRegion": address.state,
      "postalCode": address.postalCode,
      "addressCountry": address.country
    },
    "openingHoursSpecification": openingHours.map(hours => {
      const [days, times] = hours.split(' ');
      const [opens, closes] = times?.split('-') || ['09:00', '18:00'];
      return {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": days.split('-').map(d => {
          const dayMap: Record<string, string> = {
            'Mo': 'Monday', 'Tu': 'Tuesday', 'We': 'Wednesday',
            'Th': 'Thursday', 'Fr': 'Friday', 'Sa': 'Saturday', 'Su': 'Sunday'
          };
          return dayMap[d] || d;
        }),
        "opens": opens,
        "closes": closes
      };
    }),
    "priceRange": priceRange,
    "sameAs": [
      "https://www.facebook.com/share/1Jj9yDRirA/",
      "https://www.instagram.com/worklyindiaofficial",
      "https://youtube.com/@worklyindiaofficial",
      "https://x.com/WorklyIndia",
      "https://t.me/WorklyIndia",
    "https://maps.google.com/maps?cid=6183675393057517431"
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

// Export all schemas as default object for convenience
const StructuredData = {
  JobPosting: JobPostingSchema,
  FAQ: FAQSchema,
  Article: ArticleSchema,
  HowTo: HowToSchema,
  Breadcrumb: BreadcrumbSchema,
  LocalBusiness: LocalBusinessSchema
};

export default StructuredData;
