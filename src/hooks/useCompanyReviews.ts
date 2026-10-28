import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompanyReview {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewer_position: string | null;
  is_verified: boolean;
  created_at: string;
  user_id: string;
  company_id: string;
}

export const useCompanyReviews = (companyId: string | undefined, limit = 10, offset = 0) => {
  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const fetchReviews = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('company_reviews')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1);

        if (error) throw error;

        setReviews(data || []);
      } catch (err) {
        console.error('Error fetching company reviews:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [companyId, limit, offset]);

  return { reviews, loading, error };
};