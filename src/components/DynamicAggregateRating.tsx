import { Star } from "lucide-react";
import { useAggregateRating } from "@/hooks/useAggregateRating";
import AggregateRatingSchema from "@/components/seo/AggregateRatingSchema";
import { Skeleton } from "@/components/ui/skeleton";

interface DynamicAggregateRatingProps {
  showBadge?: boolean;
}

/**
 * Component that displays aggregate rating with Schema.org structured data
 * Fetches real ratings from app_reviews table
 */
const DynamicAggregateRating = ({ showBadge = true }: DynamicAggregateRatingProps) => {
  const { rating, loading } = useAggregateRating();

  if (loading) {
    return showBadge ? (
      <Skeleton className="h-6 w-32 inline-block" />
    ) : null;
  }

  return (
    <>
      {/* Schema.org structured data for SEO */}
      <AggregateRatingSchema
        ratingValue={rating.ratingValue}
        ratingCount={rating.ratingCount}
        reviewCount={rating.reviewCount}
      />

      {/* Visual badge display */}
      {showBadge && (
        <div className="inline-flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < Math.floor(rating.ratingValue)
                    ? 'fill-yellow-400 text-yellow-400'
                    : i < rating.ratingValue
                    ? 'fill-yellow-200 text-yellow-400'
                    : 'text-yellow-200'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-semibold text-yellow-700">
            {rating.ratingValue}
          </span>
          <span className="text-xs text-yellow-600">
            ({rating.reviewCount} {rating.reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        </div>
      )}
    </>
  );
};

export default DynamicAggregateRating;
