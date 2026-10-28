import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CareerPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  growth_rate: string;
  avg_salary_min: number;
  avg_salary_max: number;
  popular_roles: string[];
  key_skills: string[];
  icon_name: string | null;
  job_category: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const useCareerPaths = () => {
  return useQuery({
    queryKey: ["career-paths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("career_paths")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as CareerPath[];
    },
  });
};

export const useCareerPathBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ["career-path", slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from("career_paths")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data as CareerPath;
    },
    enabled: !!slug,
  });
};
