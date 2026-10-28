import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AggregateRating {
  ratingValue: number;
  ratingCount: number;
  reviewCount: number;
}

/**
 * Hook to fetch aggregate rating from app_reviews table
 * Used for dynamic Schema.org rating data
 */
export const useAggregateRating = () => {
  const [rating, setRating] = useState<AggregateRating>({
    ratingValue: 5.0,
    ratingCount: 1,
    reviewCount: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRating = useCallback(async () => {
    try {
      // Get all reviews to calculate aggregate
      const { data: reviews, error: reviewsError } = await supabase
        .from('app_reviews')
        .select('rating');

      if (reviewsError) throw reviewsError;

      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / reviews.length;

        setRating({
          ratingValue: Number(averageRating.toFixed(1)),
          ratingCount: reviews.length,
          reviewCount: reviews.length
        });
      }
    } catch (err) {
      console.error('Error fetching aggregate rating:', err);
      setError('Failed to fetch rating');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRating();
  }, [fetchRating]);

  return {
    rating,
    loading,
    error,
    refetch: fetchRating
  };
};

export default useAggregateRating;
