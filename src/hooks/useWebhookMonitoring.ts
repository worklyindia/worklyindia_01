import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePageVisibility } from "@/hooks/usePageVisibility";

interface WebhookStats {
  webhook_health: string;
  timestamp: string;
  last_hour: {
    successful_payments: number;
    pending_payments: number;
  };
  webhook_url: string;
  status_checks: {
    environment_variables: {
      webhook_secret: boolean;
      supabase_url: boolean;
      supabase_key: boolean;
    };
  };
}

export const useWebhookMonitoring = () => {
  const { isVisible } = usePageVisibility();
  
  return useQuery({
    queryKey: ["webhook-monitoring"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("webhook-monitor", {
        method: "GET",
      });
      
      if (error) throw error;
      return data as WebhookStats;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes stale time
    refetchInterval: isVisible ? 1000 * 60 * 5 : false, // 5 minutes when visible, disabled when hidden (was 2 min)
    refetchOnWindowFocus: false,
  });
};
