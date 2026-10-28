import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardData {
  profile: any;
  applications: any[];
  favorites: any[];
  recent_jobs: any[];
  stats: {
    total_applications: number;
    pending_applications: number;
    favorites_count: number;
  };
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  timestamp: string;
}

export const useOptimizedDashboard = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['optimized-dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      console.log('📊 Fetching optimized dashboard data');
      
      const { data, error } = await supabase.functions.invoke('get-user-dashboard', {
        body: {},
      });

      if (error) {
        console.error('❌ Dashboard fetch error:', error);
        throw error;
      }

      const response = data as DashboardResponse;
      
      if (!response.success) {
        throw new Error('Dashboard fetch failed');
      }

      console.log('✅ Dashboard data loaded successfully');
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
};
