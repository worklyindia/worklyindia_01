import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

const SITE_URL = CANONICAL_URL;

/**
 * Local Business Schema for better local SEO
 * Helps with searches like:
 * - "job portal near me"
 * - "remote jobs in [city]"
 * - "hiring companies in India"
 */
export const LocalBusinessSchema = () => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#organization`,
    "name": BRAND_CONFIG.name,
    "alternateName": [
      "Workly India",
      "Workly India",
      "Remote Jobs India"
    ],
    "description": "India's leading remote job portal. Find verified remote jobs, post job openings, and connect employers with talented professionals across India.",
    "url": SITE_URL,
    "logo": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
    "image": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
    "telephone": BRAND_CONFIG.phone,
    "email": BRAND_CONFIG.email,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN",
      "addressLocality": BRAND_CONFIG.location
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "20.5937",
      "longitude": "78.9629"
    },
    "areaServed": [
      {
        "@type": "Country",
        "name": "India"
      },
      {
        "@type": "City",
        "name": "Mumbai"
      },
      {
        "@type": "City",
        "name": "Delhi"
      },
      {
        "@type": "City",
        "name": "Bangalore"
      },
      {
        "@type": "City",
        "name": "Hyderabad"
      },
      {
        "@type": "City",
        "name": "Chennai"
      },
      {
        "@type": "City",
        "name": "Kolkata"
      },
      {
        "@type": "City",
        "name": "Pune"
      }
    ],
    "priceRange": "₹0 - ₹50000",
    "openingHours": "Mo-Su 00:00-23:59",
    "sameAs": [
      "https://www.facebook.com/share/1Jj9yDRirA/",
      "https://www.instagram.com/worklyindiaofficial",
      "https://youtube.com/@worklyindiaofficial",
      "https://x.com/worklyindia",
      "https://t.me/WorklyIndia",
      "https://maps.google.com/maps?cid=6183675393057517431"
    ],
    "hasMap": "https://maps.google.com/maps?cid=6183675393057517431",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "12500",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

export default LocalBusinessSchema;
