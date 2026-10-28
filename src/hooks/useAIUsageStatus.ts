import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AIUsageStatus {
  isLoading: boolean;
  hasSubscription: boolean;
  remaining: number;
  limit: number;
  used: number;
  planName: string | null;
  isLimitReached: boolean;
}

/**
 * Hook to check AI usage status for the current user.
 * This is used to show remaining credits on AI buttons BEFORE clicking.
 */
export const useAIUsageStatus = () => {
  const [status, setStatus] = useState<AIUsageStatus>({
    isLoading: true,
    hasSubscription: false,
    remaining: 0,
    limit: 0,
    used: 0,
    planName: null,
    isLimitReached: false,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setStatus({
          isLoading: false,
          hasSubscription: false,
          remaining: 0,
          limit: 0,
          used: 0,
          planName: null,
          isLimitReached: true,
        });
        return;
      }

      const { data, error } = await supabase.rpc('get_user_ai_chat_status', {
        p_user_id: userId
      });

      if (error) {
        console.error('Failed to fetch AI usage status:', error);
        setStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const statusObj = data as { 
        plan?: { messages_per_month?: number; name?: string }; 
        usage?: { messages_count?: number } 
      } | null;

      const plan = statusObj?.plan;
      const usage = statusObj?.usage;

      if (!plan) {
        setStatus({
          isLoading: false,
          hasSubscription: false,
          remaining: 0,
          limit: 0,
          used: 0,
          planName: null,
          isLimitReached: true,
        });
        return;
      }

      const messagesLimit = plan.messages_per_month || 0;
      const messagesUsed = usage?.messages_count || 0;
      const remaining = Math.max(0, messagesLimit - messagesUsed);
      const isUnlimited = messagesLimit >= 999999;
      const isLimitReached = !isUnlimited && messagesUsed >= messagesLimit;

      setStatus({
        isLoading: false,
        hasSubscription: true,
        remaining: isUnlimited ? 999999 : remaining,
        limit: messagesLimit,
        used: messagesUsed,
        planName: plan.name || 'Free',
        isLimitReached,
      });
    } catch (err) {
      console.error('Error fetching AI usage status:', err);
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { ...status, refetch: fetchStatus };
};
