import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords?: string[];
  relevance_score?: number;
}

export const useFAQs = () => {
  return useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faqs")
        .select("id, category, question, answer, keywords, relevance_score")
        .eq("is_active", true)
        .order("relevance_score", { ascending: false })
        .order("category")
        .order("question");

      if (error) {
        console.error("Error fetching FAQs:", error);
        throw error;
      }

      return data as FAQ[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
};
