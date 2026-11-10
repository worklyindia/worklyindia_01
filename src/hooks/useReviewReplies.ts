import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  reply_text: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
  } | null;
}

export const useReviewReplies = (reviewId: string) => {
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  // Fetch replies for this review
  const fetchReplies = async () => {
    try {
      // First get replies
      const { data: repliesData, error: repliesError } = await supabase
        .from('app_review_replies')
        .select('*')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;

      // Then get profiles for those users
      if (repliesData && repliesData.length > 0) {
        const userIds = repliesData.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (!profilesError && profilesData) {
          // Map profiles to replies
          const repliesWithProfiles = repliesData.map(reply => ({
            ...reply,
            profiles: profilesData.find(p => p.user_id === reply.user_id) || null
          }));
          
          console.log('💬 Replies fetched for review:', reviewId, repliesWithProfiles.length);
          setReplies(repliesWithProfiles as any);
          return;
        }
      }
      
      console.log('💬 Replies fetched for review:', reviewId, repliesData?.length || 0);
      setReplies((repliesData as any) || []);
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`review_replies_${reviewId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_review_replies',
          filter: `review_id=eq.${reviewId}`
        },
        (payload) => {
          console.log('🔔 Real-time reply update:', payload.eventType);
          // Refetch to get complete data with profiles
          fetchReplies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reviewId]);

  const submitReply = async (replyText: string) => {
    if (!user) {
      throw new Error('User must be logged in to reply');
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('app_review_replies')
        .insert({
          review_id: reviewId,
          user_id: user.id,
          reply_text: replyText
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error submitting reply:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteReply = async (replyId: string) => {
    try {
      const { error } = await supabase
        .from('app_review_replies')
        .delete()
        .eq('id', replyId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting reply:', error);
      throw error;
    }
  };

  return {
    replies,
    loading,
    isSubmitting,
    submitReply,
    deleteReply,
    replyCount: replies.length
  };
};
