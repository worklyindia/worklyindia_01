import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LocationStats {
  country: string;
  state: string;
  city: string;
  total_members: number;
  active_members: number;
  profile_complete_members: number;
}

interface LoginActivity {
  period_date: string;
  total_logins: number;
  unique_users: number;
}

interface NewAccounts {
  period_date: string;
  jobseeker_accounts: number;
  employer_accounts: number;
  total_new_accounts: number;
}

interface FinancialStats {
  total_wallet_points: number;
  total_wallet_purchased: number;
  total_wallet_spent: number;
  total_referral_balance: number;
  total_referral_earned: number;
  total_referral_withdrawn: number;
  total_users_with_wallet: number;
  total_users_with_referral: number;
}

interface FinancialStatsByPeriod {
  total_wallet_points: number;
  total_wallet_purchased: number;
  total_wallet_spent: number;
  total_referral_balance: number;
  total_referral_earned: number;
  total_referral_withdrawn: number;
  total_users_with_wallet: number;
  total_users_with_referral: number;
}

interface OverviewStats {
  total_members: number;
  active_members: number;
  inactive_members: number;
  total_companies: number;
  verified_companies: number;
  active_companies: number;
  banned_companies: number;
  profile_complete_percentage: number;
}

export const useOwnerAnalytics = () => {
  const overviewQuery = useQuery({
    queryKey: ["owner-overview-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_owner_overview_statistics");
      if (error) throw error;
      return data?.[0] as OverviewStats;
    },
  });

  const locationQuery = useQuery({
    queryKey: ["owner-location-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_location_statistics");
      if (error) throw error;
      return data as LocationStats[];
    },
  });

  const financialQuery = useQuery({
    queryKey: ["owner-financial-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_statistics");
      if (error) throw error;
      return data?.[0] as FinancialStats;
    },
  });

  const financialByPeriodQuery = useQuery({
    queryKey: ["owner-financial-stats-period", "today"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_statistics_by_period", {
        p_period: "today",
      });
      if (error) throw error;
      return data?.[0] as FinancialStatsByPeriod;
    },
  });

  return {
    overview: {
      data: overviewQuery.data,
      isLoading: overviewQuery.isLoading,
      error: overviewQuery.error,
    },
    location: {
      data: locationQuery.data,
      isLoading: locationQuery.isLoading,
      error: locationQuery.error,
    },
    financial: {
      data: financialByPeriodQuery.data,
      isLoading: financialByPeriodQuery.isLoading,
      error: financialByPeriodQuery.error,
    },
  };
};

export const useLoginActivity = (period: string = "today") => {
  return useQuery({
    queryKey: ["login-activity", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_login_activity_statistics", {
        p_period: period,
      });
      if (error) throw error;
      return data as LoginActivity[];
    },
  });
};

export const useNewAccounts = (period: string = "today") => {
  return useQuery({
    queryKey: ["new-accounts", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_new_accounts_statistics", {
        p_period: period,
      });
      if (error) throw error;
      return data as NewAccounts[];
    },
  });
};
