import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';
import { BRAND_CONFIG } from '@/config/brandConfig';

interface AggregateRatingSchemaProps {
  ratingValue: number;
  ratingCount: number;
  reviewCount?: number;
  bestRating?: number;
  worstRating?: number;
}

/**
 * Generates Schema.org AggregateRating structured data for Google Rich Results
 * Uses dynamic data from database instead of hardcoded values
 */
export const AggregateRatingSchema = ({
  ratingValue,
  ratingCount,
  reviewCount,
  bestRating = 5,
  worstRating = 1
}: AggregateRatingSchemaProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": BRAND_CONFIG.name,
    "alternateName": "Workly India",
    "url": CANONICAL_URL,
    "logo": `https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/e6842375-3aac-4daa-a379-8b60152cbf1d.png`,
    "sameAs": [
      "https://www.facebook.com/share/1Jj9yDRirA/",
      "https://www.instagram.com/worklyindiaofficial",
      "https://youtube.com/@worklyindiaofficial",
      "https://x.com/worklyindia",
      "https://t.me/WorklyIndia",
      "https://maps.google.com/maps?cid=6183675393057517431"
    ],
    "description": "India's trusted platform for verified remote jobs. 100% FREE for job seekers with verified employers.",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": ratingValue.toFixed(1),
      "ratingCount": ratingCount.toString(),
      "reviewCount": (reviewCount || ratingCount).toString(),
      "bestRating": bestRating.toString(),
      "worstRating": worstRating.toString()
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-9904923067",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["English", "Hindi"]
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

export default AggregateRatingSchema;
