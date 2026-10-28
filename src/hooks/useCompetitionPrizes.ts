import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CompetitionPrize {
  id: string;
  rank: number;
  prize_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCompetitionPrizes = () => {
  return useQuery({
    queryKey: ["competition-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_competition_prizes")
        .select("*")
        .eq("is_active", true)
        .order("rank", { ascending: true });

      if (error) throw error;
      return data as CompetitionPrize[];
    },
  });
};

export const useUpdateCompetitionPrize = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rank, prize_amount }: { rank: number; prize_amount: number }) => {
      const { data, error } = await supabase
        .from("referral_competition_prizes")
        .update({ prize_amount, updated_at: new Date().toISOString() })
        .eq("rank", rank)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competition-prizes"] });
      toast.success("Prize amount updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update prize: ${error.message}`);
    },
  });
};
