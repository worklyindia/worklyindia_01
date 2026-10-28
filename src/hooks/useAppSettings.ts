import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setCacheData, getCacheData } from "@/utils/offlineCache";

export interface AppSettings {
  android_app_url: string;
  ios_app_url: string;
  show_download_buttons: string;
  show_install_banner: string;
  install_button_action: string;
  phone_verify_enabled: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  android_app_url: "",
  ios_app_url: "",
  show_download_buttons: "true",
  show_install_banner: "true",
  install_button_action: "pwa",
  phone_verify_enabled: "false",
};

const CACHE_KEY = 'app_settings';

export const useAppSettings = () => {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["android_app_url", "ios_app_url", "show_download_buttons", "show_install_banner", "install_button_action", "phone_verify_enabled"]);

      if (error) {
        // On network error, return cached data instead of throwing
        const cached = getCacheData<AppSettings>(CACHE_KEY);
        if (cached) return cached;
        throw error;
      }

      const settings: AppSettings = { ...DEFAULT_SETTINGS };

      data?.forEach((setting) => {
        if (setting.setting_key in settings) {
          settings[setting.setting_key as keyof AppSettings] = setting.setting_value || settings[setting.setting_key as keyof AppSettings];
        }
      });

      // Save to localStorage for offline access
      setCacheData(CACHE_KEY, settings, 30 * 60 * 1000);

      return settings;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — settings rarely change
    gcTime: 60 * 60 * 1000, // Keep in memory for 1 hour
    retry: 1, // Only retry once — don't spam failing requests
    retryDelay: 3000,
    placeholderData: () => getCacheData<AppSettings>(CACHE_KEY) ?? DEFAULT_SETTINGS,
    enabled: typeof window !== 'undefined' && window.location.pathname.includes('/admin'),
    initialData: () => getCacheData<AppSettings>(CACHE_KEY) ?? DEFAULT_SETTINGS,
  });
};

export const useUpdateAppSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<AppSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }));

      const promises = updates.map((update) =>
        supabase
          .from("app_settings")
          .update({
            setting_value: update.setting_value,
            updated_by: update.updated_by,
            updated_at: update.updated_at,
          })
          .eq("setting_key", update.setting_key)
      );

      const results = await Promise.all(promises);
      
      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("App settings updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
};
