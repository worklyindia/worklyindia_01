import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WithdrawalRequest {
  id: string;
  withdrawal_id: string;
  user_id: string;
  amount: number;
  status: "pending" | "success" | "failed";
  payment_settings: any;
  processed_by: string | null;
  processed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const useWithdrawalRequests = (userId?: string, isAdmin: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: withdrawalRequests, isLoading } = useQuery({
    queryKey: ["withdrawalRequests", userId, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("referral_withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (!isAdmin && userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as WithdrawalRequest[];
    },
    enabled: !!userId || isAdmin,
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async (amount: number) => {
      console.log("🔄 Starting withdrawal request for amount:", amount);
      
      // Get current session with detailed logging
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("🔐 Session check:", {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        sessionError: sessionError?.message
      });
      
      if (sessionError) {
        console.error("❌ Session error:", sessionError);
        throw new Error("Failed to retrieve session. Please try logging in again.");
      }
      
      if (!session) {
        console.error("❌ No session found");
        throw new Error("You must be logged in to create a withdrawal request");
      }

      if (!session.access_token) {
        console.error("❌ No access token in session");
        throw new Error("Authentication token is missing. Please log in again.");
      }

      console.log("✅ Invoking edge function with auth header");
      const { data, error } = await supabase.functions.invoke("create-withdrawal-request", {
        body: { amount },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("📥 Edge function response:", { data, error });

      if (error) {
        console.error("❌ Edge function error:", error);
        throw error;
      }
      
      if (!data?.success) {
        const errorMsg = data?.error || "Failed to create withdrawal request";
        console.error("❌ Request failed:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("✅ Withdrawal request created successfully:", data.withdrawal_id);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawalRequests"] });
      queryClient.invalidateQueries({ queryKey: ["referralWallet"] });
      toast({
        title: "Withdrawal Request Created",
        description: `Your withdrawal request ${data.withdrawal_id} has been submitted successfully!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create withdrawal request",
        variant: "destructive",
      });
    },
  });

  const processSuccessMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { data, error } = await supabase.functions.invoke("process-withdrawal-success", {
        body: { withdrawal_id: withdrawalId },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to process withdrawal");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawalRequests"] });
      toast({
        title: "Success",
        description: "Withdrawal marked as successful!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const processFailureMutation = useMutation({
    mutationFn: async ({ withdrawalId, reason }: { withdrawalId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("process-withdrawal-failure", {
        body: { withdrawal_id: withdrawalId, failure_reason: reason },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Failed to process withdrawal");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawalRequests"] });
      toast({
        title: "Withdrawal Failed",
        description: "Withdrawal marked as failed and balance refunded!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  return {
    withdrawalRequests,
    isLoading,
    createWithdrawal: createWithdrawalMutation.mutate,
    isCreating: createWithdrawalMutation.isPending,
    processSuccess: processSuccessMutation.mutate,
    isProcessingSuccess: processSuccessMutation.isPending,
    processFailure: processFailureMutation.mutate,
    isProcessingFailure: processFailureMutation.isPending,
  };
};
