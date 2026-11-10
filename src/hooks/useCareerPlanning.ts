import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CareerPlanningProgress {
  id: string;
  user_id: string;
  step_number: number;
  step_name: string;
  is_completed: boolean;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useCareerPlanningProgress = (userId?: string) => {
  return useQuery({
    queryKey: ["career-planning-progress", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("career_planning_progress")
        .select("*")
        .eq("user_id", userId)
        .order("step_number");

      if (error) throw error;
      return data as CareerPlanningProgress[];
    },
    enabled: !!userId,
  });
};

export const useUpdateCareerProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      stepNumber,
      stepName,
      isCompleted,
      notes,
    }: {
      userId: string;
      stepNumber: number;
      stepName: string;
      isCompleted: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("career_planning_progress")
        .upsert({
          user_id: userId,
          step_number: stepNumber,
          step_name: stepName,
          is_completed: isCompleted,
          notes: notes || null,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["career-planning-progress"] });
      toast.success("Progress updated successfully!");
    },
    onError: () => {
      toast.error("Failed to update progress");
    },
  });
};
