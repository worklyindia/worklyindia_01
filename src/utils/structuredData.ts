// Structured Data Helpers for Google Search Console
import { optimizeImage } from '@/utils/performance';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { CANONICAL_URL } from '@/config/domainConfig';

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": BRAND_CONFIG.name,
  "alternateName": BRAND_CONFIG.alternateName,
  "url": CANONICAL_URL,
  "description": "India's leading platform for remote jobs and remote opportunities",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${CANONICAL_URL}/jobs?search={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  },
  "sameAs": [
    "https://www.facebook.com/share/1Jj9yDRirA/",
    "https://www.instagram.com/worklyindiaofficial",
    "https://youtube.com/@worklyindiaofficial",
    "https://x.com/worklyindia",
    "https://t.me/WorklyIndia",
  "https://maps.google.com/maps?cid=6183675393057517431"
  ]
};

export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": BRAND_CONFIG.name,
  "alternateName": BRAND_CONFIG.alternateName,
  "url": CANONICAL_URL,
  "logo": optimizeImage("https://worklyindia.devs.surf/icons/icon-512x512.png", 512, 85, 'webp'),
  "description": "India's premier platform connecting talented professionals with legitimate Workly India opportunities. Verified employers, genuine jobs, and trusted by thousands of job seekers across India.",
  "foundingDate": "2024-01-01",
  "founders": [{
    "@type": "Person",
    "name": `${BRAND_CONFIG.name} Team`
  }],
  "contactPoint": [{
    "@type": "ContactPoint",
    "telephone": BRAND_CONFIG.phone,
    "email": BRAND_CONFIG.supportEmail,
    "contactType": "customer service",
    "areaServed": "IN",
    "availableLanguage": ["Hindi", "English"],
    "contactOption": "TollFree"
  }],
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Ahmedabad",
    "addressRegion": "Gujarat",
    "addressCountry": "IN",
    "postalCode": "380001"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 23.0225,
    "longitude": 72.5714
  },
  "legalName": BRAND_CONFIG.name,
  "taxID": BRAND_CONFIG.udyamNumber,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "1200",
    "bestRating": "5",
    "worstRating": "1"
  },
  "sameAs": [
    "https://www.facebook.com/share/1Jj9yDRirA/",
    "https://www.instagram.com/worklyindiaofficial",
    "https://youtube.com/@worklyindiaofficial",
    "https://x.com/worklyindia",
    "https://t.me/WorklyIndia",
  "https://maps.google.com/maps?cid=6183675393057517431"
  ]
};

export const jobBoardStructuredData = {
  "@context": "https://schema.org",
  "@type": "JobBoard",
  "name": `${BRAND_CONFIG.name} Jobs`,
  "url": `${CANONICAL_URL}/jobs`,
  "description": "Browse thousands of verified remote jobs across India",
  "provider": {
    "@type": "Organization",
    "name": BRAND_CONFIG.name,
    "url": CANONICAL_URL
  }
};

export const breadcrumbStructuredData = (items: Array<{name: string, url: string}>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const jobPostingStructuredData = (job: any) => ({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": job.title,
  "description": job.description,
  "identifier": {
    "@type": "PropertyValue",
    "name": BRAND_CONFIG.name,
    "value": job.id
  },
  "datePosted": job.posted,
  "employmentType": job.type === "Full-Time" ? "FULL_TIME" : "PART_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": job.company,
    "sameAs": CANONICAL_URL
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": job.location,
      "addressCountry": "IN"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": {
      "@type": "QuantitativeValue",
      "value": job.salary,
      "unitText": "MONTH"
    }
  },
  "workLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Workly India",
      "addressCountry": "IN"
    }
  }
});

export const faqStructuredData = (faqs: Array<{question: string, answer: string}>) => ({
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
});

export const articleStructuredData = (article: {
  title: string;
  description: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": article.title,
  "description": article.description,
  "author": {
    "@type": "Person",
    "name": article.author
  },
  "publisher": {
    "@type": "Organization",
    "name": BRAND_CONFIG.name,
    "logo": {
      "@type": "ImageObject",
      "url": optimizeImage("https://worklyindia.devs.surf/icons/icon-512x512.png", 512, 85, 'webp')
    }
  },
  "datePublished": article.datePublished,
  "dateModified": article.dateModified || article.datePublished,
  "image": article.image || optimizeImage("https://worklyindia.devs.surf/icons/icon-512x512.png", 512, 85, 'webp'),
  "url": article.url
});

export const localBusinessStructuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": BRAND_CONFIG.name,
  "image": optimizeImage("https://worklyindia.devs.surf/icons/icon-512x512.png", 512, 85, 'webp'),
  "@id": `${CANONICAL_URL}/#localbusiness`,
  "url": `${CANONICAL_URL}/`,
  "telephone": BRAND_CONFIG.phone,
  "email": BRAND_CONFIG.supportEmail,
  "priceRange": "Free",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Ahmedabad",
    "addressRegion": "Gujarat", 
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 23.0225,
    "longitude": 72.5714
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ],
    "opens": "00:00",
    "closes": "23:59"
  },
  "serviceArea": {
    "@type": "Country",
    "name": "India"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Job Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Remote Job Listings",
          "description": "Browse verified remote job opportunities"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service", 
          "name": "Resume Building Services",
          "description": "Professional resume building tools"
        }
      }
    ]
  },
  "sameAs": [
    "https://www.facebook.com/share/1Jj9yDRirA/",
    "https://www.instagram.com/worklyindiaofficial",
    "https://youtube.com/@worklyindiaofficial",
    "https://x.com/worklyindia",
    "https://t.me/WorklyIndia",
  "https://maps.google.com/maps?cid=6183675393057517431"
  ]
};