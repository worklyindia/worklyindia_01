import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useReviewHelpful = (reviewId: string) => {
  const [isHelpful, setIsHelpful] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Check if current user has marked this review as helpful
  useEffect(() => {
    const checkHelpful = async () => {
      if (!user) {
        setIsHelpful(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('app_review_helpful')
          .select('id')
          .eq('review_id', reviewId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setIsHelpful(!!data);
      } catch (error) {
        console.error('Error checking helpful status:', error);
      }
    };

    checkHelpful();
  }, [reviewId, user]);

  const toggleHelpful = async () => {
    if (!user) {
      return { success: false, needsAuth: true };
    }

    setLoading(true);

    // Optimistic update
    const previousState = isHelpful;
    setIsHelpful(!isHelpful);

    try {
      if (isHelpful) {
        // Remove helpful mark
        const { error } = await supabase
          .from('app_review_helpful')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add helpful mark
        const { error } = await supabase
          .from('app_review_helpful')
          .insert({
            review_id: reviewId,
            user_id: user.id
          });

        if (error) throw error;
      }

      return { success: true, needsAuth: false };
    } catch (error) {
      // Rollback on error
      setIsHelpful(previousState);
      console.error('Error toggling helpful:', error);
      return { success: false, needsAuth: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    isHelpful,
    loading,
    toggleHelpful
  };
};
