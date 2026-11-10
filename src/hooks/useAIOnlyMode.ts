import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * "AI only" mode — when enabled by the owner, visitors can only use the
 * AI assistant pages (plus legal/policy pages and the admin area).
 */
const CACHE_KEY = "ai_only_mode_cache";

const readCachedMode = (): boolean => {
  try {
    return localStorage.getItem(CACHE_KEY) === "true";
  } catch {
    return false;
  }
};

export const useAIOnlyMode = () => {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ai-only-mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ai_only_mode")
        .maybeSingle();

      if (error) throw error;
      const enabled = data?.setting_value === "true";
      // Remember the last known value so the next page load can react
      // instantly instead of briefly showing the normal website.
      try {
        localStorage.setItem(CACHE_KEY, String(enabled));
      } catch {
        // ignore storage errors
      }
      return enabled;
    },
    // Use the cached value immediately while the fresh value loads.
    initialData: readCachedMode,
    initialDataUpdatedAt: 0,
    // The global query client sets `refetchOnMount: false`, which would keep
    // the cached/initial value forever and make the mode look OFF even when
    // it is ON in the database. Always re-check on mount.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    retry: 1,
  });

  return { enabled: !!data, isLoading, isFetching };
};
