import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface JobLocationStats {
  country: string;
  state: string;
  city: string;
  total_jobs: number;
  active_jobs: number;
  public_jobs: number;
  draft_jobs: number;
}

export const useJobLocationAnalytics = () => {
  const query = useQuery({
    queryKey: ["job-location-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_job_location_statistics");
      if (error) throw error;
      return data as JobLocationStats[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes stale time
    refetchInterval: 1000 * 60 * 5, // Every 5 minutes (was 30 seconds)
    refetchOnWindowFocus: false,
  });

  // Removed realtime subscription - not needed for analytics, 
  // refetch interval is sufficient and reduces egress

  return query;
};
