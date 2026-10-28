import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReferralSettings {
  id: string;
  commission_percentage: number;
  is_active: boolean;
  minimum_commission_amount: number;
  maximum_commission_amount: number;
  commission_calculation_method: string;
  created_at: string;
  updated_at: string;
}

export const useReferralSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current referral settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["referralSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching referral settings:', error);
        throw error;
      }

      return data as ReferralSettings | null;
    },
  });

  // Update referral settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<ReferralSettings>) => {
      const { data, error } = await supabase.functions.invoke('update-referral-settings', {
        body: updatedSettings
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update referral settings');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referralSettings"] });
      toast({
        title: "Success",
        description: "Referral settings updated successfully!",
      });
    },
    onError: (error) => {
      console.error('Update referral settings error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update referral settings",
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
};