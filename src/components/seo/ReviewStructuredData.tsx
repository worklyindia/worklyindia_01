import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';

const SITE_URL = CANONICAL_URL;

interface Review {
  author: string;
  rating: number;
  reviewBody: string;
  datePublished?: string;
}

interface ReviewStructuredDataProps {
  itemReviewed: {
    name: string;
    type?: 'Organization' | 'Product' | 'Service' | 'LocalBusiness';
    image?: string;
  };
  reviews: Review[];
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
}

export const ReviewStructuredData = ({
  itemReviewed,
  reviews,
  aggregateRating
}: ReviewStructuredDataProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": itemReviewed.type || "Organization",
    "name": itemReviewed.name,
    "image": itemReviewed.image || `https://worklyindia.devs.surf/icons/icon-512x512.png`,
    "url": SITE_URL,
    ...(aggregateRating && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": aggregateRating.ratingValue,
        "reviewCount": aggregateRating.reviewCount,
        "bestRating": aggregateRating.bestRating || 5,
        "worstRating": aggregateRating.worstRating || 1
      }
    }),
    "review": reviews.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5,
        "worstRating": 1
      },
      "reviewBody": review.reviewBody,
      "datePublished": review.datePublished || new Date().toISOString().split('T')[0]
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

export default ReviewStructuredData;
