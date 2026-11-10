import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { resolveBrandLogo } from "@/lib/brandLogo";

interface BrandAssets {
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  brand_name?: string;
  brand_tagline?: string;
  primary_color?: string;
  secondary_color?: string;
  og_image_url?: string;
  og_title?: string;
  og_description?: string;
}

const defaultAssets: BrandAssets = {
  brand_name: BRAND_CONFIG.name,
  brand_tagline: BRAND_CONFIG.tagline,
  primary_color: '#8B5CF6',
  secondary_color: '#3B82F6',
  favicon_url: '/favicon.png',
};

export const useBrandAssets = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['brand-assets'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_assets');
      if (error) {
        console.error('Error fetching brand assets:', error);
        return defaultAssets;
      }
      // Merge with defaults so missing fields don't break UI
      const fetched = (data && typeof data === 'object') ? (data as BrandAssets) : {};
      return { ...defaultAssets, ...fetched } as BrandAssets;
    },
    // Brand assets rarely change — cache aggressively to cut Supabase egress.
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: defaultAssets,
  });

  return {
    ...defaultAssets,
    ...(data || {}),
    logo_url: resolveBrandLogo(data?.logo_url),
    favicon_url: resolveBrandLogo(data?.favicon_url, true),
    isLoading,
    error
  };
};
