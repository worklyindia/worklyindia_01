import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecruitmentSolution {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon_name: string;
  price: string;
  is_popular: boolean;
  display_order: number;
}

export const useRecruitmentSolutions = () => {
  return useQuery({
    queryKey: ['recruitment-solutions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruitment_solutions')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as RecruitmentSolution[];
    },
  });
};
