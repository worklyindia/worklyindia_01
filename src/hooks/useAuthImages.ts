import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCacheData, setCacheData } from "@/utils/offlineCache";
import { AUTH_IMAGE_CACHE_KEY, AUTH_IMAGE_STORAGE_KEY, AUTH_IMAGE_UPDATED_EVENT } from "@/lib/authImageUpdates";

interface AuthImages {
  job_seeker_avatar: string | null;
  employer_avatar: string | null;
  home_hero_image: string | null;
  home_seekers_image: string | null;
  default_job_seeker_avatar: string | null;
  default_company_logo: string | null;
}

const listeners = new Set<() => void>();
let stopWatching: (() => void) | undefined;
const settingKeys = ['job_seeker_login_avatar', 'employer_login_avatar', 'home_hero_image', 'home_seekers_image', 'default_job_seeker_avatar', 'default_company_logo'];

function watchImages(refresh: () => void) {
  listeners.add(refresh);
  if (!stopWatching) {
    const invalidate = () => {
      try { localStorage.removeItem('wkly_cache_' + AUTH_IMAGE_CACHE_KEY); } catch { /* optional cache */ }
      listeners.forEach((listener) => listener());
    };
    const storage = (event: StorageEvent) => { if (event.key === AUTH_IMAGE_STORAGE_KEY) invalidate(); };
    window.addEventListener(AUTH_IMAGE_UPDATED_EVENT, invalidate);
    window.addEventListener('storage', storage);
    const channel = supabase.channel('public-auth-image-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const row = payload.new as { setting_key?: string };
        const old = payload.old as { setting_key?: string };
        const key = row.setting_key ?? old.setting_key;
        if (!key || settingKeys.includes(key)) invalidate();
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') invalidate(); });
    stopWatching = () => {
      window.removeEventListener(AUTH_IMAGE_UPDATED_EVENT, invalidate);
      window.removeEventListener('storage', storage);
      void supabase.removeChannel(channel);
      stopWatching = undefined;
    };
  }
  return () => {
    listeners.delete(refresh);
    if (!listeners.size) stopWatching?.();
  };
}

export const useAuthImages = () => {
  const queryClient = useQueryClient();
  useEffect(() => watchImages(() => {
    void queryClient.invalidateQueries({ queryKey: ['auth-images'] });
  }), [queryClient]);
  return useQuery({
    queryKey: ["auth-images"],
    initialData: () => getCacheData<AuthImages>(AUTH_IMAGE_CACHE_KEY) ?? undefined,
    queryFn: async () => {
      const cached = getCacheData<AuthImages>(AUTH_IMAGE_CACHE_KEY);
      if (cached) return cached;
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "job_seeker_login_avatar",
          "employer_login_avatar",
          "home_hero_image",
          "home_seekers_image",
          "default_job_seeker_avatar",
          "default_company_logo",
        ]);

      if (error) throw error;

      const images: AuthImages = {
        job_seeker_avatar: null,
        employer_avatar: null,
        home_hero_image: null,
        home_seekers_image: null,
        default_job_seeker_avatar: null,
        default_company_logo: null,
      };

      data?.forEach((item) => {
        if (item.setting_key === "job_seeker_login_avatar") {
          images.job_seeker_avatar = item.setting_value;
        } else if (item.setting_key === "employer_login_avatar") {
          images.employer_avatar = item.setting_value;
        } else if (item.setting_key === "home_hero_image") {
          images.home_hero_image = item.setting_value;
        } else if (item.setting_key === "home_seekers_image") {
          images.home_seekers_image = item.setting_value;
        } else if (item.setting_key === "default_job_seeker_avatar") {
          images.default_job_seeker_avatar = item.setting_value;
        } else if (item.setting_key === "default_company_logo") {
          images.default_company_logo = item.setting_value;
        }
      });

      setCacheData(AUTH_IMAGE_CACHE_KEY, images, Number.MAX_SAFE_INTEGER);
      return images;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
