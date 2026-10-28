import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReferralCode {
  id: string;
  user_id: string;
  referral_code: string;
  is_active: boolean;
  total_referrals: number;
  total_commission_earned: number;
  created_at: string;
  updated_at: string;
}

interface ReferralWallet {
  id: string;
  user_id: string;
  balance_amount: number;
  total_earned: number;
  total_withdrawn: number;
  created_at: string;
  updated_at: string;
}

interface ReferralCommission {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  payment_id: string | null;
  commission_amount: number;
  source_payment_amount: number;
  source_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    profile_image_url: string | null;
    phone: string | null;
    whatsapp_number: string | null;
  };
  companies?: {
    company_name: string;
    phone: string | null;
    whatsapp_number: string | null;
  };
}

interface ReferredUser {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referral_code_used: string;
  is_active: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    profile_image_url: string | null;
    phone: string | null;
    whatsapp_number: string | null;
    account_status?: string | null;
    email?: string | null;
  };
  companies?: {
    company_name: string;
    phone: string | null;
    whatsapp_number: string | null;
    account_status?: string | null;
  };
}

export const useReferralSystem = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get current authenticated user
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  useEffect(() => {
    // Get current user if not provided
    if (!userId) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUser(user);
      });
    }
  }, [userId]);
  
  // Use provided userId or fallback to authenticated user
  const targetUserId = userId || currentUser?.id;

  // Get referral code for target user
  const { data: referralCode, isLoading: isLoadingCode } = useQuery({
    queryKey: ["referralCode", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data as ReferralCode | null;
    },
    enabled: !!targetUserId,
  });

  // Get referral wallet for target user
  const { data: referralWallet, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["referralWallet", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;

      const { data, error } = await supabase
        .from("referral_wallets")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data as ReferralWallet | null;
    },
    enabled: !!targetUserId,
  });

  // Get commission history with contact details for target user
  const { data: commissionHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["commissionHistory", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from("referral_commissions")
        .select("*")
        .eq("referrer_id", targetUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich commission data with contact information
      const enrichedData = await Promise.all(
        data.map(async (commission) => {
          const [profileResult, companyResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, profile_image_url, phone, whatsapp_number")
              .eq("user_id", commission.referred_user_id)
              .maybeSingle(),
            supabase
              .from("companies")
              .select("company_name, phone, whatsapp_number")
              .eq("user_id", commission.referred_user_id)
              .maybeSingle()
          ]);

          return {
            ...commission,
            profiles: profileResult.data,
            companies: companyResult.data,
          };
        })
      );

      return enrichedData as ReferralCommission[];
    },
    enabled: !!targetUserId,
  });

  // Get referred users for target user
  const { data: referredUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["referredUsers", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      // First get user referrals
      const { data: referrals, error: referralsError } = await supabase
        .from("user_referrals")
        .select("*")
        .eq("referrer_id", targetUserId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (referralsError) throw referralsError;

      // Then get profile and company data for each referred user
      const enrichedData = await Promise.all(
        referrals.map(async (referral) => {
          const [profileResult, companyResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, profile_image_url, phone, whatsapp_number, account_status, email")
              .eq("user_id", referral.referred_user_id)
              .maybeSingle(),
            supabase
              .from("companies")
              .select("company_name, phone, whatsapp_number, account_status")
              .eq("user_id", referral.referred_user_id)
              .maybeSingle()
          ]);

          return {
            ...referral,
            profiles: profileResult.data,
            companies: companyResult.data,
          };
        })
      );

      return enrichedData as ReferredUser[];
    },
    enabled: !!targetUserId,
  });

  // Get wallet adjustments (Add/Deduct Balance) for target user
  const { data: walletAdjustments, isLoading: isLoadingAdjustments } = useQuery({
    queryKey: ["referralWalletAdjustments", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from("referral_wallet_adjustments")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Return all adjustment records for complete history
      return data || [];
    },
    enabled: !!targetUserId,
  });

  // Generate referral code
  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('unified-ai-tricks', {
          body: { action: 'generate_referral_code' },
        });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate referral code');
      }

      // Return the full response to check if code was newly created
      return { referral_code: data.referral_code, message: data.message };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["referralCode", targetUserId] });
      
      // Only show toast if code was newly generated, not if it already existed
      if (data?.message !== 'Referral code already exists') {
        toast({
          title: "Success",
          description: "Referral code generated successfully!",
        });
      }
    },
    onError: (error) => {
      console.error('Generate referral code error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate referral code",
        variant: "destructive",
      });
    },
  });

  // Validate referral code
  const validateCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("validate_referral_code", {
        p_code: code,
      });

      if (error) throw error;

      return data as { valid: boolean; message?: string; company_name?: string; referrer_id?: string };
    },
  });

  // Create referral relationship
  const createReferralMutation = useMutation({
    mutationFn: async ({ referralCode, referredUserId }: { referralCode: string; referredUserId: string }) => {
      const { data, error } = await supabase.functions.invoke('create-referral-relationship', {
        body: {
          referral_code: referralCode,
          referred_user_id: referredUserId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Referral relationship created successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to create referral relationship",
        variant: "destructive",
      });
    },
  });

  return {
    referralCode,
    referralWallet,
    commissionHistory,
    referredUsers,
    walletAdjustments,
    isLoadingCode,
    isLoadingWallet,
    isLoadingHistory,
    isLoadingUsers,
    isLoadingAdjustments,
    generateCode: generateCodeMutation.mutate,
    isGenerating: generateCodeMutation.isPending,
    validateCode: validateCodeMutation.mutateAsync,
    isValidating: validateCodeMutation.isPending,
    createReferralRelationship: createReferralMutation.mutate,
    isCreatingRelationship: createReferralMutation.isPending,
  };
};