import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AppReview {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  categories: string[];
  helpful_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface AppReviewStats {
  averageRating: number;
  totalReviews: number;
  fiveStarPercentage: number;
  ratingsDistribution: { [key: number]: number };
}

export const useAppReviews = () => {
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [userReview, setUserReview] = useState<AppReview | null>(null);
  const [stats, setStats] = useState<AppReviewStats>({
    averageRating: 0,
    totalReviews: 0,
    fiveStarPercentage: 0,
    ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  // Fetch all reviews
  const fetchReviews = async () => {
    try {
      // First get reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('app_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (reviewsError) throw reviewsError;

      // Then get profiles for those users
      if (reviewsData && reviewsData.length > 0) {
        const userIds = reviewsData.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (!profilesError && profilesData) {
          // Map profiles to reviews
          const reviewsWithProfiles = reviewsData.map(review => ({
            ...review,
            profiles: profilesData.find(p => p.user_id === review.user_id) || null
          }));
          
          console.log('📊 Reviews fetched:', reviewsWithProfiles.length);
          setReviews(reviewsWithProfiles as any);
          calculateStats(reviewsWithProfiles as any);
          return;
        }
      }

      console.log('📊 Reviews fetched:', reviewsData?.length || 0);
      setReviews((reviewsData as any) || []);
      calculateStats((reviewsData as any) || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's own review
  const fetchUserReview = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('app_reviews')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setUserReview(data);
    } catch (error) {
      console.error('Error fetching user review:', error);
    }
  };

  // Calculate statistics
  const calculateStats = (reviewsData: AppReview[]) => {
    if (reviewsData.length === 0) {
      setStats({
        averageRating: 0,
        totalReviews: 0,
        fiveStarPercentage: 0,
        ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      });
      return;
    }

    const totalRating = reviewsData.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / reviewsData.length;
    
    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewsData.forEach(r => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });

    const fiveStarCount = distribution[5];
    const fiveStarPct = (fiveStarCount / reviewsData.length) * 100;

    setStats({
      averageRating: parseFloat(avgRating.toFixed(1)),
      totalReviews: reviewsData.length,
      fiveStarPercentage: Math.round(fiveStarPct),
      ratingsDistribution: distribution
    });
  };

  // Submit new review or update existing with optimistic updates
  const submitReview = async (
    rating: number,
    reviewText: string,
    categories: string[]
  ) => {
    if (!user) {
      throw new Error('User must be logged in to submit a review');
    }

    setIsSubmitting(true);

    // Create optimistic review
    const tempId = `temp-${Date.now()}`;
    const optimisticReview: AppReview = {
      id: userReview?.id || tempId,
      user_id: user.id,
      rating,
      review_text: reviewText,
      categories,
      helpful_count: userReview?.helpful_count || 0,
      created_at: userReview?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: user.user_metadata?.full_name || null
      }
    };

    // Optimistic update to local state
    const previousReviews = reviews;
    const previousUserReview = userReview;
    const previousStats = stats;

    if (userReview) {
      // Update existing review in list
      setReviews(prev => prev.map(r => r.id === userReview.id ? optimisticReview : r));
    } else {
      // Add new review to list
      setReviews(prev => [optimisticReview, ...prev]);
    }
    setUserReview(optimisticReview);

    // Recalculate stats optimistically
    const updatedReviews = userReview 
      ? reviews.map(r => r.id === userReview.id ? optimisticReview : r)
      : [optimisticReview, ...reviews];
    calculateStats(updatedReviews);

    try {
      if (userReview) {
        // Update existing review
        const { error } = await supabase
          .from('app_reviews')
          .update({
            rating,
            review_text: reviewText,
            categories,
            updated_at: new Date().toISOString()
          })
          .eq('id', userReview.id);

        if (error) throw error;
      } else {
        // Insert new review
        const { error } = await supabase
          .from('app_reviews')
          .insert({
            user_id: user.id,
            rating,
            review_text: reviewText,
            categories
          });

        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      // Rollback on error
      setReviews(previousReviews);
      setUserReview(previousUserReview);
      setStats(previousStats);
      
      console.error('Error submitting review:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete review with optimistic updates
  const deleteReview = async () => {
    if (!user || !userReview) return;

    setIsSubmitting(true);

    // Store previous state for rollback
    const previousReviews = reviews;
    const previousUserReview = userReview;
    const previousStats = stats;

    // Optimistic delete
    setReviews(prev => prev.filter(r => r.id !== userReview.id));
    setUserReview(null);
    calculateStats(reviews.filter(r => r.id !== userReview.id));

    try {
      const { error } = await supabase
        .from('app_reviews')
        .delete()
        .eq('id', userReview.id);

      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      // Rollback on error
      setReviews(previousReviews);
      setUserReview(previousUserReview);
      setStats(previousStats);
      
      console.error('Error deleting review:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Setup real-time subscription with granular updates
  useEffect(() => {
    fetchReviews();
    if (user) {
      fetchUserReview();
    }

    // Subscribe to reviews changes
    const reviewsChannel = supabase
      .channel('app_reviews_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_reviews'
        },
        (payload) => {
          console.log('🔔 Real-time app review update:', payload.eventType);
          fetchReviews();
        }
      )
      .subscribe();

    // Subscribe to helpful marks changes to update counts
    const helpfulChannel = supabase
      .channel('app_review_helpful_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_review_helpful'
        },
        (payload) => {
          console.log('🔔 Real-time helpful update:', payload.eventType);
          fetchReviews(); // Refetch to get updated helpful counts
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(helpfulChannel);
    };
  }, [user]);

  return {
    reviews,
    userReview,
    stats,
    loading,
    isSubmitting,
    submitReview,
    deleteReview,
    hasReviewed: !!userReview
  };
};
