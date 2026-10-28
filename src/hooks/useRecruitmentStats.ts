import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RecruitmentStats {
  companies_served: number;
  successful_placements: number;
  avg_time_to_hire: number;
  client_satisfaction: number;
}

export const useRecruitmentStats = () => {
  return useQuery({
    staleTime: 1000 * 60 * 60, // 60 min — egress optimization
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryKey: ['recruitment-stats'],
    queryFn: async () => {
      // Get active companies count
      const { count: companiesCount } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'active');

      // Get successful placements (hired applications)
      const { count: placementsCount } = await supabase
        .from('job_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['hired', 'accepted']);

      // Get average time to hire (days between application and hiring)
      const { data: hiredApps } = await supabase
        .from('job_applications')
        .select('applied_at, reviewed_at')
        .in('status', ['hired', 'accepted'])
        .not('reviewed_at', 'is', null);

      let avgTimeToHire = 15; // default
      if (hiredApps && hiredApps.length > 0) {
        const totalDays = hiredApps.reduce((sum, app) => {
          const appliedDate = new Date(app.applied_at);
          const reviewedDate = new Date(app.reviewed_at!);
          const days = Math.ceil((reviewedDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgTimeToHire = Math.ceil(totalDays / hiredApps.length);
      }

      // Get client satisfaction from company reviews
      const { data: reviews } = await supabase
        .from('company_reviews')
        .select('rating');

      let satisfaction = 95; // default
      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        satisfaction = Math.round((avgRating / 5) * 100);
      }

      return {
        companies_served: companiesCount || 4,
        successful_placements: placementsCount || 0,
        avg_time_to_hire: avgTimeToHire,
        client_satisfaction: satisfaction,
      } as RecruitmentStats;
    },
  });
};
