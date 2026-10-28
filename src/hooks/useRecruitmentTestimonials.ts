import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecruitmentTestimonial {
  id: string;
  name: string;
  position: string;
  company: string;
  feedback: string;
  rating: number;
  is_verified: boolean;
}

export const useRecruitmentTestimonials = () => {
  return useQuery({
    queryKey: ['recruitment-testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruitment_testimonials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecruitmentTestimonial[];
    },
  });
};
