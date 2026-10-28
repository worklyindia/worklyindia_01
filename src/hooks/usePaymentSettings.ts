import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PaymentSettings {
  id: string;
  user_id: string;
  name: string | null;
  mobile: string | null;
  email: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  created_at: string;
  updated_at: string;
}

export const usePaymentSettings = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: paymentSettings, isLoading } = useQuery({
    queryKey: ["paymentSettings", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("referral_payment_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data as PaymentSettings | null;
    },
    enabled: !!userId,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<PaymentSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("referral_payment_settings")
        .upsert(
          {
            user_id: user.id,
            ...settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentSettings", userId] });
      toast({
        title: "Success",
        description: "Payment settings saved successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save payment settings",
        variant: "destructive",
      });
    },
  });

  return {
    paymentSettings,
    isLoading,
    saveSettings: saveSettingsMutation.mutate,
    isSaving: saveSettingsMutation.isPending,
  };
};
