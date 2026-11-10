import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AIChatPlan {
  id: string;
  name: string;
  price_inr: number;
  messages_per_month: number;
  voice_playback_per_month: number;
  voice_input_per_month: number;
  image_analysis_per_month: number;
  ai_image_generation_per_month?: number;
  ai_model_tier: string;
  priority_support: boolean;
  features: string[];
}

export interface AIChatUsage {
  messages_count: number;
  voice_playback_count: number;
  voice_input_count: number;
  image_analysis_count: number;
  tokens_used: number;
}

export interface AIChatSubscription {
  status: string;
  starts_at: string;
  ends_at: string;
}

export interface AIChatStatus {
  plan: AIChatPlan;
  subscription: AIChatSubscription | null;
  usage: AIChatUsage;
}

export interface AIImageUsage {
  images_generated: number;
  monthly_limit: number;
  subscription_plan: string;
}

export const useAIChatSubscription = () => {
  const { user } = useAuth();

  const { data: status, isLoading, refetch } = useQuery<AIChatStatus>({
    queryKey: ['ai-chat-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('get_user_ai_chat_status', {
        p_user_id: user.id
      });

      if (error) throw error;
      return data as unknown as AIChatStatus;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: plans, isLoading: plansLoading } = useQuery<AIChatPlan[]>({
    queryKey: ['ai-chat-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_chat_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_inr', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as AIChatPlan[];
    },
    staleTime: 1000 * 60 * 30, // Plans rarely change — 30 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch AI Image Generation usage
  const { data: imageUsage, isLoading: imageUsageLoading } = useQuery<AIImageUsage>({
    queryKey: ['ai-image-usage', user?.id, status?.plan?.name],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

      const { data, error } = await supabase
        .from('ai_image_usage')
        .select('images_generated, monthly_limit, subscription_plan')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .maybeSingle();

      if (error) throw error;

      // Get limit from current plan (fetched from ai_chat_plans with ai_image_generation_per_month)
      const currentPlan = plans?.find(p => p.name === status?.plan?.name);
      const planLimit = (currentPlan as any)?.ai_image_generation_per_month ?? 5;

      // Return default values if no usage record exists
      if (!data) {
        return {
          images_generated: 0,
          monthly_limit: planLimit,
          subscription_plan: status?.plan?.name || 'Free'
        };
      }

      return {
        ...data,
        monthly_limit: planLimit // Always use plan's current limit
      } as AIImageUsage;
    },
    enabled: !!user?.id && !!status,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const getRemainingUsage = () => {
    if (!status) return null;

    return {
      messages: status.plan.messages_per_month - status.usage.messages_count,
      voicePlayback: status.plan.voice_playback_per_month - status.usage.voice_playback_count,
      voiceInput: status.plan.voice_input_per_month - status.usage.voice_input_count,
      imageAnalysis: status.plan.image_analysis_per_month - status.usage.image_analysis_count,
      imageGeneration: imageUsage ? imageUsage.monthly_limit - imageUsage.images_generated : 0,
    };
  };

  const getUsagePercentage = (used: number, total: number) => {
    if (total >= 999999) return 0; // Unlimited
    return Math.min((used / total) * 100, 100);
  };

  const isFeatureLocked = (used: number, total: number) => {
    if (total >= 999999) return false; // Unlimited
    return used >= total;
  };

  const getSubscriptionDates = () => {
    if (!status) return null;

    // For paid plans with active subscription
    if (status.subscription && status.plan.price_inr > 0) {
      const startDate = new Date(status.subscription.starts_at);
      const endDate = new Date(status.subscription.ends_at);
      return {
        startDate: startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), // DD/MM/YYYY
        endDate: endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        isFree: false,
      };
    }

    // For free plans - show current month start and next month start (reset date)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return {
      startDate: monthStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      endDate: nextMonthStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      isFree: true,
    };
  };

  return {
    status,
    plans,
    imageUsage,
    isLoading: isLoading || plansLoading || imageUsageLoading,
    refetch,
    getRemainingUsage,
    getUsagePercentage,
    isFeatureLocked,
    getSubscriptionDates,
  };
};
