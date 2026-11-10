import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserReview {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewer_position: string | null;
  user_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export const useUserCompanyReview = (companyId: string | undefined) => {
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const { user } = useAuth();

  const fetchUserReview = async () => {
    if (!user || !companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('company_reviews')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user review:', error);
        setUserReview(null);
        setHasReviewed(false);
      } else {
        setUserReview(data);
        setHasReviewed(!!data);
      }
    } catch (err) {
      console.error('Error:', err);
      setUserReview(null);
      setHasReviewed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserReview();
  }, [user, companyId]);

  const refetch = () => {
    fetchUserReview();
  };

  return { 
    userReview, 
    loading, 
    hasReviewed, 
    refetch 
  };
};