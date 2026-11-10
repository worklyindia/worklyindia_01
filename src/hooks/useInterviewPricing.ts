import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingSettings {
  points_per_interview: number;
  points_per_minute: number;
  minimum_points: number;
  enable_duration_pricing: boolean;
}

interface UpdatePricingParams {
  points_per_interview?: number;
  points_per_minute?: number;
  minimum_points?: number;
  enable_duration_pricing?: boolean;
}

export const useInterviewPricing = () => {
  const queryClient = useQueryClient();

  const { data: pricing, isLoading } = useQuery({
    queryKey: ["interview-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_pricing_settings")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PricingSettings | null;
    },
  });

  const updatePricing = useMutation({
    mutationFn: async (updates: UpdatePricingParams) => {
      const { data, error } = await supabase
        .from("interview_pricing_settings")
        .update(updates)
        .eq("is_active", true)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interview-pricing"] });
      toast.success("Interview pricing updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update pricing");
    },
  });

  // Helper function to calculate total interview cost
  const calculateInterviewCost = (
    candidatesCount: number,
    durationMinutes: number,
    mode?: string
  ): {
    baseCandidateCharge: number;
    durationCharge: number;
    subtotal: number;
    total: number;
    minimumPoints: number;
  } => {
    if (!pricing) {
      return {
        baseCandidateCharge: 0,
        durationCharge: 0,
        subtotal: 0,
        total: 0,
        minimumPoints: 0,
      };
    }

    const baseCandidateCharge = candidatesCount * (pricing.points_per_interview || 1);
    
    // Duration charge applies to video meeting modes (100ms, VideoSDK)
    // Note: Jitsi is free so duration isn't charged
    const videoModes = ['100ms', '100ms_iframe', 'videosdk', 'videosdk_iframe'];
    let durationCharge = 0;
      if (videoModes.includes(mode || '') && pricing.enable_duration_pricing && pricing.points_per_minute > 0) {
      // Per-minute charge per candidate (individual video calls)
      durationCharge = durationMinutes * pricing.points_per_minute * candidatesCount;
      
      console.log(`💰 Pricing calculation for ${mode}:`, {
        mode,
        durationMinutes,
        pointsPerMinute: pricing.points_per_minute,
        candidatesCount,
        durationCharge,
        baseCandidateCharge
      });
    }
    
    const subtotal = baseCandidateCharge + durationCharge;
    const minimumPoints = pricing.minimum_points || 0;
    const total = Math.max(subtotal, minimumPoints);

    return {
      baseCandidateCharge,
      durationCharge,
      subtotal,
      total,
      minimumPoints,
    };
  };

  return {
    pricing,
    isLoading,
    pointsPerInterview: pricing?.points_per_interview || 1,
    pointsPerMinute: pricing?.points_per_minute || 0,
    minimumPoints: pricing?.minimum_points || 0,
    enableDurationPricing: pricing?.enable_duration_pricing !== false,
    updatePricing: updatePricing.mutate,
    isUpdating: updatePricing.isPending,
    calculateInterviewCost,
  };
};
